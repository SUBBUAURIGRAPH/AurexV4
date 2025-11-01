/**
 * Storybook Configuration - Preview
 * Global decorators, parameters, and story configuration
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

// Global decorator for dark theme background
export const decorators = [
  (Story) => (
    <View style={styles.container}>
      <Story />
    </View>
  ),
];

// Global parameters
export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
    expanded: true,
    sort: 'requiredFirst',
  },
  backgrounds: {
    default: 'dark',
    values: [
      {
        name: 'dark',
        value: '#0F172A',
      },
      {
        name: 'light',
        value: '#FFFFFF',
      },
      {
        name: 'darkCard',
        value: '#1E293B',
      },
    ],
  },
  layout: 'centered',
  viewport: {
    viewports: {
      mobile: {
        name: 'Mobile',
        styles: {
          width: '375px',
          height: '667px',
        },
      },
      mobileLarge: {
        name: 'Mobile Large',
        styles: {
          width: '414px',
          height: '896px',
        },
      },
      tablet: {
        name: 'Tablet',
        styles: {
          width: '768px',
          height: '1024px',
        },
      },
    },
    defaultViewport: 'mobile',
  },
  // Accessibility addon configuration
  a11y: {
    element: '#storybook-root',
    config: {
      rules: [
        {
          id: 'color-contrast',
          enabled: true,
        },
        {
          id: 'label',
          enabled: true,
        },
        {
          id: 'button-name',
          enabled: true,
        },
      ],
    },
    options: {
      checks: { 'color-contrast': { options: { noScroll: true } } },
      restoreScroll: true,
    },
  },
  // Documentation
  docs: {
    extractComponentDescription: (component, { notes }) => {
      if (notes) {
        return typeof notes === 'string' ? notes : notes.markdown || notes.text;
      }
      return null;
    },
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 16,
    minHeight: 600,
  },
});
