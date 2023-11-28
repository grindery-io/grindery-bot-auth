"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express_1 = tslib_1.__importDefault(require("express"));
const conn_1 = require("../db/conn");
const auth_1 = require("../utils/auth");
const constants_1 = require("../utils/constants");
const router = express_1.default.Router();
router.post('/attributes', auth_1.authenticateApiKey, async (req, res) => {
    try {
        const db = await conn_1.Database.getInstance();
        if (!Array.isArray(req.body)) {
            return res.status(400).send({
                msg: 'Request body should contain an array of attribute objects.',
            });
        }
        const isValid = req.body.every((update) => {
            const { userTelegramID, attributeNames } = update;
            return (Array.isArray(attributeNames) && typeof userTelegramID === 'string');
        });
        if (!isValid) {
            return res.status(400).send({
                msg: 'Each item in the array should have "userTelegramID" as string, "attributeNames" as an array.',
            });
        }
        const bulkOperations = req.body.map((update) => ({
            updateOne: {
                filter: { userTelegramID: update.userTelegramID },
                update: { $set: { attributes: update.attributeNames } },
                upsert: true,
            },
        }));
        const result = await db
            .collection(constants_1.USERS_COLLECTION)
            .bulkWrite(bulkOperations);
        return res.status(200).send({
            msg: 'Updates successful',
            result,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).send({ msg: 'An error occurred', error });
    }
});
router.get('/attributes', auth_1.authenticateApiKey, async (req, res) => {
    try {
        const { userTelegramID } = req.query;
        if (!userTelegramID) {
            return res.status(400).send({
                msg: 'User Telegram ID is required.',
            });
        }
        const db = await conn_1.Database.getInstance();
        const user = await db
            .collection(constants_1.USERS_COLLECTION)
            .findOne({ userTelegramID });
        return res.status(200).send({
            userTelegramID,
            attributes: user?.attributes,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).send({ msg: 'An error occurred', error });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map