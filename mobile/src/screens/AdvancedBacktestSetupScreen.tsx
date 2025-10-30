/**
 * Advanced Backtest Setup Screen
 * Enhanced setup with advanced order types and parameter optimization
 *
 * Performance Optimizations:
 * - useReducer for form state management (reduced from 11 useState calls)
 * - Better validation with detailed error messages
 * - Improved UX for commission/slippage percentage values
 */

import React, { useEffect, useState, useReducer, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions
} from 'react-native';
import { Text, TextInput, Button, Card, Snackbar, Dialog, Divider, Chip, Switch } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  startBacktest,
  getAvailableSymbols,
  updateSetupForm,
  setActiveScreen,
  selectSetupForm,
  selectAvailableSymbols,
  selectBacktestLoading,
  selectBacktestError
} from '../store/backtestingSlice';
import { AppDispatch, RootState } from '../store';

// State for UI controls (not form data)
interface UIState {
  showStartDatePicker: boolean;
  showEndDatePicker: boolean;
  showSymbolDropdown: boolean;
  showValidationError: string;
  activeTab: 'basic' | 'orders' | 'optimization';
}

// Reducer action types
type UIAction =
  | { type: 'TOGGLE_START_DATE_PICKER' }
  | { type: 'TOGGLE_END_DATE_PICKER' }
  | { type: 'TOGGLE_SYMBOL_DROPDOWN' }
  | { type: 'SET_VALIDATION_ERROR'; payload: string }
  | { type: 'CLEAR_VALIDATION_ERROR' }
  | { type: 'SET_ACTIVE_TAB'; payload: 'basic' | 'orders' | 'optimization' };

// Form state for advanced orders and optimization
interface AdvancedOptionsState {
  enableLimitOrders: boolean;
  limitPrice: string;
  enableStopOrders: boolean;
  stopPrice: string;
  enableOptimization: boolean;
  optimizationType: 'grid' | 'random' | 'bayesian' | 'genetic';
  optimizationMetric: 'sharpe_ratio' | 'return' | 'profit_factor';
  maxTrials: string;
}

type AdvancedAction =
  | { type: 'TOGGLE_LIMIT_ORDERS'; payload: boolean }
  | { type: 'SET_LIMIT_PRICE'; payload: string }
  | { type: 'TOGGLE_STOP_ORDERS'; payload: boolean }
  | { type: 'SET_STOP_PRICE'; payload: string }
  | { type: 'TOGGLE_OPTIMIZATION'; payload: boolean }
  | { type: 'SET_OPTIMIZATION_TYPE'; payload: 'grid' | 'random' | 'bayesian' | 'genetic' }
  | { type: 'SET_OPTIMIZATION_METRIC'; payload: 'sharpe_ratio' | 'return' | 'profit_factor' }
  | { type: 'SET_MAX_TRIALS'; payload: string };

const uiReducer = (state: UIState, action: UIAction): UIState => {
  switch (action.type) {
    case 'TOGGLE_START_DATE_PICKER':
      return { ...state, showStartDatePicker: !state.showStartDatePicker };
    case 'TOGGLE_END_DATE_PICKER':
      return { ...state, showEndDatePicker: !state.showEndDatePicker };
    case 'TOGGLE_SYMBOL_DROPDOWN':
      return { ...state, showSymbolDropdown: !state.showSymbolDropdown };
    case 'SET_VALIDATION_ERROR':
      return { ...state, showValidationError: action.payload };
    case 'CLEAR_VALIDATION_ERROR':
      return { ...state, showValidationError: '' };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    default:
      return state;
  }
};

