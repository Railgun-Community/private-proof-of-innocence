// eslint-disable-next-line no-undef
module.exports = {
  apps: [
    {
      name: 'node-aggregator',
      script: './dist/main.js',
      env: {
        DEBUG: 'poi:*',
        DEBUG_COLORS: true,
      },
    },
  ],
};
