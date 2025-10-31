/**
 * AccessibilityContext & Provider
 * Manages accessibility settings and features across the app
 *
 * WCAG 2.1 AA Compliance Features:
 * - Screen reader support
 * - Haptic feedback control
 * - Text scaling
 * - Reduced motion preferences
 * - High contrast mode
 * - Bold text support
 */

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AccessibilityConfig,
  createAccessibilityConfig,
  isScreenReaderEnabled,
} from '../utils/accessibility';

interface AccessibilityContextType {
  config: AccessibilityConfig;
  updateConfig: (partial: Partial<AccessibilityConfig>) => Promise<void>;
  resetConfig: () => Promise<void>;
  isLoading: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const STORAGE_KEY = '@HMS_Accessibility_Settings';

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [config, setConfig] = useState<AccessibilityConfig>(
    createAccessibilityConfig()
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load accessibility settings from storage on app start
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);

        // Check screen reader status
        const srEnabled = await isScreenReaderEnabled();

        // Load saved settings
        const savedSettings = await AsyncStorage.getItem(STORAGE_KEY);
        const savedConfig = savedSettings ? JSON.parse(savedSettings) : {};

        setConfig(
          createAccessibilityConfig({
            screenReaderEnabled: srEnabled || savedConfig.screenReaderEnabled,
            reduceMotionEnabled: savedConfig.reduceMotionEnabled ?? false,
            highContrastEnabled: savedConfig.highContrastEnabled ?? false,
            textScalingFactor: savedConfig.textScalingFactor ?? 1.0,
            boldTextEnabled: savedConfig.boldTextEnabled ?? false,
          })
        );
      } catch (error) {
        console.warn('Failed to load accessibility settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  /**
   * Update accessibility configuration
   */
  const updateConfig = useCallback(
    async (partial: Partial<AccessibilityConfig>) => {
      try {
        const newConfig = { ...config, ...partial };
        setConfig(newConfig);

        // Persist to storage
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      } catch (error) {
        console.warn('Failed to save accessibility settings:', error);
      }
    },
    [config]
  );

  /**
   * Reset to default settings
   */
  const resetConfig = useCallback(async () => {
    try {
      const defaultConfig = createAccessibilityConfig();
      setConfig(defaultConfig);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to reset accessibility settings:', error);
    }
  }, []);

  const value: AccessibilityContextType = {
    config,
    updateConfig,
    resetConfig,
    isLoading,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};

/**
 * Hook to use accessibility context
 */
export const useAccessibilityContext = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error(
      'useAccessibilityContext must be used within AccessibilityProvider'
    );
  }
  return context;
};

export default AccessibilityContext;
