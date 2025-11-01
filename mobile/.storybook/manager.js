/**
 * Storybook Configuration - Manager
 * UI customization and branding
 */

import { addons } from '@storybook/manager-api';
import { create } from '@storybook/theming';

const hermesTheme = create({
  base: 'dark',

  // Brand
  brandTitle: 'Hermes Trading Platform',
  brandUrl: 'https://hermestradingplatform.com',
  brandImage: undefined,
  brandTarget: '_self',

  // Colors
  colorPrimary: '#0066CC',
  colorSecondary: '#3B82F6',

  // UI
  appBg: '#0F172A',
  appContentBg: '#1E293B',
  appBorderColor: '#334155',
  appBorderRadius: 8,

  // Typography
  fontBase: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontCode: '"Fira Code", "Courier New", monospace',

  // Text colors
  textColor: '#E5E7EB',
  textInverseColor: '#0F172A',
  textMutedColor: '#9CA3AF',

  // Toolbar default and active colors
  barTextColor: '#9CA3AF',
  barSelectedColor: '#0066CC',
  barBg: '#1E293B',

  // Form colors
  inputBg: '#0F172A',
  inputBorder: '#334155',
  inputTextColor: '#E5E7EB',
  inputBorderRadius: 6,
});

addons.setConfig({
  theme: hermesTheme,
  panelPosition: 'bottom',
  enableShortcuts: true,
  showNav: true,
  showPanel: true,
  showToolbar: true,
  sidebar: {
    showRoots: true,
    collapsedRoots: [],
  },
  toolbar: {
    title: { hidden: false },
    zoom: { hidden: false },
    eject: { hidden: false },
    copy: { hidden: false },
    fullscreen: { hidden: false },
  },
});
