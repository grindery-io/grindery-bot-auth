module.exports = {
  timeout: 100000,
  exit: true,
  require: [
    'ts-node/register', // Activer la compilation TypeScript au moment de l'exécution
    './src/test/hooks.ts', // Spécifie le chemin vers le fichier de hooks
  ],
  'async-only': true,
  retries: parseInt(process.env.RETRIES),
};
