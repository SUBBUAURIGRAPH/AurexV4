/**
 * AccessibleOrderForm Component
 * Enhanced version of OrderForm with full WCAG 2.1 AA accessibility compliance
 *
 * Features:
 * - Screen reader support with descriptive ARIA labels
 * - Haptic feedback for interactions
 * - Text scaling support
 * - High contrast mode
 * - Keyboard navigation
 * - Error announcements
 * - Dynamic field visibility based on order type
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { useAccessibility } from '../hooks/useAccessibility';
import { OrderType, OrderSide } from '../types/index';
import {
  validateOrder,
  validateField,
  getRequiredFieldsForOrderType,
  getOrderTypeFieldConfig,
  calculateEstimatedCost,
  getOrderDescription,
  OrderInput,
  ValidationError,
} from '../utils/orderValidation';
import {
  generateFieldAccessibilityHint,
  getOrderTypeLabel,
  getOrderSideLabel,
  getMinimumTouchTargetSize,
  scaleFontSize,
  HapticFeedbackType,
  announceForAccessibility,
  getAccessibilityRole,
} from '../utils/accessibility';

// ==================== Types ====================

interface AccessibleOrderFormProps {
  onSubmit: (order: OrderInput) => void;
  isLoading?: boolean;
  initialValues?: Partial<OrderInput>;
  onCancel?: () => void;
  showDescription?: boolean;
}

interface FormState {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  price: string;
  stopPrice: string;
  limitPrice: string;
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  notes: string;
}

interface FieldErrors {
  [key: string]: ValidationError | null;
}

// ==================== Styles ====================

const COLORS = {
  dark: '#0F172A',
  darkCard: '#1E293B',
  darkBorder: '#334155',
  darkBorderLight: '#475569',
  textPrimary: '#ffffff',
  textSecondary: '#E5E7EB',
  textTertiary: '#9CA3AF',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  primary: '#0066CC',
  primaryLight: '#3B82F6',
};

const MIN_TOUCH_SIZE = 44;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark,
  },
  scrollView: {
    flexGrow: 1,
  },
  content: {
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 16,
  },
  sectionTitleAccessible: {
    fontSize: 18,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  labelAccessible: {
    fontSize: 16,
  },
  labelRequired: {
    color: COLORS.error,
  },
  input: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 2,
    borderColor: COLORS.darkBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
    minHeight: MIN_TOUCH_SIZE,
  },
  inputAccessible: {
    fontSize: 16,
    paddingVertical: 14,
    minHeight: 48,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: COLORS.error,
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },
  errorTextAccessible: {
    fontSize: 14,
  },
  warningText: {
    fontSize: 12,
    color: COLORS.warning,
    marginTop: 4,
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: COLORS.darkCard,
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_SIZE,
  },
  segmentButtonActive: {
    backgroundColor: COLORS.primary,
  },
  segmentButtonInactive: {
    backgroundColor: 'transparent',
  },
  segmentButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  segmentButtonTextActive: {
    color: COLORS.textPrimary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_SIZE,
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.darkBorder,
    opacity: 0.5,
  },
  submitButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  estimatedCostContainer: {
    backgroundColor: COLORS.darkCard,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  estimatedCostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  estimatedCostLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  estimatedCostValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  descriptionText: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 4,
    fontStyle: 'italic',
  },
});

// ==================== Component ====================

export const AccessibleOrderForm: React.FC<AccessibleOrderFormProps> = ({
  onSubmit,
  isLoading = false,
  initialValues,
  onCancel,
  showDescription = true,
}) => {
  const { config, announce, haptic } = useAccessibility();

  const [formState, setFormState] = useState<FormState>({
    symbol: initialValues?.symbol || '',
    side: initialValues?.side || 'buy',
    type: initialValues?.type || 'market',
    quantity: initialValues?.quantity?.toString() || '',
    price: '',
    stopPrice: '',
    limitPrice: '',
    timeInForce: 'day',
    notes: '',
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  /**
   * Handle field change with validation
   */
  const handleFieldChange = useCallback(
    async (field: keyof FormState, value: any) => {
      setFormState(prev => ({ ...prev, [field]: value }));

      // Validate field
      const error = validateField(field, value);
      setFieldErrors(prev => ({ ...prev, [field]: error }));

      // Announce error to screen reader
      if (error && config.screenReaderEnabled) {
        await announce(`${field} error: ${error.message}`, 'high');
      }
    },
    [config.screenReaderEnabled, announce]
  );

  /**
   * Handle order type change
   */
  const handleOrderTypeChange = useCallback(
    async (newType: OrderType) => {
      setFormState(prev => ({ ...prev, type: newType }));
      await haptic(HapticFeedbackType.LIGHT);

      if (config.screenReaderEnabled) {
        const label = getOrderTypeLabel(newType);
        await announce(label);
      }
    },
    [haptic, config.screenReaderEnabled, announce]
  );

  /**
   * Handle order side change
   */
  const handleOrderSideChange = useCallback(
    async (newSide: OrderSide) => {
      setFormState(prev => ({ ...prev, side: newSide }));
      await haptic(HapticFeedbackType.LIGHT);

      if (config.screenReaderEnabled) {
        const label = getOrderSideLabel(newSide);
        await announce(label);
      }
    },
    [haptic, config.screenReaderEnabled, announce]
  );

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async () => {
    // Validate entire form
    const validation = validateOrder(formState as OrderInput);

    if (!validation.isValid) {
      setFieldErrors(validation.errors);

      if (config.screenReaderEnabled) {
        await announce('Form validation failed. Please check errors.', 'high');
      }

      await haptic(HapticFeedbackType.ERROR);
      return;
    }

    await haptic(HapticFeedbackType.SUCCESS);
    if (config.screenReaderEnabled) {
      await announce('Order submitted successfully');
    }

    onSubmit(formState as OrderInput);
  }, [formState, config.screenReaderEnabled, announce, haptic, onSubmit]);

  /**
   * Get required fields for current order type
   */
  const requiredFields = useMemo(
    () => getRequiredFieldsForOrderType(formState.type),
    [formState.type]
  );

  /**
   * Calculate estimated cost
   */
  const estimatedCost = useMemo(
    () => calculateEstimatedCost(formState as OrderInput),
    [formState]
  );

  /**
   * Get order description
   */
  const orderDescription = useMemo(
    () => (showDescription ? getOrderDescription(formState as OrderInput) : null),
    [formState, showDescription]
  );

  const scaledFontSize = scaleFontSize(14, config.textScalingFactor);
  const scaledLabelSize = scaleFontSize(13, config.textScalingFactor);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        accessibilityLabel="Order form"
        accessibilityRole="form"
      >
        {/* Order Type Selection */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              config.textScalingFactor > 1 && styles.sectionTitleAccessible,
            ]}
            accessibilityRole="header"
            accessibilityLabel="Order Type"
          >
            Order Type
          </Text>

          <View
            style={styles.segmentControl}
            accessible={true}
            accessibilityRole="radiogroup"
            accessibilityLabel="Select order type"
          >
            {(['market', 'limit', 'stop', 'stop-limit', 'trailing-stop'] as OrderType[]).map(
              type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.segmentButton,
                    formState.type === type
                      ? styles.segmentButtonActive
                      : styles.segmentButtonInactive,
                  ]}
                  onPress={() => handleOrderTypeChange(type)}
                  accessible={true}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: formState.type === type }}
                  accessibilityLabel={`${type} order`}
                  accessibilityHint={getOrderTypeLabel(type)}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      formState.type === type && styles.segmentButtonTextActive,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </View>

        {/* Order Side Selection */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              config.textScalingFactor > 1 && styles.sectionTitleAccessible,
            ]}
            accessibilityRole="header"
            accessibilityLabel="Order Side"
          >
            Order Side
          </Text>

          <View
            style={[styles.segmentControl, { width: '100%' }]}
            accessible={true}
            accessibilityRole="radiogroup"
            accessibilityLabel="Buy or Sell"
          >
            {(['buy', 'sell'] as OrderSide[]).map(side => (
              <TouchableOpacity
                key={side}
                style={[
                  styles.segmentButton,
                  formState.side === side
                    ? styles.segmentButtonActive
                    : styles.segmentButtonInactive,
                ]}
                onPress={() => handleOrderSideChange(side)}
                accessible={true}
                accessibilityRole="radio"
                accessibilityState={{ selected: formState.side === side }}
                accessibilityLabel={`${side} order`}
                accessibilityHint={getOrderSideLabel(side)}
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    formState.side === side && styles.segmentButtonTextActive,
                  ]}
                >
                  {side === 'buy' ? '📈 Buy' : '📉 Sell'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Symbol Input */}
        <View style={styles.fieldGroup}>
          <Text
            style={[
              styles.label,
              config.textScalingFactor > 1 && styles.labelAccessible,
            ]}
          >
            Symbol <Text style={styles.labelRequired}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              config.textScalingFactor > 1 && styles.inputAccessible,
              focusedField === 'symbol' && styles.inputFocused,
              fieldErrors.symbol && styles.inputError,
            ]}
            placeholder="e.g., AAPL"
            placeholderTextColor={COLORS.textTertiary}
            value={formState.symbol}
            onChangeText={v => handleFieldChange('symbol', v)}
            onFocus={() => setFocusedField('symbol')}
            onBlur={() => setFocusedField(null)}
            accessible={true}
            accessibilityLabel="Stock symbol"
            accessibilityRole="textbox"
            accessibilityHint={generateFieldAccessibilityHint(
              'Symbol',
              'text',
              true,
              fieldErrors.symbol?.message
            )}
          />
          {fieldErrors.symbol && (
            <Text
              style={[
                styles.errorText,
                config.textScalingFactor > 1 && styles.errorTextAccessible,
              ]}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {fieldErrors.symbol.message}
            </Text>
          )}
        </View>

        {/* Quantity Input */}
        <View style={styles.fieldGroup}>
          <Text
            style={[
              styles.label,
              config.textScalingFactor > 1 && styles.labelAccessible,
            ]}
          >
            Quantity <Text style={styles.labelRequired}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              config.textScalingFactor > 1 && styles.inputAccessible,
              focusedField === 'quantity' && styles.inputFocused,
              fieldErrors.quantity && styles.inputError,
            ]}
            placeholder="Number of shares"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="decimal-pad"
            value={formState.quantity}
            onChangeText={v => handleFieldChange('quantity', v)}
            onFocus={() => setFocusedField('quantity')}
            onBlur={() => setFocusedField(null)}
            accessible={true}
            accessibilityLabel="Order quantity"
            accessibilityRole="textbox"
            accessibilityHint={generateFieldAccessibilityHint(
              'Quantity',
              'number',
              true,
              fieldErrors.quantity?.message
            )}
          />
          {fieldErrors.quantity && (
            <Text
              style={[
                styles.errorText,
                config.textScalingFactor > 1 && styles.errorTextAccessible,
              ]}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {fieldErrors.quantity.message}
            </Text>
          )}
        </View>

        {/* Conditional Price Fields */}
        {requiredFields.includes('price') && (
          <View style={styles.fieldGroup}>
            <Text
              style={[
                styles.label,
                config.textScalingFactor > 1 && styles.labelAccessible,
              ]}
            >
              Price <Text style={styles.labelRequired}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                config.textScalingFactor > 1 && styles.inputAccessible,
                focusedField === 'price' && styles.inputFocused,
                fieldErrors.price && styles.inputError,
              ]}
              placeholder="Limit price"
              placeholderTextColor={COLORS.textTertiary}
              keyboardType="decimal-pad"
              value={formState.price}
              onChangeText={v => handleFieldChange('price', v)}
              onFocus={() => setFocusedField('price')}
              onBlur={() => setFocusedField(null)}
              accessible={true}
              accessibilityLabel="Limit price"
              accessibilityRole="textbox"
              accessibilityHint={generateFieldAccessibilityHint(
                'Price',
                'currency',
                true,
                fieldErrors.price?.message
              )}
            />
            {fieldErrors.price && (
              <Text
                style={[
                  styles.errorText,
                  config.textScalingFactor > 1 && styles.errorTextAccessible,
                ]}
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
              >
                {fieldErrors.price.message}
              </Text>
            )}
          </View>
        )}

        {/* Estimated Cost Display */}
        <View
          style={styles.estimatedCostContainer}
          accessible={true}
          accessibilityLabel="Order summary"
          accessibilityRole="summary"
        >
          <View style={styles.estimatedCostRow}>
            <Text style={styles.estimatedCostLabel}>Estimated Cost:</Text>
            <Text
              style={styles.estimatedCostValue}
              accessibilityLabel={`Estimated cost: $${estimatedCost.totalCost.toFixed(2)}`}
            >
              ${estimatedCost.totalCost.toFixed(2)}
            </Text>
          </View>
          <View style={styles.estimatedCostRow}>
            <Text style={styles.estimatedCostLabel}>Commission:</Text>
            <Text
              style={styles.estimatedCostValue}
              accessibilityLabel={`Commission: $${estimatedCost.commission.toFixed(2)}`}
            >
              ${estimatedCost.commission.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Order Description */}
        {orderDescription && (
          <Text
            style={styles.descriptionText}
            accessibilityLiveRegion="polite"
            accessibilityLabel="Order description"
          >
            {orderDescription}
          </Text>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (isLoading || Object.values(fieldErrors).some(e => e)) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isLoading}
          accessible={true}
          accessibilityLabel="Submit order"
          accessibilityRole="button"
          accessibilityState={{
            disabled: isLoading,
            busy: isLoading,
          }}
          accessibilityHint="Submit your trading order"
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <Text style={styles.submitButtonText}>Place Order</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AccessibleOrderForm;
