import express from 'express';
import { PubSub, Duration } from '@google-cloud/pubsub';
import { authenticateApiKey } from '../utils/auth';
import { handleNewReward } from '../webhooks/webhook';
import { v4 as uuidv4 } from 'uuid';
import { MetricServiceClient } from '@google-cloud/monitoring';
import { handleIsolatedReward } from '../webhooks/isolated-reward';
import { handleSwap } from '../webhooks/swap';
import { handleNewTransaction } from '../webhooks/transaction';
import {
  PROJECT_ID,
  PUBSUB_CONCURRENCY,
  PUBSUB_MAX_ACK_DEADLINE,
  PUBSUB_MIN_ACK_DEADLINE,
  PUBSUB_SUBSCRIPTION_NAME,
  PUBSUB_TOPIC_NAME,
} from '../../secrets';
import { google } from '@google-cloud/monitoring/build/protos/protos';
import { isPositiveFloat } from '../webhooks/utils';

/**
 * This is a generic and extendable implementation of a webhook endpoint and pub/sub messages queue.
 * It can be used to catch any webhook event and push it to the queue for processing.
 *
 * Add new events to the switch statement in the messageHandler function.
 * Events that are not defined in switch statement will be acknowledged and removed from the queue by default.
 */

// Init pub/sub client
const pubSubClient = new PubSub();

// Get topic and subscription names from env
const topicName = PUBSUB_TOPIC_NAME;
const subscriptionName = PUBSUB_SUBSCRIPTION_NAME;

const router = express.Router();

router.get('/unacked-messages', authenticateApiKey, async (_req, res) => {
  try {
    const client = new MetricServiceClient();

    const timeSeries = await client.listTimeSeries({
      name: client.projectPath(PROJECT_ID),
      filter: `metric.type="pubsub.googleapis.com/subscription/num_unacked_messages_by_region" AND resource.labels.subscription_id="${PUBSUB_SUBSCRIPTION_NAME}"`,
      interval: {
        // Limit results to the last 20 minutes
        startTime: {
          seconds: Date.now() / 1000 - 60 * 20,
        },
        endTime: {
          seconds: Date.now() / 1000,
        },
      },
    });

    // Initialize the sum and count variables for calculating the average
    let sum = 0;
    let count = 0;

    // Iterate through the timeSeries to calculate the sum
    timeSeries?.forEach((series) => {
      (series as google.monitoring.v3.ITimeSeries[])?.forEach((serie) => {
        serie?.points?.forEach((point) => {
          sum += parseFloat(point.value.int64Value as string);
          count++;
        });
      });
    });

    // Calculate the average
    const average = count > 0 ? sum / count : 0;

    // Return the result in JSON format
    res.json({ num_unacked_messages: average });
  } catch (error) {
    console.error('Error querying metrics:', error);
  }
});

/**
 * POST /v1/webhook
 *
 * @summary Catch a webhook
 * @description Catches a webhook event and pushes it to the queue for processing.
 * @tags Webhook
 * @security BearerAuth
 * @param {object} request.body - The request body containing the event name and params
 * @return {object} 200 - Success response with message ID
 * @example request - 200 - Example request body
 * {
 *   "event": "event_name",
 *   "params": { "param1": "value1" }
 * }
 * @example response - 200 - Success response example
 * {
 *   "success": true,
 *   "messageId": "some-uuid"
 * }
 *
 * @example response - 500 - Error response example
 * {
 *   "success": false,
 *   "error": "error message"
 * }
 */