const advancedReducer = (state: AdvancedOptionsState, action: AdvancedAction): AdvancedOptionsState => {
  switch (action.type) {
    case 'TOGGLE_LIMIT_ORDERS':
      return { ...state, enableLimitOrders: action.payload };
    case 'SET_LIMIT_PRICE':
      return { ...state, limitPrice: action.payload };
    case 'TOGGLE_STOP_ORDERS':
      return { ...state, enableStopOrders: action.payload };
    case 'SET_STOP_PRICE':
      return { ...state, stopPrice: action.payload };
    case 'TOGGLE_OPTIMIZATION':
      return { ...state, enableOptimization: action.payload };
    case 'SET_OPTIMIZATION_TYPE':
      return { ...state, optimizationType: action.payload };
    case 'SET_OPTIMIZATION_METRIC':
      return { ...state, optimizationMetric: action.payload };
    case 'SET_MAX_TRIALS':
      return { ...state, maxTrials: action.payload };
    default:
      return state;
  }
};

interface AdvancedBacktestSetupProps {
  navigation?: any;
}

const AdvancedBacktestSetupScreen: React.FC<AdvancedBacktestSetupProps> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const setupForm = useSelector(selectSetupForm);
  const symbols = useSelector(selectAvailableSymbols);
  const loading = useSelector(selectBacktestLoading);
  const error = useSelector(selectBacktestError);

  // Use reducer for UI state management (consolidates 5 useState calls)
  const [uiState, uiDispatch] = useReducer(uiReducer, {
    showStartDatePicker: false,
    showEndDatePicker: false,
    showSymbolDropdown: false,
    showValidationError: '',
    activeTab: 'basic'
  });

  // Use reducer for advanced options state (consolidates 8 useState calls)
  const [advancedState, advancedDispatch] = useReducer(advancedReducer, {
    enableLimitOrders: false,
    limitPrice: '',
    enableStopOrders: false,
    stopPrice: '',
    enableOptimization: false,
    optimizationType: 'grid' as const,
    optimizationMetric: 'sharpe_ratio' as const,
    maxTrials: '100'
  });

  // Load symbols on mount
  useEffect(() => {
    dispatch(getAvailableSymbols());
  }, [dispatch]);

  const handleStartDateChange = useCallback((event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      uiDispatch({ type: 'TOGGLE_START_DATE_PICKER' });
    }

    if (selectedDate) {
      dispatch(updateSetupForm({ startDate: selectedDate }));
    }
  }, [dispatch]);

  const handleEndDateChange = useCallback((event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      uiDispatch({ type: 'TOGGLE_END_DATE_PICKER' });
    }

    if (selectedDate) {
      dispatch(updateSetupForm({ endDate: selectedDate }));
    }
  }, [dispatch]);

  const validateForm = useCallback((): boolean => {
    if (!setupForm.symbol) {
      uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Please select a symbol' });
      return false;
    }

    if (!setupForm.startDate) {
      uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Please select a start date' });
      return false;
    }

    if (!setupForm.endDate) {
      uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Please select an end date' });
      return false;
    }

    const startDate = new Date(setupForm.startDate);
    const endDate = new Date(setupForm.endDate);
    const today = new Date();

    if (startDate >= endDate) {
      uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Start date must be before end date' });
      return false;
    }

    if (endDate > today) {
      uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'End date cannot be in the future' });
      return false;
    }

    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 3650) {
      uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Maximum backtest period is 10 years' });
      return false;
    }

    if (setupForm.initialCapital <= 0) {
      uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Initial capital must be greater than 0' });
      return false;
    }

    if (setupForm.initialCapital > 100000000) {
      uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Initial capital exceeds maximum limit ($100M)' });
      return false;
    }

    // Commission and slippage are stored as percentages (0-100)
    if (setupForm.commission < 0 || setupForm.commission > 100) {
      uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Commission must be between 0% and 100%' });
      return false;
    }

    if (setupForm.slippage < 0 || setupForm.slippage > 100) {
      uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Slippage must be between 0% and 100%' });
      return false;
    }

    // Validate advanced order settings
    if (advancedState.enableLimitOrders && !advancedState.limitPrice) {
      uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Please enter limit price' });
      return false;
    }

    if (advancedState.enableLimitOrders && parseFloat(advancedState.limitPrice) <= 0) {
      uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Limit price must be greater than 0' });
      return false;
    }

    if (advancedState.enableStopOrders && !advancedState.stopPrice) {
      uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Please enter stop price' });
      return false;
    }

    if (advancedState.enableStopOrders && parseFloat(advancedState.stopPrice) <= 0) {
      uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Stop price must be greater than 0' });
      return false;
    }

    // Validate optimization settings
    if (advancedState.enableOptimization) {
      const trials = parseInt(advancedState.maxTrials);
      if (isNaN(trials) || trials < 10) {
        uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Max trials must be at least 10' });
        return false;
      }
      if (trials > 10000) {
        uiDispatch({ type: 'SET_VALIDATION_ERROR', payload: 'Max trials cannot exceed 10,000' });
        return false;
      }
    }

    return true;
  }, [setupForm, advancedState, uiDispatch]);

  const handleStartBacktest = useCallback(async () => {
    if (!validateForm()) return;

    // Convert commission/slippage from percentages (0-100) to decimal (0-1) for backend
    const backtestConfig = {
      symbol: setupForm.symbol,
      startDate: setupForm.startDate,
      endDate: setupForm.endDate,
      strategyCode: setupForm.strategyCode || 'default',
      initialCapital: setupForm.initialCapital,
      commission: setupForm.commission / 100, // Convert percentage to decimal
      slippage: setupForm.slippage / 100, // Convert percentage to decimal
      advancedOrders: {
        limitOrders: advancedState.enableLimitOrders ? { limitPrice: parseFloat(advancedState.limitPrice) } : null,
        stopOrders: advancedState.enableStopOrders ? { stopPrice: parseFloat(advancedState.stopPrice) } : null
      },
      optimization: advancedState.enableOptimization ? {
        type: advancedState.optimizationType,
        metric: advancedState.optimizationMetric,
        maxTrials: parseInt(advancedState.maxTrials)
      } : null
    };

    dispatch(startBacktest(backtestConfig));
  }, [validateForm, setupForm, advancedState, dispatch]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🚀 Advanced Backtest Setup</Text>
        <Text style={styles.subtitle}>Configure and optimize your strategy</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, uiState.activeTab === 'basic' && styles.activeTab]}
          onPress={() => uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'basic' })}
        >
          <Text style={[styles.tabText, uiState.activeTab === 'basic' && styles.activeTabText]}>Basic</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, uiState.activeTab === 'orders' && styles.activeTab]}
          onPress={() => uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'orders' })}
        >
          <Text style={[styles.tabText, uiState.activeTab === 'orders' && styles.activeTabText]}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, uiState.activeTab === 'optimization' && styles.activeTab]}
          onPress={() => uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'optimization' })}
        >
          <Text style={[styles.tabText, uiState.activeTab === 'optimization' && styles.activeTabText]}>Optimize</Text>
        </TouchableOpacity>
      </View>

      {/* Basic Settings Tab */}
      {uiState.activeTab === 'basic' && (
        <View style={styles.tabContent}>
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>📊 Symbol & Dates</Text>

              {/* Symbol Selection */}
              <TouchableOpacity
                style={styles.input}
                onPress={() => uiDispatch({ type: 'TOGGLE_SYMBOL_DROPDOWN' })}
              >
                <Text style={styles.inputText}>
                  {setupForm.symbol || 'Select Symbol...'}
                </Text>
              </TouchableOpacity>

              {uiState.showSymbolDropdown && (
                <ScrollView style={styles.dropdown} nestedScrollEnabled>
                  {symbols && symbols.length > 0 ? (
                    symbols.map((symbol) => (
                      <TouchableOpacity
                        key={symbol}
                        style={styles.dropdownItem}
                        onPress={() => {
                          dispatch(updateSetupForm({ symbol }));
                          uiDispatch({ type: 'TOGGLE_SYMBOL_DROPDOWN' });
                        }}
                      >
                        <Text>{symbol}</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.dropdownItem}>No symbols available</Text>
                  )}
                </ScrollView>
              )}

              {/* Start Date */}
              <TouchableOpacity
                style={styles.input}
                onPress={() => uiDispatch({ type: 'TOGGLE_START_DATE_PICKER' })}
              >
                <Text style={styles.inputText}>
                  {setupForm.startDate
                    ? new Date(setupForm.startDate).toLocaleDateString()
                    : 'Select Start Date...'}
                </Text>
              </TouchableOpacity>

              {uiState.showStartDatePicker && (
                <DateTimePicker
                  value={setupForm.startDate || new Date()}
                  mode="date"
                  display="spinner"
                  onChange={handleStartDateChange}
                />
              )}

              {/* End Date */}
              <TouchableOpacity
                style={styles.input}
                onPress={() => uiDispatch({ type: 'TOGGLE_END_DATE_PICKER' })}
              >
                <Text style={styles.inputText}>
                  {setupForm.endDate
                    ? new Date(setupForm.endDate).toLocaleDateString()
                    : 'Select End Date...'}
                </Text>
              </TouchableOpacity>

              {uiState.showEndDatePicker && (
                <DateTimePicker
                  value={setupForm.endDate || new Date()}
                  mode="date"
                  display="spinner"
                  onChange={handleEndDateChange}
                />
              )}
            </Card.Content>
          </Card>

          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>💰 Capital & Settings</Text>

              <TextInput
                label="Initial Capital ($)"
                value={setupForm.initialCapital?.toString() || ''}
                onChangeText={(value) =>
                  dispatch(updateSetupForm({ initialCapital: parseFloat(value) || 0 }))
                }
                style={styles.textInput}
                keyboardType="decimal-pad"
              />

              <TextInput
                label="Commission (%)"
                value={setupForm.commission?.toString() || ''}
                onChangeText={(value) =>
                  dispatch(updateSetupForm({ commission: parseFloat(value) || 0 }))
                }
                style={styles.textInput}
                keyboardType="decimal-pad"
              />

              <TextInput
                label="Slippage (%)"
                value={setupForm.slippage?.toString() || ''}
                onChangeText={(value) =>
                  dispatch(updateSetupForm({ slippage: parseFloat(value) || 0 }))
                }
                style={styles.textInput}
                keyboardType="decimal-pad"
              />
            </Card.Content>
          </Card>
        </View>
      )}

      {/* Advanced Orders Tab */}
      {uiState.activeTab === 'orders' && (
        <View style={styles.tabContent}>
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>📋 Order Types</Text>

              {/* Limit Orders */}
              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <Text style={styles.settingTitle}>Limit Orders</Text>
                  <Text style={styles.settingSubtitle}>Buy/sell at specific price</Text>
                </View>
                <Switch
                  value={advancedState.enableLimitOrders}
                  onValueChange={(value) => advancedDispatch({ type: 'TOGGLE_LIMIT_ORDERS', payload: value })}
                />
              </View>

              {advancedState.enableLimitOrders && (
                <TextInput
                  label="Limit Price ($)"
                  value={advancedState.limitPrice}
                  onChangeText={(value) => advancedDispatch({ type: 'SET_LIMIT_PRICE', payload: value })}
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                  placeholder="e.g., 150.50"
                />
              )}

              <Divider style={styles.divider} />

              {/* Stop Orders */}
              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <Text style={styles.settingTitle}>Stop Orders</Text>
                  <Text style={styles.settingSubtitle}>Stop loss protection</Text>
                </View>
                <Switch
                  value={advancedState.enableStopOrders}
                  onValueChange={(value) => advancedDispatch({ type: 'TOGGLE_STOP_ORDERS', payload: value })}
                />
              </View>

              {advancedState.enableStopOrders && (
                <TextInput
                  label="Stop Price ($)"
                  value={advancedState.stopPrice}
                  onChangeText={(value) => advancedDispatch({ type: 'SET_STOP_PRICE', payload: value })}
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                  placeholder="e.g., 140.00"
                />
              )}

              <Text style={styles.infoText}>
                💡 Advanced order types make your backtesting more realistic by simulating actual market order behaviors.
              </Text>
            </Card.Content>
          </Card>
        </View>
      )}

      {/* Optimization Tab */}
      {uiState.activeTab === 'optimization' && (
        <View style={styles.tabContent}>
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>⚙️ Parameter Optimization</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <Text style={styles.settingTitle}>Enable Optimization</Text>
                  <Text style={styles.settingSubtitle}>Tune strategy parameters automatically</Text>
                </View>
                <Switch
                  value={advancedState.enableOptimization}
                  onValueChange={(value) => advancedDispatch({ type: 'TOGGLE_OPTIMIZATION', payload: value })}
                />
              </View>

              {advancedState.enableOptimization && (
                <>
                  <Divider style={styles.divider} />

                  {/* Optimization Type */}
                  <Text style={styles.label}>Optimization Strategy</Text>
                  <View style={styles.buttonGroup}>
                    {['grid', 'random', 'bayesian', 'genetic'].map((type) => (
                      <Chip
                        key={type}
                        selected={advancedState.optimizationType === type}
                        onPress={() => advancedDispatch({
                          type: 'SET_OPTIMIZATION_TYPE',
                          payload: type as 'grid' | 'random' | 'bayesian' | 'genetic'
                        })}
                        style={styles.chip}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Chip>
                    ))}
                  </View>

                  {/* Optimization Metric */}
                  <Text style={styles.label}>Objective Metric</Text>
                  <View style={styles.buttonGroup}>
                    {['sharpe_ratio', 'return', 'profit_factor'].map((metric) => (
                      <Chip
                        key={metric}
                        selected={advancedState.optimizationMetric === metric}
                        onPress={() => advancedDispatch({
                          type: 'SET_OPTIMIZATION_METRIC',
                          payload: metric as 'sharpe_ratio' | 'return' | 'profit_factor'
                        })}
                        style={styles.chip}
                      >
                        {metric.replace('_', ' ').toUpperCase()}
                      </Chip>
                    ))}
                  </View>

                  {/* Max Trials */}
                  <TextInput
                    label="Max Trials (10-10,000)"
                    value={advancedState.maxTrials}
                    onChangeText={(value) => advancedDispatch({ type: 'SET_MAX_TRIALS', payload: value })}
                    style={styles.textInput}
                    keyboardType="number-pad"
                    placeholder="e.g., 100"
                  />

                  <Text style={styles.infoText}>
                    💡 Optimization automatically tests different parameter combinations to find the best settings for your strategy. More trials = better results but slower processing.
                  </Text>
                </>
              )}
            </Card.Content>
          </Card>
        </View>
      )}

      {/* Error Message */}
      {uiState.showValidationError && (
        <Snackbar
          visible={!!uiState.showValidationError}
          onDismiss={() => uiDispatch({ type: 'CLEAR_VALIDATION_ERROR' })}
          duration={4000}
          style={{ backgroundColor: '#d32f2f' }}
        >
          {uiState.showValidationError}
        </Snackbar>
      )}

      {/* Start Button */}
      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleStartBacktest}
          loading={loading}
          disabled={loading}
          style={styles.startButton}
          labelStyle={styles.startButtonLabel}
        >
          🚀 {loading ? 'Running Backtest...' : 'Start Backtest'}
        </Button>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    padding: 20,
    backgroundColor: '#1976d2',
    paddingTop: 30
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)'
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center'
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#1976d2'
  },
  tabText: {
    fontSize: 14,
    color: '#666'
  },
  activeTabText: {
    color: '#1976d2',
    fontWeight: 'bold'
  },
  tabContent: {
    padding: 12
  },
  card: {
    marginBottom: 12,
    borderRadius: 8
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#f9f9f9'
  },
  inputText: {
    fontSize: 14,
    color: '#333'
  },
  dropdown: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginBottom: 12,
    backgroundColor: '#fff'
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  textInput: {
    marginBottom: 12,
    backgroundColor: '#fff'
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  settingLabel: {
    flex: 1
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333'
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2
  },
  divider: {
    marginVertical: 12
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  chip: {
    marginRight: 4,
    marginBottom: 4
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
    fontStyle: 'italic',
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 4
  },
  buttonContainer: {
    padding: 12,
    paddingBottom: 24
  },
  startButton: {
    paddingVertical: 8,
    backgroundColor: '#4caf50'
  },
  startButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  spacer: {
    height: 20
  }
});

export default AdvancedBacktestSetupScreen;
