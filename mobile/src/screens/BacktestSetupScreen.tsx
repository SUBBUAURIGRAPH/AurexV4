/**
 * Backtest Setup Screen
 * Configure and start a new backtest
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { Text, TextInput, Button, Card, Snackbar, Dialog } from 'react-native-paper';
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

interface BacktestSetupScreenProps {
  navigation?: any;
}

const BacktestSetupScreen: React.FC<BacktestSetupScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const setupForm = useSelector(selectSetupForm);
  const symbols = useSelector(selectAvailableSymbols);
  const loading = useSelector(selectBacktestLoading);
  const error = useSelector(selectBacktestError);

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const [showValidationError, setShowValidationError] = useState('');

  // Load available symbols on mount
  useEffect(() => {
    dispatch(getAvailableSymbols());
  }, [dispatch]);

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
    }

    if (selectedDate) {
      dispatch(updateSetupForm({ startDate: selectedDate }));
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
    }

    if (selectedDate) {
      dispatch(updateSetupForm({ endDate: selectedDate }));
    }
  };

  const validateForm = (): boolean => {
    if (!setupForm.symbol) {
      setShowValidationError('Please select a symbol');
      return false;
    }

    if (!setupForm.startDate) {
      setShowValidationError('Please select a start date');
      return false;
    }

    if (!setupForm.endDate) {
      setShowValidationError('Please select an end date');
      return false;
    }

    if (new Date(setupForm.startDate) >= new Date(setupForm.endDate)) {
      setShowValidationError('Start date must be before end date');
      return false;
    }

    if (setupForm.initialCapital <= 0) {
      setShowValidationError('Initial capital must be greater than 0');
      return false;
    }

    if (setupForm.commission < 0 || setupForm.commission > 1) {
      setShowValidationError('Commission must be between 0 and 1');
      return false;
    }

    if (setupForm.slippage < 0 || setupForm.slippage > 1) {
      setShowValidationError('Slippage must be between 0 and 1');
      return false;
    }

    return true;
  };

  const handleStartBacktest = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const result = await dispatch(
        startBacktest({
          symbol: setupForm.symbol,
          startDate: setupForm.startDate,
          endDate: setupForm.endDate,
          strategyCode: 'default', // TODO: Add strategy selection
          initialCapital: setupForm.initialCapital,
          commission: setupForm.commission,
          slippage: setupForm.slippage
        })
      ).unwrap();

      // Navigate to results screen
      if (navigation) {
        navigation.navigate('BacktestResults', {
          backtestId: result.id
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to start backtest');
    }
  };

  const formatDate = (date: Date | string) => {
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            Configure Backtest
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Set up your trading strategy backtest
          </Text>
        </View>

        {/* Symbol Selection */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              📊 Symbol Selection
            </Text>

            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowSymbolDropdown(!showSymbolDropdown)}
            >
              <Text style={styles.dropdownText}>
                {setupForm.symbol || 'Select a symbol'}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>

            {showSymbolDropdown && (
              <ScrollView
                style={styles.dropdownOptions}
                nestedScrollEnabled
                scrollEnabled
              >
                {symbols.map((symbol) => (
                  <TouchableOpacity
                    key={symbol}
                    style={styles.dropdownOption}
                    onPress={() => {
                      dispatch(updateSetupForm({ symbol }));
                      setShowSymbolDropdown(false);
                    }}
                  >
                    <Text style={styles.optionText}>{symbol}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Card.Content>
        </Card>

        {/* Date Range */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              📅 Date Range
            </Text>

            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Text style={styles.dateButtonLabel}>Start Date:</Text>
              <Text style={styles.dateButtonValue}>
                {formatDate(setupForm.startDate)}
              </Text>
            </TouchableOpacity>

            {showStartDatePicker && (
              <DateTimePicker
                value={new Date(setupForm.startDate)}
                mode="date"
                display="default"
                onChange={handleStartDateChange}
                maximumDate={new Date()}
              />
            )}

            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Text style={styles.dateButtonLabel}>End Date:</Text>
              <Text style={styles.dateButtonValue}>
                {formatDate(setupForm.endDate)}
              </Text>
            </TouchableOpacity>

            {showEndDatePicker && (
              <DateTimePicker
                value={new Date(setupForm.endDate)}
                mode="date"
                display="default"
                onChange={handleEndDateChange}
                maximumDate={new Date()}
              />
            )}
          </Card.Content>
        </Card>

        {/* Capital Configuration */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              💰 Capital Configuration
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Initial Capital ($)</Text>
              <TextInput
                style={styles.input}
                placeholder="100000"
                value={setupForm.initialCapital.toString()}
                onChangeText={(value) => {
                  const num = parseFloat(value) || 0;
                  dispatch(updateSetupForm({ initialCapital: num }));
                }}
                keyboardType="decimal-pad"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Commission (%)</Text>
              <View style={styles.inputWithHint}>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  placeholder="0.1"
                  value={(setupForm.commission * 100).toString()}
                  onChangeText={(value) => {
                    const num = parseFloat(value) / 100 || 0;
                    dispatch(updateSetupForm({ commission: num }));
                  }}
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
                <Text style={styles.hint}>
                  {(setupForm.commission * 100).toFixed(2)}%
                </Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Slippage (%)</Text>
              <View style={styles.inputWithHint}>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  placeholder="0.05"
                  value={(setupForm.slippage * 100).toString()}
                  onChangeText={(value) => {
                    const num = parseFloat(value) / 100 || 0;
                    dispatch(updateSetupForm({ slippage: num }));
                  }}
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
                <Text style={styles.hint}>
                  {(setupForm.slippage * 100).toFixed(2)}%
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Summary */}
        <Card style={[styles.card, styles.summaryCard]}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              📋 Summary
            </Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Symbol:</Text>
              <Text style={styles.summaryValue}>{setupForm.symbol || '—'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Period:</Text>
              <Text style={styles.summaryValue}>
                {setupForm.startDate && setupForm.endDate
                  ? `${Math.floor(
                      (new Date(setupForm.endDate).getTime() -
                        new Date(setupForm.startDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )} days`
                  : '—'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Capital:</Text>
              <Text style={styles.summaryValue}>
                ${setupForm.initialCapital.toLocaleString()}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Commission:</Text>
              <Text style={styles.summaryValue}>
                {(setupForm.commission * 100).toFixed(2)}%
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Start Button */}
        <TouchableOpacity
          style={[styles.startButton, loading && styles.startButtonDisabled]}
          onPress={handleStartBacktest}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.startButtonText}>🚀 Start Backtest</Text>
          )}
        </TouchableOpacity>

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Starting backtest...</Text>
          </View>
        )}
      </ScrollView>

      {/* Validation Error Snackbar */}
      <Snackbar
        visible={!!showValidationError}
        onDismiss={() => setShowValidationError('')}
        duration={4000}
      >
        {showValidationError}
      </Snackbar>

      {/* API Error Snackbar */}
      <Snackbar
        visible={!!error}
        onDismiss={() => {}}
        duration={4000}
      >
        {error}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },

  scrollView: {
    flex: 1
  },

  contentContainer: {
    padding: 16,
    paddingBottom: 32
  },

  header: {
    marginBottom: 24
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000'
  },

  subtitle: {
    color: '#666',
    fontSize: 14
  },

  card: {
    marginBottom: 16,
    backgroundColor: '#fff'
  },

  sectionTitle: {
    marginBottom: 16,
    fontWeight: '600',
    fontSize: 16
  },

  dropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  dropdownText: {
    fontSize: 16,
    color: '#333'
  },

  dropdownArrow: {
    color: '#666',
    fontSize: 12
  },

  dropdownOptions: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopWidth: 0,
    maxHeight: 200,
    backgroundColor: '#fff'
  },

  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },

  optionText: {
    fontSize: 14,
    color: '#333'
  },

  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  dateButtonLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },

  dateButtonValue: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600'
  },

  inputGroup: {
    marginBottom: 16
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333'
  },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fafafa'
  },

  inputWithHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },

  flexInput: {
    flex: 1
  },

  hint: {
    fontSize: 12,
    color: '#666',
    minWidth: 60,
    textAlign: 'right'
  },

  summaryCard: {
    backgroundColor: '#f0f8ff',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF'
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff'
  },

  summaryLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },

  summaryValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600'
  },

  startButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3
  },

  startButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.7
  },

  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },

  loadingContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },

  loadingText: {
    marginTop: 16,
    color: '#333',
    fontSize: 14
  }
});

export default BacktestSetupScreen;
