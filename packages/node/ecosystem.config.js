// eslint-disable-next-line no-undef
module.exports = {
  apps: [
    {
      name: 'node',
      script: './dist/run-local.js',
      env: {
        DEBUG: 'poi:*',
      },
    },
    {
      name: 'mongo',
      script: './run-mongodb-prod',
      interpreter: '/bin/bash',
    },
  ],
};
