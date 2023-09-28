// eslint-disable-next-line no-undef
module.exports = {
  apps: [
    {
      name: 'node-aggregator',
      script: './dist/run-local.js',
      env: {
        DEBUG: 'poi:*',
      },
    },
    {
      name: 'node-list-provider',
      script: './dist/run-local.js',
      env: {
        DEBUG: 'poi:*',
        LIST_PROVIDER: '1',
      },
    },
    {
      name: 'mongo-prod',
      script: './run-mongodb-prod',
      interpreter: '/bin/bash',
    },
  ],
};
