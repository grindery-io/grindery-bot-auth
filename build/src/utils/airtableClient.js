"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.base = void 0;
const tslib_1 = require("tslib");
const airtable_1 = tslib_1.__importDefault(require("airtable"));
const secrets_1 = require("../../secrets");
exports.base = new airtable_1.default({ apiKey: secrets_1.AIRTABLE_API_KEY }).base(secrets_1.AIRTABLE_BASE_ID);
//# sourceMappingURL=airtableClient.js.map