router.post('/', authenticateApiKey, async (req, res) => {
  try {
    // Filter and validate transaction amounts for the 'new_transaction_batch' event
    if (req.body.event === 'new_transaction_batch') {
      req.body.params = req.body.params.filter(
        (transaction: { amount: string }) =>
          isPositiveFloat(transaction.amount),
      );

      // Check if all token amounts are incorrect
      if (req.body.params.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: 'all token amounts incorrect' });
      }
    }

    // Validate token amount for 'new_transaction' event
    if (
      req.body.event === 'new_transaction' &&
      !isPositiveFloat(req.body.params.amount)
    ) {
      return res
        .status(400)
        .json({ success: false, message: 'token amount incorrect' });
    }

    // Validate parameters for 'isolated_reward' event
    if (req.body.event === 'isolated_reward') {
      if (!req.body.params.userTelegramID) {
        return res
          .status(400)
          .json({ success: false, message: 'User Telegram ID is missing' });
      } else if (!req.body.params.amount) {
        return res
          .status(400)
          .json({ success: false, message: 'Amount is missing' });
      } else if (!req.body.params.reason) {
        return res
          .status(400)
          .json({ success: false, message: 'Reason is missing' });
      }
    }

    // Generate unique eventId for each transaction
    req.body.event === 'new_transaction_batch'
      ? req.body.params.forEach(
          (transaction: { eventId: string }) =>
            (transaction.eventId = uuidv4()),
        )
      : (req.body.params.eventId = uuidv4());

    // Prepare data and publish message to Pub/Sub
    const data = JSON.stringify(req.body);
    console.log(`Publishing message: ${data}`);
    const dataBuffer = Buffer.from(data);
    const messageId = await pubSubClient
      .topic(topicName)
      .publishMessage({ data: dataBuffer });

    // Check if message was successfully published
    if (messageId) {
      return res.json({ success: true, messageId });
    } else {
      return res
        .status(500)
        .json({ success: false, error: "Event wasn't saved" });
    }
  } catch (error) {
    // Handle errors during publishing and return error response
    console.error(`Received error while publishing: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Subscribe to messages from Pub/Sub
const listenForMessages = () => {
  // get subscription
  const subscription = pubSubClient.subscription(subscriptionName, {
    minAckDeadline: Duration.from({
      millis: parseInt(PUBSUB_MIN_ACK_DEADLINE, 10) || 60 * 1000,
    }),
    maxAckDeadline: Duration.from({
      millis: parseInt(PUBSUB_MAX_ACK_DEADLINE, 10) || 1200 * 1000,
    }),
    flowControl: {
      maxMessages: parseInt(PUBSUB_CONCURRENCY, 10) || 50,
    },
  });

  // Process and acknowledge pub/sub message
  const messageHandler = async (message) => {
    const messageDataString = message.data.toString();
    const messageData = JSON.parse(messageDataString);
    console.log(
      `Received message [${message.id},${
        message.deliveryAttempt
      },${message.publishTime.toISOString()}]:`,
      JSON.stringify(messageData, null, 2),
    );
    const deadline = Date.now() / 1000 - 60 * 60 * 24; // 1 day ago{
    if (
      (message.deliveryAttempt || 0) > 2 &&
      message.publishTime.toStruct().seconds < deadline
    ) {
      console.log(
        `Dropping old message ${
          message.id
        }, publishTime=${message.publishTime.toISOString()}`,
      );
      message.ack();
      return;
    }

    try {
      let processed = false; // Has event been processed. If not, message will be requeued.

      // Handle events below. If event is not specified, message will be acknowledged and removed from the queue.

      // Example events:
      switch (messageData.event) {
        // User initiated new transaction
        case 'new_transaction':
          processed = await handleNewTransaction(messageData.params);
          break;
        // User initiated new transaction batch
        case 'new_transaction_batch':
          for (const singleTransaction of messageData.params) {
            // Publishing each transaction as a new event
            await pubSubClient.topic(topicName).publishMessage({
              data: Buffer.from(
                JSON.stringify({
                  event: 'new_transaction',
                  params: singleTransaction,
                }),
              ),
            });
          }
          processed = true;
          break;
        // New reward has been issued to user
        case 'new_reward':
          processed = await handleNewReward(messageData.params);
          break;
        // Isolated reward
        case 'isolated_reward':
          processed = await handleIsolatedReward(messageData.params);
          break;
        case 'swap':
          processed = await handleSwap(messageData.params);
          break;
        default:
          processed = true;
          break;
      }

      if (!processed) throw new Error('Error processing event');

      console.log(
        'Acknowledged message:',
        JSON.stringify(messageData, null, 2),
      );
      setTimeout(() => message.ack(), 0); // "Ack" (acknowledge receipt of) the message
    } catch (error) {
      console.error('messageHandler error:', error);
      setTimeout(() => message.nack(), 0); // "Nack" (don't acknowledge receipt of) the message
    }
  };

  subscription.on('message', messageHandler);
};

// Start listening for pub/sub messages
listenForMessages();

export default router;
