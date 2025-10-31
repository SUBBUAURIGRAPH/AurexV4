/**
 * OrderForm Component
 * Comprehensive form for creating trading orders with real-time validation
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
} from 'react-native';
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

// ==================== Types ====================

interface OrderFormProps {
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
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  labelRequired: {
    color: COLORS.error,
  },
  input: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  inputFocused: {
    borderColor: COLORS.primary,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: COLORS.primary,
  },
  segmentButtonInactive: {
    backgroundColor: 'transparent',
  },
  segmentButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  segmentButtonTextActive: {
    color: COLORS.textPrimary,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    minWidth: '48%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    backgroundColor: COLORS.darkCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  typeButtonTextActive: {
    color: COLORS.textPrimary,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priceField: {
    flex: 1,
  },
  estimatedCost: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  estimatedCostLabel: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  estimatedCostValue: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
  },
  descriptionBox: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorderLight,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  descriptionLabel: {
    fontSize: 12,
    color: COLORS.textTertiary,
    fontWeight: '500',
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.darkBorder,
    opacity: 0.5,
  },
  cancelButton: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
  },
});

// ==================== Component ====================

export const OrderForm: React.FC<OrderFormProps> = ({
  onSubmit,
  isLoading = false,
  initialValues,
  onCancel,
  showDescription = true,
}) => {
  // Form state
  const [form, setForm] = useState<FormState>({
    symbol: initialValues?.symbol || 'AAPL',
    side: initialValues?.side || 'buy',
    type: initialValues?.type || 'market',
    quantity: initialValues?.quantity ? String(initialValues.quantity) : '100',
    price: initialValues?.price ? String(initialValues.price) : '',
    stopPrice: initialValues?.stopPrice ? String(initialValues.stopPrice) : '',
    limitPrice: initialValues?.limitPrice ? String(initialValues.limitPrice) : '',
    timeInForce: initialValues?.timeInForce || 'day',
    notes: initialValues?.notes || '',
  });

  // Field error state
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Validation
  const validationResult = useMemo(() => {
    return validateOrder({
      symbol: form.symbol,
      side: form.side,
      type: form.type,
      quantity: form.quantity ? parseFloat(form.quantity) : undefined,
      price: form.price ? parseFloat(form.price) : undefined,
      stopPrice: form.stopPrice ? parseFloat(form.stopPrice) : undefined,
      limitPrice: form.limitPrice ? parseFloat(form.limitPrice) : undefined,
      timeInForce: form.timeInForce,
      notes: form.notes,
    });
  }, [form]);

  const fieldConfig = useMemo(() => getOrderTypeFieldConfig(form.type), [form.type]);

  const estimatedCost = useMemo(
    () =>
      calculateEstimatedCost(
        form.type,
        form.quantity ? parseFloat(form.quantity) : 0,
        form.price ? parseFloat(form.price) : undefined,
        form.stopPrice ? parseFloat(form.stopPrice) : undefined,
        form.limitPrice ? parseFloat(form.limitPrice) : undefined
      ),
    [form]
  );

  const orderDescription = useMemo(
    () =>
      showDescription
        ? getOrderDescription({
            symbol: form.symbol,
            side: form.side,
            type: form.type,
            quantity: form.quantity ? parseFloat(form.quantity) : 0,
            price: form.price ? parseFloat(form.price) : undefined,
            stopPrice: form.stopPrice ? parseFloat(form.stopPrice) : undefined,
            limitPrice: form.limitPrice ? parseFloat(form.limitPrice) : undefined,
          })
        : '',
    [form, showDescription]
  );

  // Field change handler
  const handleFieldChange = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));

      // Real-time validation
      const error = validateField(field, value, {
        symbol: form.symbol,
        side: form.side,
        type: form.type,
        quantity: form.quantity ? parseFloat(form.quantity) : undefined,
        price: form.price ? parseFloat(form.price) : undefined,
        stopPrice: form.stopPrice ? parseFloat(form.stopPrice) : undefined,
        limitPrice: form.limitPrice ? parseFloat(form.limitPrice) : undefined,
      });

      setFieldErrors((prev) => ({
        ...prev,
        [field]: error,
      }));
    },
    [form]
  );

  // Order type change handler
  const handleOrderTypeChange = useCallback((type: OrderType) => {
    setForm((prev) => ({
      ...prev,
      type,
      // Clear price fields when switching types
      price: type === 'limit' || type === 'stop-limit' ? prev.price : '',
      stopPrice: type === 'stop' || type === 'stop-limit' || type === 'trailing-stop' ? prev.stopPrice : '',
      limitPrice: type === 'stop-limit' ? prev.limitPrice : '',
    }));
  }, []);

  // Side change handler (buy/sell)
  const handleSideChange = useCallback((side: OrderSide) => {
    setForm((prev) => ({ ...prev, side }));
  }, []);

  // Form submission
  const handleSubmit = useCallback(() => {
    if (!validationResult.isValid) {
      return;
    }

    const orderData: OrderInput = {
      symbol: form.symbol,
      side: form.side,
      type: form.type,
      quantity: parseInt(form.quantity),
      price: form.price ? parseFloat(form.price) : undefined,
      stopPrice: form.stopPrice ? parseFloat(form.stopPrice) : undefined,
      limitPrice: form.limitPrice ? parseFloat(form.limitPrice) : undefined,
      timeInForce: form.timeInForce as any,
      notes: form.notes || undefined,
    };

    onSubmit(orderData);
  }, [form, validationResult.isValid, onSubmit]);

  const requiredFields = useMemo(() => getRequiredFieldsForOrderType(form.type), [form.type]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Symbol Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ORDER DETAILS</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Symbol <Text style={styles.labelRequired}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  focusedField === 'symbol' && styles.inputFocused,
                  fieldErrors.symbol && styles.inputError,
                ]}
                placeholder="e.g., AAPL, GOOGL"
                placeholderTextColor={COLORS.textTertiary}
                value={form.symbol.toUpperCase()}
                onChangeText={(text) => handleFieldChange('symbol', text.toUpperCase())}
                onFocus={() => setFocusedField('symbol')}
                onBlur={() => setFocusedField(null)}
                editable={!isLoading}
              />
              {fieldErrors.symbol && <Text style={styles.errorText}>{fieldErrors.symbol.message}</Text>}
            </View>
          </View>

          {/* Side Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DIRECTION</Text>
            <View style={styles.segmentControl}>
              {(['buy', 'sell'] as OrderSide[]).map((side) => (
                <TouchableOpacity
                  key={side}
                  style={[
                    styles.segmentButton,
                    form.side === side ? styles.segmentButtonActive : styles.segmentButtonInactive,
                  ]}
                  onPress={() => handleSideChange(side)}
                  disabled={isLoading}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      form.side === side && styles.segmentButtonTextActive,
                    ]}
                  >
                    {side.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Order Type Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ORDER TYPE</Text>
            <View style={styles.typeGrid}>
              {(['market', 'limit', 'stop', 'stop-limit', 'trailing-stop'] as OrderType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    form.type === type && styles.typeButtonActive,
                  ]}
                  onPress={() => handleOrderTypeChange(type)}
                  disabled={isLoading}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      form.type === type && styles.typeButtonTextActive,
                    ]}
                  >
                    {type.replace('-', '-\n').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Quantity Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>QUANTITY & PRICE</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Quantity <Text style={styles.labelRequired}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.input,
                  focusedField === 'quantity' && styles.inputFocused,
                  fieldErrors.quantity && styles.inputError,
                ]}
                placeholder="100"
                placeholderTextColor={COLORS.textTertiary}
                value={form.quantity}
                onChangeText={(text) => handleFieldChange('quantity', text)}
                onFocus={() => setFocusedField('quantity')}
                onBlur={() => setFocusedField(null)}
                keyboardType="decimal-pad"
                editable={!isLoading}
              />
              {fieldErrors.quantity && <Text style={styles.errorText}>{fieldErrors.quantity.message}</Text>}
            </View>

            {/* Conditional Price Fields */}
            {fieldConfig.showPrice && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  Price <Text style={styles.labelRequired}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === 'price' && styles.inputFocused,
                    fieldErrors.price && styles.inputError,
                  ]}
                  placeholder="$150.50"
                  placeholderTextColor={COLORS.textTertiary}
                  value={form.price}
                  onChangeText={(text) => handleFieldChange('price', text)}
                  onFocus={() => setFocusedField('price')}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="decimal-pad"
                  editable={!isLoading}
                />
                {fieldErrors.price && <Text style={styles.errorText}>{fieldErrors.price.message}</Text>}
              </View>
            )}

            {fieldConfig.showStopPrice && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  Stop Price <Text style={styles.labelRequired}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === 'stopPrice' && styles.inputFocused,
                    fieldErrors.stopPrice && styles.inputError,
                  ]}
                  placeholder="$140.00"
                  placeholderTextColor={COLORS.textTertiary}
                  value={form.stopPrice}
                  onChangeText={(text) => handleFieldChange('stopPrice', text)}
                  onFocus={() => setFocusedField('stopPrice')}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="decimal-pad"
                  editable={!isLoading}
                />
                {fieldErrors.stopPrice && <Text style={styles.errorText}>{fieldErrors.stopPrice.message}</Text>}
              </View>
            )}

            {fieldConfig.showLimitPrice && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  Limit Price <Text style={styles.labelRequired}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === 'limitPrice' && styles.inputFocused,
                    fieldErrors.limitPrice && styles.inputError,
                  ]}
                  placeholder="$145.00"
                  placeholderTextColor={COLORS.textTertiary}
                  value={form.limitPrice}
                  onChangeText={(text) => handleFieldChange('limitPrice', text)}
                  onFocus={() => setFocusedField('limitPrice')}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="decimal-pad"
                  editable={!isLoading}
                />
                {fieldErrors.limitPrice && (
                  <Text style={styles.errorText}>{fieldErrors.limitPrice.message}</Text>
                )}
              </View>
            )}
          </View>

          {/* Estimated Cost */}
          {estimatedCost > 0 && (
            <View style={styles.estimatedCost}>
              <Text style={styles.estimatedCostLabel}>ESTIMATED COST</Text>
              <Text style={styles.estimatedCostValue}>${estimatedCost.toFixed(2)}</Text>
            </View>
          )}

          {/* Time In Force Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TIME IN FORCE</Text>
            <View style={styles.segmentControl}>
              {(['day', 'gtc', 'ioc', 'fok'] as const).map((tif) => (
                <TouchableOpacity
                  key={tif}
                  style={[
                    styles.segmentButton,
                    form.timeInForce === tif ? styles.segmentButtonActive : styles.segmentButtonInactive,
                  ]}
                  onPress={() => handleFieldChange('timeInForce', tif)}
                  disabled={isLoading}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      form.timeInForce === tif && styles.segmentButtonTextActive,
                    ]}
                  >
                    {tif.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Order Description */}
          {showDescription && orderDescription && (
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionLabel}>ORDER SUMMARY</Text>
              <Text style={styles.descriptionText}>{orderDescription}</Text>
            </View>
          )}

          {/* Warnings */}
          {validationResult.warnings.map((warning, index) => (
            <Text key={index} style={styles.warningText}>
              ⚠️ {warning.message}
            </Text>
          ))}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {onCancel && (
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
                disabled={isLoading}
              >
                <Text style={[styles.buttonText, styles.cancelButtonText]}>CANCEL</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                (!validationResult.isValid || isLoading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!validationResult.isValid || isLoading}
            >
              {isLoading && <ActivityIndicator color={COLORS.textPrimary} />}
              <Text style={styles.buttonText}>
                {isLoading ? 'CREATING...' : 'CREATE ORDER'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default OrderForm;
