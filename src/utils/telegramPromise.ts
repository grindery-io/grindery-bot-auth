const createTelegramPromise = () => {
  let resolve: (value: unknown) => void, reject: (reason?: any) => void;
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return { resolve, reject, promise };
};

export default createTelegramPromise;
