// eslint-disable-next-line no-undef
module.exports = {
  apps: [
    {
      name: 'mongo-prod',
      script: './run-mongodb-prod',
      interpreter: '/bin/bash',
    },
    {
      name: 'node-aggregator',
      script: 'npm run build && ./dist/run-local.js',
      env: {
        DEBUG: 'poi:*',
      },
    },
  ],
};
