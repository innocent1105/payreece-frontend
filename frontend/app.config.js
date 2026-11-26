export default ({ config }) => ({
  ...config,

  name: "Payreece",
  slug: "ipay",

  android: {
    ...config.android,
    package: "com.innocent1105.payreece",
  },

  extra: {
    ...(config.extra || {}),
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.81/ipay',
    eas: {
      projectId: "3fd37782-1a81-4e33-8e0e-732aa7c10b03",
    },
  },
});
