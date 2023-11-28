"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const web3_1 = tslib_1.__importDefault(require("web3"));
const express_1 = tslib_1.__importDefault(require("express"));
const ERC20_json_1 = tslib_1.__importDefault(require("./abi/ERC20.json"));
const bignumber_js_1 = tslib_1.__importDefault(require("bignumber.js"));
const chains_1 = require("../utils/chains");
const auth_1 = require("../utils/auth");
const patchwallet_1 = require("../utils/patchwallet");
const router = express_1.default.Router();
/**
 * POST /v1/data/
 *
 * @summary Encode Function Call to ERC20 ABI Data
 * @description Convert a function call and its arguments into an ABI-encoded data for ERC20 smart contracts.
 * @tags Data
 * @param {object} request.body - The request body containing necessary information.
 * @return {object} 200 - Success response
 * @return {object} 400 - Error response
 * @example request - 200 - Example request body
 * {
 *   "contractAddress": "0xfe4F5145f6e09952a5ba9e956ED0C25e3Fa4c7F1",
 *   "function": "transfer",
 *   "inputs": ["0x5c9fAf85F1bCFF9aE11F1f60ADEeBD1f851469a5", "1"]
 * }
 * @example response - 200 - Success response example
 * {
 *   "encodedData": "0x..."
 * }
 * @example response - 400 - Error response example
 * {
 *   "error": "Function not found in contract ABI."
 * }
 */
router.post('/', async (req, res) => {
    try {
        const web3 = new web3_1.default();
        const contract = new web3.eth.Contract(ERC20_json_1.default, req.body.contractAddress);
        const targetFunction = contract.methods[req.body.function];
        if (!targetFunction) {
            return res
                .status(400)
                .json({ error: 'Function not found in contract ABI.' });
        }
        const inputArguments = req.body.inputs || [];
        return res
            .status(200)
            .json({ encodedData: targetFunction(...inputArguments).encodeABI() });
    }
    catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
});
router.post('/balance', async (req, res) => {
    try {
        // Check for the presence of all required fields in the request body
        const requiredFields = ['chainId', 'contractAddress', 'userAddress'];
        for (const field of requiredFields) {
            if (!req.body[field]) {
                return res.status(400).json({
                    message: `Missing required field: ${field}`,
                });
            }
        }
        // Check if the chainId is valid
        if (!chains_1.CHAIN_MAPPING[req.body.chainId]) {
            return res.status(400).json({
                message: 'Invalid chainId provided.',
            });
        }
        // Check if the wallet address is valid
        if (!web3_1.default.utils.isAddress(req.body.userAddress)) {
            return res.status(400).json({
                message: 'Provided wallet address is not a valid address.',
            });
        }
        const web3 = new web3_1.default(chains_1.CHAIN_MAPPING[req.body.chainId][1]);
        const contract = new web3.eth.Contract(ERC20_json_1.default, req.body.contractAddress);
        const balance = await contract.methods
            .balanceOf(req.body.userAddress)
            .call();
        return res.status(200).json({
            balanceWei: balance,
            balanceEther: (0, bignumber_js_1.default)(balance)
                .div((0, bignumber_js_1.default)(10).pow((0, bignumber_js_1.default)(await contract.methods.decimals().call())))
                .toString(),
        });
    }
    catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
});
router.post('/patchwallet', async (req, res) => {
    try {
        // Check for the presence of all required fields in the request body
        const requiredFields = ['chainId', 'contractAddress', 'tgId'];
        for (const field of requiredFields) {
            if (!req.body[field]) {
                return res.status(400).json({
                    message: `Missing required field: ${field}`,
                });
            }
        }
        // Check if the chainId is valid
        if (!chains_1.CHAIN_MAPPING[req.body.chainId]) {
            return res.status(400).json({
                message: 'Invalid chainId provided.',
            });
        }
        // Check if the contract address is a valid address
        if (!web3_1.default.utils.isAddress(req.body.contractAddress)) {
            return res.status(400).json({
                message: 'Invalid contract address provided.',
            });
        }
        const web3 = new web3_1.default(chains_1.CHAIN_MAPPING[req.body.chainId][1]);
        const contract = new web3.eth.Contract(ERC20_json_1.default, req.body.contractAddress);
        const patchWalletAddress = await (0, patchwallet_1.getPatchWalletAddressFromTgId)(req.body.tgId);
        const balance = await contract.methods.balanceOf(patchWalletAddress).call();
        return res.status(200).json({
            balanceWei: balance,
            balanceEther: (0, bignumber_js_1.default)(balance)
                .div((0, bignumber_js_1.default)(10).pow((0, bignumber_js_1.default)(await contract.methods.decimals().call())))
                .toString(),
            patchWalletAddress,
        });
    }
    catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
});
router.post('/sendTokens', auth_1.authenticateApiKey, async (req, res) => {
    try {
        return res
            .status(200)
            .json((await (0, patchwallet_1.sendTokens)(req.body.tgId, await (0, patchwallet_1.getPatchWalletAddressFromTgId)(req.body.toTgId), req.body.amount, await (0, patchwallet_1.getPatchWalletAccessToken)())).data);
    }
    catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=bot_data.js.map