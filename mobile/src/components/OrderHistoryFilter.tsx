/**
 * Advanced Order History Filter Component
 * Comprehensive filtering for order history with multiple criteria
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';

// ==================== Types ====================

export interface OrderFilterCriteria {
  symbol?: string;
  status?: string[];
  type?: string[];
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  quantityRange?: {
    min: number;
    max: number;
  };
  priceRange?: {
    min: number;
    max: number;
  };
  costRange?: {
    min: number;
    max: number;
  };
  commissionRange?: {
    min: number;
    max: number;
  };
  side?: string[];
  minFillPercentage?: number;
}

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.darkBorder,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: COLORS.textSecondary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.darkBorder,
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: COLORS.dark,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 6,
    flexDirection: 'row',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: COLORS.textPrimary,
  },
  filterChipCount: {
    fontSize: 11,
    color: COLORS.textTertiary,
    fontWeight: '600',
  },
  filterChipCountActive: {
    color: COLORS.textPrimary,
  },
  rangeContainer: {
    gap: 12,
  },
  rangeInputGroup: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  rangeInput: {
    flex: 1,
    backgroundColor: COLORS.dark,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  rangeLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  searchInput: {
    backgroundColor: COLORS.dark,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButton: {
    backgroundColor: COLORS.primary,
  },
  resetButton: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.darkBorder,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  resetButtonText: {
    color: COLORS.textSecondary,
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.darkCard,
    borderRadius: 8,
    marginBottom: 16,
  },
  activeFilterTag: {
    backgroundColor: COLORS.primary,
    opacity: 0.2,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeFilterTagText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  removeTagButton: {
    padding: 0,
  },
  removeTagButtonText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
});

// ==================== Component ====================

interface OrderHistoryFilterProps {
  visible: boolean;
  onClose: () => void;
  onApply: (criteria: OrderFilterCriteria) => void;
  statusOptions: FilterOption[];
  typeOptions: FilterOption[];
  symbols: string[];
}

export const OrderHistoryFilter: React.FC<OrderHistoryFilterProps> = ({
  visible,
  onClose,
  onApply,
  statusOptions,
  typeOptions,
  symbols,
}) => {
  const [criteria, setCriteria] = useState<OrderFilterCriteria>({});
  const [symbolSearch, setSymbolSearch] = useState('');

  // Filter symbols based on search
  const filteredSymbols = useMemo(() => {
    if (!symbolSearch) return symbols;
    return symbols.filter((s) => s.toUpperCase().includes(symbolSearch.toUpperCase()));
  }, [symbols, symbolSearch]);

  // Toggle status filter
  const toggleStatus = useCallback((status: string) => {
    setCriteria((prev) => ({
      ...prev,
      status: prev.status?.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...(prev.status || []), status],
    }));
  }, []);

  // Toggle type filter
  const toggleType = useCallback((type: string) => {
    setCriteria((prev) => ({
      ...prev,
      type: prev.type?.includes(type)
        ? prev.type.filter((t) => t !== type)
        : [...(prev.type || []), type],
    }));
  }, []);

  // Toggle side filter
  const toggleSide = useCallback((side: string) => {
    setCriteria((prev) => ({
      ...prev,
      side: prev.side?.includes(side)
        ? prev.side.filter((s) => s !== side)
        : [...(prev.side || []), side],
    }));
  }, []);

  // Set symbol filter
  const handleSymbolSelect = useCallback((symbol: string) => {
    setCriteria((prev) => ({
      ...prev,
      symbol: prev.symbol === symbol ? undefined : symbol,
    }));
    setSymbolSearch('');
  }, []);

  // Apply filters
  const handleApply = useCallback(() => {
    onApply(criteria);
    onClose();
  }, [criteria, onApply, onClose]);

  // Reset filters
  const handleReset = useCallback(() => {
    setCriteria({});
  }, []);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (criteria.symbol) count++;
    if (criteria.status?.length) count += criteria.status.length;
    if (criteria.type?.length) count += criteria.type.length;
    if (criteria.side?.length) count += criteria.side.length;
    if (criteria.dateRange) count++;
    if (criteria.quantityRange) count++;
    if (criteria.priceRange) count++;
    return count;
  }, [criteria]);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Filter Orders {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Symbol Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Symbol</Text>
            <View style={styles.sectionDivider} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search symbols..."
              placeholderTextColor={COLORS.textTertiary}
              value={symbolSearch}
              onChangeText={setSymbolSearch}
            />
            <View style={styles.filterGrid}>
              {filteredSymbols.map((symbol) => (
                <TouchableOpacity
                  key={symbol}
                  style={[
                    styles.filterChip,
                    criteria.symbol === symbol && styles.filterChipActive,
                  ]}
                  onPress={() => handleSymbolSelect(symbol)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      criteria.symbol === symbol && styles.filterChipTextActive,
                    ]}
                  >
                    {symbol}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Status Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.sectionDivider} />
            <View style={styles.filterGrid}>
              {statusOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.filterChip,
                    criteria.status?.includes(option.value) && styles.filterChipActive,
                  ]}
                  onPress={() => toggleStatus(option.value)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      criteria.status?.includes(option.value) &&
                        styles.filterChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.count !== undefined && (
                    <Text
                      style={[
                        styles.filterChipCount,
                        criteria.status?.includes(option.value) &&
                          styles.filterChipCountActive,
                      ]}
                    >
                      {option.count}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Type Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Type</Text>
            <View style={styles.sectionDivider} />
            <View style={styles.filterGrid}>
              {typeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.filterChip,
                    criteria.type?.includes(option.value) && styles.filterChipActive,
                  ]}
                  onPress={() => toggleType(option.value)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      criteria.type?.includes(option.value) && styles.filterChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.count !== undefined && (
                    <Text
                      style={[
                        styles.filterChipCount,
                        criteria.type?.includes(option.value) &&
                          styles.filterChipCountActive,
                      ]}
                    >
                      {option.count}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Side Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Direction</Text>
            <View style={styles.sectionDivider} />
            <View style={styles.filterGrid}>
              {['buy', 'sell'].map((side) => (
                <TouchableOpacity
                  key={side}
                  style={[
                    styles.filterChip,
                    criteria.side?.includes(side) && styles.filterChipActive,
                  ]}
                  onPress={() => toggleSide(side)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      criteria.side?.includes(side) && styles.filterChipTextActive,
                    ]}
                  >
                    {side.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Quantity Range Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quantity Range</Text>
            <View style={styles.sectionDivider} />
            <View style={styles.rangeInputGroup}>
              <TextInput
                style={styles.rangeInput}
                placeholder="Min"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="decimal-pad"
                value={criteria.quantityRange?.min.toString() || ''}
                onChangeText={(text) =>
                  setCriteria((prev) => ({
                    ...prev,
                    quantityRange: {
                      min: parseFloat(text) || 0,
                      max: prev.quantityRange?.max || 1000000,
                    },
                  }))
                }
              />
              <Text style={styles.rangeLabel}>-</Text>
              <TextInput
                style={styles.rangeInput}
                placeholder="Max"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="decimal-pad"
                value={criteria.quantityRange?.max.toString() || ''}
                onChangeText={(text) =>
                  setCriteria((prev) => ({
                    ...prev,
                    quantityRange: {
                      min: prev.quantityRange?.min || 0,
                      max: parseFloat(text) || 1000000,
                    },
                  }))
                }
              />
            </View>
          </View>

          {/* Price Range Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Price Range</Text>
            <View style={styles.sectionDivider} />
            <View style={styles.rangeInputGroup}>
              <TextInput
                style={styles.rangeInput}
                placeholder="Min ($)"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="decimal-pad"
                value={criteria.priceRange?.min.toString() || ''}
                onChangeText={(text) =>
                  setCriteria((prev) => ({
                    ...prev,
                    priceRange: {
                      min: parseFloat(text) || 0,
                      max: prev.priceRange?.max || 1000000,
                    },
                  }))
                }
              />
              <Text style={styles.rangeLabel}>-</Text>
              <TextInput
                style={styles.rangeInput}
                placeholder="Max ($)"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="decimal-pad"
                value={criteria.priceRange?.max.toString() || ''}
                onChangeText={(text) =>
                  setCriteria((prev) => ({
                    ...prev,
                    priceRange: {
                      min: prev.priceRange?.min || 0,
                      max: parseFloat(text) || 1000000,
                    },
                  }))
                }
              />
            </View>
          </View>

          {/* Cost Range Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Total Cost Range</Text>
            <View style={styles.sectionDivider} />
            <View style={styles.rangeInputGroup}>
              <TextInput
                style={styles.rangeInput}
                placeholder="Min ($)"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="decimal-pad"
                value={criteria.costRange?.min.toString() || ''}
                onChangeText={(text) =>
                  setCriteria((prev) => ({
                    ...prev,
                    costRange: {
                      min: parseFloat(text) || 0,
                      max: prev.costRange?.max || 1000000,
                    },
                  }))
                }
              />
              <Text style={styles.rangeLabel}>-</Text>
              <TextInput
                style={styles.rangeInput}
                placeholder="Max ($)"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="decimal-pad"
                value={criteria.costRange?.max.toString() || ''}
                onChangeText={(text) =>
                  setCriteria((prev) => ({
                    ...prev,
                    costRange: {
                      min: prev.costRange?.min || 0,
                      max: parseFloat(text) || 1000000,
                    },
                  }))
                }
              />
            </View>
          </View>

          {/* Fill Percentage Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Minimum Fill %</Text>
            <View style={styles.sectionDivider} />
            <TextInput
              style={styles.rangeInput}
              placeholder="e.g., 50 (for orders at least 50% filled)"
              placeholderTextColor={COLORS.textTertiary}
              keyboardType="decimal-pad"
              value={criteria.minFillPercentage?.toString() || ''}
              onChangeText={(text) =>
                setCriteria((prev) => ({
                  ...prev,
                  minFillPercentage: parseFloat(text),
                }))
              }
            />
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={handleReset}
          >
            <Text style={[styles.buttonText, styles.resetButtonText]}>RESET</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.applyButton]} onPress={handleApply}>
            <Text style={styles.buttonText}>APPLY FILTERS</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default OrderHistoryFilter;
