module.exports = {
  timeout: 100000,
  exit: true,
  require: ['ts-node/register', './src/test/hooks.ts'],
  'async-only': true,
  retries: parseInt(process.env.RETRIES),
};
