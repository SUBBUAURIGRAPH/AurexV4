/**
 * Storybook Configuration - Main
 * React Native Storybook setup for Hermes Trading Platform
 */

module.exports = {
  stories: [
    '../src/components/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../src/components/stories/**/*.stories.@(js|jsx|ts|tsx|mdx)',
  ],
  addons: [
    '@storybook/addon-ondevice-controls',
    '@storybook/addon-ondevice-actions',
    '@storybook/addon-ondevice-backgrounds',
    '@storybook/addon-ondevice-notes',
    {
      name: '@storybook/addon-react-native-web',
      options: {
        modulesToTranspile: ['react-native-reanimated', 'react-native-gesture-handler'],
      },
    },
  ],
  framework: {
    name: '@storybook/react-native',
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  reactNativeServerOptions: {
    host: 'localhost',
    port: 7007,
  },
};
