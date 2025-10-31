/**
 * useAccessibility Hook
 * Provides accessibility features and configuration management
 *
 * Usage:
 * const { config, updateConfig, announceMessage, hapticFeedback } = useAccessibility();
 */

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import {
  isScreenReaderEnabled,
  announceForAccessibility,
  triggerHapticFeedback,
  triggerSelectionFeedback,
  HapticFeedbackType,
  getAnimationDuration,
  AccessibilityConfig,
  createAccessibilityConfig,
  calculateColorContrast,
} from '../utils/accessibility';

export const useAccessibility = () => {
  const dispatch = useDispatch();
  const settings = useSelector((state: RootState) => state.settings);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);

  // Initialize screen reader detection
  useEffect(() => {
    const detectScreenReader = async () => {
      const enabled = await isScreenReaderEnabled();
      setScreenReaderEnabled(enabled);
    };
    detectScreenReader();
  }, []);

  // Accessibility configuration from Redux
  const accessibilityConfig = createAccessibilityConfig({
    screenReaderEnabled,
    reduceMotionEnabled: settings?.reduceMotion ?? false,
    highContrastEnabled: settings?.highContrast ?? false,
    textScalingFactor: settings?.textScale ?? 1.0,
    boldTextEnabled: settings?.boldText ?? false,
  });

  /**
   * Announce message to screen reader
   */
  const announce = useCallback(
    async (message: string, priority: 'default' | 'low' | 'high' = 'default') => {
      if (accessibilityConfig.screenReaderEnabled) {
        await announceForAccessibility(message, priority);
      }
    },
    [accessibilityConfig.screenReaderEnabled]
  );

  /**
   * Trigger haptic feedback
   */
  const haptic = useCallback(
    async (type: HapticFeedbackType = HapticFeedbackType.LIGHT) => {
      // Only if haptics not explicitly disabled in settings
      if (settings?.hapticFeedback !== false) {
        await triggerHapticFeedback(type, true);
      }
    },
    [settings?.hapticFeedback]
  );

  /**
   * Trigger selection feedback
   */
  const selectHaptic = useCallback(async () => {
    if (settings?.hapticFeedback !== false) {
      await triggerSelectionFeedback(true);
    }
  }, [settings?.hapticFeedback]);

  /**
   * Get animation duration respecting reduce motion
   */
  const getAnimDuration = useCallback(
    (duration: number = 300): number => {
      return getAnimationDuration(duration, accessibilityConfig.reduceMotionEnabled);
    },
    [accessibilityConfig.reduceMotionEnabled]
  );

  /**
   * Validate color contrast
   */
  const validateContrast = useCallback(
    (foreground: string, background: string): boolean => {
      const contrast = calculateColorContrast(foreground, background);
      return contrast.wcagAA; // At least AA compliance
    },
    []
  );

  return {
    config: accessibilityConfig,
    screenReaderEnabled,
    announce,
    haptic,
    selectHaptic,
    getAnimDuration,
    validateContrast,
  };
};

export default useAccessibility;
