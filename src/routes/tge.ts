import express from 'express';
import { authenticateApiKey } from '../utils/auth';
import { computeG1ToGxConversion } from '../utils/g1gx';
import { Database } from '../db/conn';
import {
  GX_ORDER_COLLECTION,
  GX_QUOTE_COLLECTION,
  GX_ORDER_STATUS,
} from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import { getPatchWalletAccessToken, sendTokens } from '../utils/patchwallet';
import { SOURCE_WALLET_ADDRESS } from '../../secrets';
import { getTokenPrice } from '../utils/ankr';

const router = express.Router();

/**
 * GET /v1/tge/quote
 *
 * @summary Calculate G1 to Gx conversion
 * @description Calculates the conversion from G1 to Gx based on provided quantities of USD and G1.
 * @tags Conversion
 * @security BearerAuth
 * @param {number} usdQuantity.query - The quantity of USD.
 * @param {number} g1Quantity.query - The quantity of G1.
 * @return {object} 200 - Success response with the calculated conversion value
 * @return {object} 500 - Error response if an error occurs during the conversion
 *
 * @example request - 200 - Example request query parameters
 * /v1/tge/quote?usdQuantity=100&g1Quantity=50
 *
 * @example response - 200 - Success response example
 * {
 *   "usdFromUsdInvestment": "10",
 *   "usdFromG1Investment": "0.049",
 *   "usdFromMvu": "0.80",
 *   "usdFromTime": "1.04",
 *   "equivalentUsdInvested": "11.89",
 *   "gxBeforeMvu": "279.16",
 *   "gxMvuEffect": "22.33",
 *   "gxTimeEffect": "29.00",
 *   "gxReceived": "1200",
 *   "GxUsdExchangeRate": "32.88",
 *   "standardGxUsdExchangeRate": "27.77",
 *   "discountReceived": "15.53",
 *   "date": "2023-12-31T12:00:00Z",
 *   "quoteId": "some-unique-id",
 *   "userTelegramID": "user-telegram-id"
 * }
 *
 * @example response - 500 - Error response example
 * {
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.get('/quote', authenticateApiKey, async (req, res) => {
  try {
    const result = computeG1ToGxConversion(
      Number(req.query.usdQuantity),
      Number(req.query.g1Quantity),
      4,
    );
    const db = await Database.getInstance();
    const id = uuidv4();
    const date = new Date();

    await db?.collection(GX_QUOTE_COLLECTION).updateOne(
      { quoteId: id },
      {
        $set: {
          ...result,
          quoteId: id,
          date: date,
          userTelegramID: req.query.userTelegramID,
        },
      },
      { upsert: true },
    );

    return res.status(200).json({
      ...result,
      date,
      quoteId: id,
      userTelegramID: req.query.userTelegramID,
    });
  } catch (error) {
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

/**
 * POST /v1/tge/order
 *
 * @summary Create a Gx token order
 * @description Initiates a order for Gx tokens based on the provided quote ID and user details.
 * @tags Pre-Order
 * @security BearerAuth
 * @param {string} req.body.quoteId - The quote ID to create a order.
 * @param {string} req.body.userTelegramID - The user's Telegram ID for identification.
 * @return {object} 200 - Success response with the order transaction details
 * @return {object} 400 - Error response if a quote is unavailable or the order is being processed
 * @return {object} 500 - Error response if an error occurs during the order process
 *
 * @example request - 200 - Example request body
 * {
 *   "quoteId": "mocked-quote-id",
 *   "userTelegramID": "user-telegram-id"
 * }
 *
 * @example response - 200 - Success response example
 * {
 *   "success": true,
 *   "order": {
 *     "orderId": "mocked-quote-id",
 *     "date": "2023-12-31T12:00:00Z",
 *     "status": "PENDING",
 *     "userTelegramID": "user-telegram-id",
 *     "tokenAmountG1": "1000.00",
 *     "transactionHashG1": "transaction-hash",
 *     "userOpHashG1": "user-operation-hash"
 *   }
 * }
 *
 * @example response - 400 - Error response example if a quote is unavailable or the order is being processed
 * {
 *   "success": false,
 *   "msg": "No quote available for this ID"
 * }
 *
 * @example response - 500 - Error response example if an error occurs during the order process
 * {
 *   "success": false,
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.post('/order', authenticateApiKey, async (req, res) => {
  const db = await Database.getInstance();

  // Retrieve quote details based on the provided quoteId
  const quote = await db
    ?.collection(GX_QUOTE_COLLECTION)
    .findOne({ quoteId: req.body.quoteId });

  // If quote is not found, return an error response
  if (!quote)
    return res
      .status(400)
      .json({ success: false, msg: 'No quote available for this ID' });

  if (quote.userTelegramID !== req.body.userTelegramID)
    return res.status(400).json({
      success: false,
      msg: 'Quote ID is not linked to the provided user Telegram ID',
    });

  // Check if an order with the same quoteId is already being processed
  const order = await db
    ?.collection(GX_ORDER_COLLECTION)
    .findOne({ orderId: req.body.quoteId });

  // If an order is already being processed, return an error response
  if (order && order.status !== GX_ORDER_STATUS.FAILURE_G1)
    return res
      .status(400)
      .json({ success: false, msg: 'This order is already being processed' });

  // Create/update the order with pending status and user details
  await db?.collection(GX_ORDER_COLLECTION).updateOne(
    { orderId: req.body.quoteId },
    {
      $set: {
        orderId: req.body.quoteId,
        date: new Date(),
        status: GX_ORDER_STATUS.PENDING,
        userTelegramID: req.body.userTelegramID,
        tokenAmountG1: quote.tokenAmountG1,
      },
    },
    { upsert: true },
  );

  try {
    // Send tokens for the order and get transaction details
    const { data } = await sendTokens(
      req.body.userTelegramID,
      SOURCE_WALLET_ADDRESS,
      quote.tokenAmountG1,
      await getPatchWalletAccessToken(),
      0,
    );

    // Determine the status of the order based on additional conditions
    const status =
      Number(quote.usdFromUsdInvestment) > 0
        ? GX_ORDER_STATUS.WAITING_USD
        : GX_ORDER_STATUS.COMPLETE;

    const date = new Date();

    // Update the order with transaction details and updated status
    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.quoteId },
      {
        $set: {
          orderId: req.body.quoteId,
          date: date,
          status,
          userTelegramID: req.body.userTelegramID,
          tokenAmountG1: quote.tokenAmountG1,
          transactionHashG1: data.txHash,
          userOpHashG1: data.userOpHash,
        },
      },
      { upsert: true },
    );

    // Return success response with order transaction details
    return res.status(200).json({
      success: true,
      order: {
        orderId: req.body.quoteId,
        date: date,
        status,
        userTelegramID: req.body.userTelegramID,
        tokenAmountG1: quote.tokenAmountG1,
        transactionHashG1: data.txHash,
        userOpHashG1: data.userOpHash,
      },
    });
  } catch (e) {
    // Log error if transaction fails and update order status to failure
    console.error(
      `[${req.body.quoteId}] Error processing PatchWallet order G1 transaction: ${e}`,
    );

    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.quoteId },
      {
        $set: {
          orderId: req.body.quoteId,
          date: new Date(),
          status: GX_ORDER_STATUS.FAILURE_G1,
          userTelegramID: req.body.userTelegramID,
          tokenAmountG1: quote.tokenAmountG1,
        },
      },
      { upsert: true },
    );

    // Return error response if an error occurs during the order process
    return res
      .status(500)
      .json({ success: false, msg: 'An error occurred', error: e });
  }
});

/**
 * PATCH /v1/tge/order
 *
 * @summary Process USD-based Gx token order
 * @description Processes an order for Gx tokens using USD, linking it to the provided quote ID and user details.
 * @tags USD Order
 * @security BearerAuth
 * @param {string} req.body.quoteId - The quote ID to process the order.
 * @param {string} req.body.userTelegramID - The user's Telegram ID for identification.
 * @param {string} req.body.tokenAddress - The token address for USD-based order.
 * @param {string} req.body.chainId - The chain ID for USD-based order.
 * @return {object} 200 - Success response with processed order details
 * @return {object} 400 - Error response if the quote is unavailable or order status is not ready for USD payment
 * @return {object} 500 - Error response if an error occurs during the order processing
 *
 * @example request - 200 - Example request body
 * {
 *   "quoteId": "mocked-quote-id",
 *   "userTelegramID": "user-telegram-id",
 *   "tokenAddress": "token-address",
 *   "chainId": "chain-id"
 * }
 *
 * @example response - 200 - Success response example
 * {
 *   "success": true,
 *   "order": {
 *     "orderId": "mocked-quote-id",
 *     "dateUSD": "2023-12-31T12:00:00Z",
 *     "status": "COMPLETE",
 *     "userTelegramID": "user-telegram-id",
 *     "transactionHash_USD": "transaction-hash",
 *     "userOpHash_USD": "user-operation-hash",
 *     "amountUSD": "250.00",
 *     "tokenAmountUSD": "25.00",
 *     "tokenAddressUSD": "token-address",
 *     "chainIdUSD": "chain-id"
 *   }
 * }
 *
 * @example response - 400 - Error response example if the quote is unavailable or order status is not ready for USD payment
 * {
 *   "success": false,
 *   "msg": "No quote available for this ID"
 * }
 *
 * @example response - 500 - Error response example if an error occurs during the order processing
 * {
 *   "success": false,
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.patch('/order', authenticateApiKey, async (req, res) => {
  const db = await Database.getInstance();

  // Retrieve quote details based on the provided quoteId
  const quote = await db
    ?.collection(GX_QUOTE_COLLECTION)
    .findOne({ quoteId: req.body.quoteId });

  // If quote is not found, return an error response
  if (!quote)
    return res
      .status(400)
      .json({ success: false, msg: 'No quote available for this ID' });

  // Check if the quote's userTelegramID matches the provided userTelegramID
  if (quote.userTelegramID !== req.body.userTelegramID)
    return res.status(400).json({
      success: false,
      msg: 'Quote ID is not linked to the provided user Telegram ID',
    });

  // Fetch order details based on the quoteId
  const order = await db
    ?.collection(GX_ORDER_COLLECTION)
    .findOne({ orderId: req.body.quoteId });

  // If an order exists and status is not ready for USD payment, return an error response
  if (order && order.status !== GX_ORDER_STATUS.WAITING_USD)
    return res
      .status(400)
      .json({ msg: 'Status of the order is not ready to process USD payment' });

  try {
    // Calculate token price based on chainId and token address
    const token_price = await getTokenPrice(
      req.body.chainId,
      req.body.tokenAddress,
    );

    // Calculate token amount for the USD investment
    const token_amount = (
      parseFloat(quote.usdFromUsdInvestment) /
      parseFloat(token_price.data.result.usdPrice)
    ).toFixed(2);

    // Update order details with USD-based information
    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.quoteId },
      {
        $set: {
          dateUSD: new Date(),
          status: GX_ORDER_STATUS.PENDING_USD,
          amountUSD: quote.usdFromUsdInvestment,
          tokenAmountUSD: token_amount,
          tokenAddressUSD: req.body.tokenAddress,
          chainIdUSD: req.body.chainId,
        },
      },
      { upsert: false },
    );

    // Send tokens for the USD-based order and retrieve transaction details
    const { data } = await sendTokens(
      req.body.userTelegramID,
      SOURCE_WALLET_ADDRESS,
      token_amount,
      await getPatchWalletAccessToken(),
      0,
      req.body.tokenAddress,
      req.body.chainId,
    );

    // Record the date for the transaction
    const date = new Date();

    // Update order status and transaction details upon successful transaction
    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.quoteId },
      {
        $set: {
          dateUSD: date,
          status: GX_ORDER_STATUS.COMPLETE,
          transactionHash_USD: data.txHash,
          userOpHash_USD: data.userOpHash,
        },
      },
      { upsert: false },
    );

    // Return success response with processed order details
    return res.status(200).json({
      success: true,
      order: {
        orderId: req.body.quoteId,
        dateUSD: date,
        status: GX_ORDER_STATUS.COMPLETE,
        userTelegramID: req.body.userTelegramID,
        transactionHash_USD: data.txHash,
        userOpHash_USD: data.userOpHash,
        amountUSD: quote.usdFromUsdInvestment,
        tokenAmountUSD: token_amount,
        tokenAddressUSD: req.body.tokenAddress,
        chainIdUSD: req.body.chainId,
      },
    });
  } catch (e) {
    // Log error if transaction fails and update order status to failure
    console.error(
      `[${req.body.quoteId}] Error processing PatchWallet order G1 transaction: ${e}`,
    );

    // Update order status to failure in case of transaction error
    await db?.collection(GX_ORDER_COLLECTION).updateOne(
      { orderId: req.body.quoteId },
      {
        $set: {
          orderId: req.body.quoteId,
          dateUSD: new Date(),
          status: GX_ORDER_STATUS.FAILURE_USD,
          userTelegramID: req.body.userTelegramID,
        },
      },
      { upsert: false },
    );

    // Return error response if an error occurs during the order processing
    return res
      .status(500)
      .json({ success: false, msg: 'An error occurred', error: e });
  }
});

/**
 * GET /v1/tge/orders
 *
 * @summary Get all orders for a specific user
 * @description Retrieves all orders associated with a specific user identified by userTelegramID.
 * @tags Orders
 * @security BearerAuth
 * @param {string} req.query.userTelegramID - The Telegram ID of the user to fetch orders.
 * @return {object[]} 200 - Success response with an array of orders for the specified user
 * @return {object} 404 - Error response if no orders are found for the given user
 * @return {object} 500 - Error response if an error occurs during order retrieval
 *
 * @example request - 200 - Example request query parameter
 * /v1/tge/orders?userTelegramID=user-telegram-id
 *
 * @example response - 200 - Success response example
 * [
 *   {
 *     "orderId": "order-id-1",
 *     "date": "2023-12-31T12:00:00Z",
 *     "status": "PENDING",
 *     "userTelegramID": "user-telegram-id",
 *     "tokenAmountG1": "1000.00",
 *     "transactionHashG1": "transaction-hash",
 *     "userOpHashG1": "user-operation-hash"
 *   },
 *   {
 *     "orderId": "order-id-2",
 *     "date": "2023-12-30T12:00:00Z",
 *     "status": "COMPLETE",
 *     "userTelegramID": "user-telegram-id",
 *     "tokenAmountG1": "500.00",
 *     "transactionHashG1": "transaction-hash",
 *     "userOpHashG1": "user-operation-hash"
 *   },
 *   // ...other orders
 * ]
 *
 * @example response - 404 - Error response example
 * {
 *   "msg": "No orders found for this user"
 * }
 *
 * @example response - 500 - Error response example
 * {
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.get('/orders', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();

    return res
      .status(200)
      .json(
        await db
          ?.collection(GX_ORDER_COLLECTION)
          .find({ userTelegramID: req.query.userTelegramID })
          .toArray(),
      );
  } catch (error) {
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

/**
 * GET /v1/tge/quotes
 *
 * @summary Get all quotes for a specific user
 * @description Retrieves all quotes associated with a specific user identified by userTelegramID.
 * @tags Quotes
 * @security BearerAuth
 * @param {string} req.query.userTelegramID - The Telegram ID of the user to fetch quotes.
 * @return {object[]} 200 - Success response with an array of quotes for the specified user
 * @return {object} 404 - Error response if no quotes are found for the given user
 * @return {object} 500 - Error response if an error occurs during quote retrieval
 *
 * @example request - 200 - Example request query parameter
 * /v1/tge/quotes?userTelegramID=user-telegram-id
 *
 * @example response - 200 - Success response example
 * [
 *   {
 *     "quoteId": "quote-id-1",
 *     "date": "2023-12-31T12:00:00Z",
 *     "usdFromUsdInvestment": "10",
 *     // ...other fields
 *   },
 *   {
 *     "quoteId": "quote-id-2",
 *     "date": "2023-12-30T12:00:00Z",
 *     "usdFromUsdInvestment": "20",
 *     // ...other fields
 *   },
 *   // ...other quotes
 * ]
 *
 * @example response - 404 - Error response example
 * {
 *   "msg": "No quotes found for this user"
 * }
 *
 * @example response - 500 - Error response example
 * {
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.get('/quotes', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();

    return res
      .status(200)
      .json(
        await db
          ?.collection(GX_QUOTE_COLLECTION)
          .find({ userTelegramID: req.query.userTelegramID })
          .toArray(),
      );
  } catch (error) {
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

/**
 * GET /v1/tge/order
 *
 * @summary Get the status of a Gx token order
 * @description Retrieves the status of a Gx token order based on the order ID and associated quote.
 * @tags Order Status
 * @security BearerAuth
 * @param {string} req.query.orderId - The order ID to fetch the status.
 * @return {object} 200 - Success response with the merged order and quote details
 * @return {object} 404 - Error response if either order or quote not found
 * @return {object} 500 - Error response if an error occurs during status retrieval
 *
 * @example request - 200 - Example request query parameter
 * /v1/tge/order?orderId=mocked-order-id
 *
 * @example response - 200 - Success response example
 * {
 *   "orderId": "mocked-order-id",
 *   "status": "COMPLETE",
 *   "quoteId": "mocked-quote-id",
 *   "tokenAmountG1": "1000.00",
 *   "usdFromUsdInvestment": "1",
 *   "usdFromG1Investment": "1",
 *   "usdFromMvu": "1",
 *   "usdFromTime": "1",
 *   "equivalentUsdInvested": "1",
 *   "gxBeforeMvu": "1",
 *   "gxMvuEffect": "1",
 *   "gxTimeEffect": "1",
 *   "GxUsdExchangeRate": "1",
 *   "standardGxUsdExchangeRate": "1",
 *   "discountReceived": "1",
 *   "gxReceived": "1",
 *   "userTelegramID": "user-telegram-id"
 * }
 *
 * @example response - 404 - Error response example
 * {
 *   "msg": "Order or quote not found"
 * }
 *
 * @example response - 500 - Error response example
 * {
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.get('/order', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();

    const [order, quote] = await Promise.all([
      db
        ?.collection(GX_ORDER_COLLECTION)
        .findOne({ orderId: req.query.orderId }),
      db
        ?.collection(GX_QUOTE_COLLECTION)
        .findOne({ quoteId: req.query.orderId }),
    ]);

    if (!order || !quote) {
      return res.status(404).json({ msg: 'Order or quote not found' });
    }

    return res.status(200).json({ ...order, ...quote });
  } catch (error) {
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

export default router;
