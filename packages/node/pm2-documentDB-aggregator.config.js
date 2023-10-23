// eslint-disable-next-line no-undef
module.exports = {
  apps: [
    {
      name: 'node-aggregator',
      time: true,
      script: './dist/main.js',
      env: {
        DEBUG: 'poi:*',
        DEBUG_COLORS: true,
      },
    },
  ],
};
