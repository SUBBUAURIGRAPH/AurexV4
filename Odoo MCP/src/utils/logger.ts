/**
 * Simple logger utility
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = LOG_LEVELS[(process.env.LOG_LEVEL as keyof typeof LOG_LEVELS) || 'info'];

export const logger = {
  error: (...args: any[]) => {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error('[ERROR]', new Date().toISOString(), ...args);
    }
  },

  warn: (...args: any[]) => {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn('[WARN]', new Date().toISOString(), ...args);
    }
  },

  info: (...args: any[]) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log('[INFO]', new Date().toISOString(), ...args);
    }
  },

  debug: (...args: any[]) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
  },
};
