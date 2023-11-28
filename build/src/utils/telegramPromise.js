"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const createTelegramPromise = () => {
    let resolve, reject;
    const promise = new Promise((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
    });
    return { resolve, reject, promise };
};
exports.default = createTelegramPromise;
//# sourceMappingURL=telegramPromise.js.map