/* global module */

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    package: 'com.rotmansells.vseprozhar',
  },
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_URL,
    devIdentityBypass: process.env.EXPO_PUBLIC_DEV_AUTH_BYPASS,
  },
});
