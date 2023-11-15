import express from 'express';
import { PubSub, Duration } from '@google-cloud/pubsub';
import { authenticateApiKey } from '../utils/auth.js';
import { handleNewReward } from '../utils/webhooks/webhook.js';
import { v4 as uuidv4 } from 'uuid';
import { MetricServiceClient } from '@google-cloud/monitoring';
import { handleIsolatedReward } from '../utils/webhooks/isolated-reward.js';
import { handleSwap } from '../utils/webhooks/swap.js';
import { handleNewTransaction } from '../utils/webhooks/transaction.js';

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
const topicName = process.env.PUBSUB_TOPIC_NAME;
const subscriptionName = process.env.PUBSUB_SUBSCRIPTION_NAME;

const router = express.Router();

router.get('/unacked-messages', authenticateApiKey, async (req, res) => {
  try {
    const client = new MetricServiceClient();

    const timeSeries = await client.listTimeSeries({
      name: client.projectPath(process.env.PROJECT_ID),
      filter: `metric.type="pubsub.googleapis.com/subscription/num_unacked_messages_by_region" AND resource.labels.subscription_id="${process.env.PUBSUB_SUBSCRIPTION_NAME}"`,
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
      series?.forEach((serie) => {
        serie?.points?.forEach((point) => {
          sum += parseFloat(point.value.int64Value);
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
    if (req.body.event === 'new_transaction_batch') {
      req.body.params = req.body.params.filter((transaction) => {
        return /^\d+$/.test(amount) && parseInt(amount) > 0;
      });

      if (req.body.params.length === 0) {
        res
          .status(400)
          .json({ success: false, message: 'all token amounts incorrect' });
      }
    }

    if (req.body.event === 'new_transaction') {
      if (
        !/^\d+$/.test(req.body.params.amount) ||
        parseInt(req.body.params.amount) <= 0
      ) {
        res
          .status(400)
          .json({ success: false, message: 'token amount incorrect' });
        return;
      }
    }

    if (req.body.event === 'isolated_reward') {
      if (!req.body.params.userTelegramID) {
        res
          .status(400)
          .json({ success: false, message: 'User Telegram ID is missing' });
      } else if (!req.body.params.amount) {
        res.status(400).json({ success: false, message: 'Amount is missing' });
      } else if (!req.body.params.reason) {
        res.status(400).json({ success: false, message: 'Reason is missing' });
      }
    }

    req.body.event === 'new_transaction_batch'
      ? req.body.params.forEach(
          (transaction) => (transaction.eventId = uuidv4())
        )
      : (req.body.params.eventId = uuidv4());
    const data = JSON.stringify(req.body);
    console.log(`Publishing message: ${data}`);
    const dataBuffer = Buffer.from(data);
    const messageId = await pubSubClient
      .topic(topicName)
      .publishMessage({ data: dataBuffer });
    if (messageId) {
      res.json({ success: true, messageId });
    } else {
      res.status(500).json({ success: false, error: "Event wasn't saved" });
    }
  } catch (error) {
    console.error(`Received error while publishing: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Subscribe to messages from Pub/Sub
const listenForMessages = () => {
  // get subscription
  const subscription = pubSubClient.subscription(subscriptionName, {
    minAckDeadline: new Duration(
      parseInt(process.env.PUBSUB_MIN_ACK_DEADLINE, 10) || 60 * 1000
    ),
    maxAckDeadline: new Duration(
      parseInt(process.env.PUBSUB_MAX_ACK_DEADLINE, 10) || 1200 * 1000
    ),
    flowControl: {
      maxMessages: parseInt(process.env.PUBSUB_CONCURRENCY, 10) || 50,
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
      JSON.stringify(messageData, null, 2)
    );
    const deadline = Date.now() / 1000 - 60 * 60 * 24; // 1 day ago{
    if (
      (message.deliveryAttempt || 0) > 2 &&
      message.publishTime.toStruct().seconds < deadline
    ) {
      console.log(
        `Dropping old message ${
          message.id
        }, publishTime=${message.publishTime.toISOString()}`
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
          for (let singleTransaction of messageData.params) {
            // Publishing each transaction as a new event
            const transactionEvent = {
              event: 'new_transaction',
              params: singleTransaction,
            };
            const transactionDataBuffer = Buffer.from(
              JSON.stringify(transactionEvent)
            );
            await pubSubClient
              .topic(topicName)
              .publishMessage({ data: transactionDataBuffer });
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

      if (!processed) {
        throw new Error('Error processing event');
      }

      console.log(
        'Acknowledged message:',
        JSON.stringify(messageData, null, 2)
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
