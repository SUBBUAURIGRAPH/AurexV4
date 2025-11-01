/**
 * GNN Prediction History Screen
 * Displays historical predictions and performance tracking
 *
 * Features:
 * - Recent predictions list
 * - Filter by recommendation type
 * - Performance statistics
 * - Accuracy tracking
 * - Hit rate visualization
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { GNNPredictionAPI } from '../api/GNNPredictionAPI';
import { LineChart, BarChart } from 'react-native-chart-kit';

interface PredictionHistory {
  symbol: string;
  recommendation: string;
  confidence: number;
  signalStrength: number;
  timestamp: string;
  direction: 'UP' | 'DOWN';
}

interface PredictionStats {
  totalPredictions: number;
  upSignals: number;
  downSignals: number;
  neutralSignals: number;
  consensus: string;
  consensusStrength: number;
  avgConfidence: number;
  highConfidencePredictions: number;
}

const screenWidth = Dimensions.get('window').width;
const chartWidth = screenWidth - 40;

const GNNHistoryScreen = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'BUY' | 'SELL' | 'NEUTRAL'>('ALL');

  // Fetch history
  const { data: historyData, refetch: refetchHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['gnnHistory', filterType],
    queryFn: () => GNNPredictionAPI.getHistory({ type: filterType }),
    refetchInterval: 60000
  });

  // Fetch consensus
  const { data: consensusData, refetch: refetchConsensus } = useQuery({
    queryKey: ['gnnConsensus'],
    queryFn: () => GNNPredictionAPI.getConsensus(),
    refetchInterval: 120000
  });

  // Fetch performance
  const { data: performanceData } = useQuery({
    queryKey: ['gnnPerformance'],
    queryFn: () => GNNPredictionAPI.getPerformance(),
    refetchInterval: 300000
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchHistory(), refetchConsensus()]);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      refetchHistory();
    }, [refetchHistory])
  );

  const handlePredictionPress = (symbol: string) => {
    navigation.navigate('Prediction', { symbol });
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header Stats */}
      <HeaderStats stats={consensusData} />

      {/* Filter Tabs */}
      <FilterTabs filterType={filterType} onFilterChange={setFilterType} />

      {/* Performance Charts */}
      {performanceData && <PerformanceCharts performance={performanceData} />}

      {/* Consensus Section */}
      {consensusData && <ConsensusSection consensus={consensusData} />}

      {/* History List */}
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Recent Predictions</Text>

        {historyLoading && !historyData ? (
          <ActivityIndicator size="large" color="#4A90E2" style={styles.loader} />
        ) : (
          <PredictionsList
            predictions={historyData}
            filterType={filterType}
            onPredictionPress={handlePredictionPress}
          />
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Pull down to refresh • Last updated: {new Date().toLocaleTimeString()}
        </Text>
      </View>
    </ScrollView>
  );
};

/**
 * Header Stats Component
 */
const HeaderStats: React.FC<{ stats?: PredictionStats }> = ({ stats }) => {
  if (!stats) return null;

  return (
    <View style={styles.headerStats}>
      <StatCard label="Total Predictions" value={stats.totalPredictions.toString()} />
      <StatCard
        label="Avg Confidence"
        value={`${(stats.avgConfidence * 100).toFixed(0)}%`}
      />
      <StatCard
        label="Consensus"
        value={stats.consensus}
        valueColor={stats.consensus === 'BULLISH' ? '#4CAF50' : stats.consensus === 'BEARISH' ? '#E63946' : '#FF9800'}
      />
      <StatCard
        label="High Confidence"
        value={stats.highConfidencePredictions.toString()}
      />
    </View>
  );
};

/**
 * Stat Card Component
 */
const StatCard: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
}> = ({ label, value, valueColor = '#4A90E2' }) => {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
};

/**
 * Filter Tabs
 */
const FilterTabs: React.FC<{
  filterType: string;
  onFilterChange: (type: 'ALL' | 'BUY' | 'SELL' | 'NEUTRAL') => void;
}> = ({ filterType, onFilterChange }) => {
  const filters = ['ALL', 'BUY', 'SELL', 'NEUTRAL'] as const;

  return (
    <View style={styles.filterContainer}>
      {filters.map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[
            styles.filterTab,
            filterType === filter && styles.filterTabActive
          ]}
          onPress={() => onFilterChange(filter)}
        >
          <Text
            style={[
              styles.filterTabText,
              filterType === filter && styles.filterTabTextActive
            ]}
          >
            {filter}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

/**
 * Performance Charts
 */
const PerformanceCharts: React.FC<{ performance: any }> = ({ performance }) => {
  const chartData = {
    labels: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    datasets: [
      {
        data: [
          performance.accuracy?.hitRate || 0,
          (performance.accuracy?.precision || 0) / 2,
          performance.accuracy?.rocAuc ? performance.accuracy.rocAuc * 100 : 0,
          (performance.performance?.performance?.tradeMetrics?.winRate || 0) / 2,
          (performance.performance?.performance?.riskAdjustedMetrics?.sharpeRatio || 0) * 20
        ]
      }
    ]
  };

  return (
    <View style={styles.chartsSection}>
      <Text style={styles.sectionTitle}>Performance Trend</Text>

      <View style={styles.chart}>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={220}
          chartConfig={chartConfig}
          fromZero
          style={styles.lineChart}
        />
      </View>

      {/* Key Metrics */}
      <View style={styles.metricsGrid}>
        <MetricBox
          label="Hit Rate"
          value={`${performance.accuracy?.hitRate?.toFixed(1) || 0}%`}
          target=">52%"
        />
        <MetricBox
          label="Sharpe Ratio"
          value={(performance.performance?.performance?.riskAdjustedMetrics?.sharpeRatio || 0).toFixed(2)}
          target=">1.5"
        />
        <MetricBox
          label="Win Rate"
          value={`${performance.performance?.performance?.tradeMetrics?.winRate?.toFixed(1) || 0}%`}
          target=">50%"
        />
        <MetricBox
          label="ROC-AUC"
          value={(performance.accuracy?.rocAuc || 0).toFixed(3)}
          target=">0.60"
        />
      </View>
    </View>
  );
};

/**
 * Metric Box Component
 */
const MetricBox: React.FC<{
  label: string;
  value: string;
  target: string;
}> = ({ label, value, target }) => {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricBoxLabel}>{label}</Text>
      <Text style={styles.metricBoxValue}>{value}</Text>
      <Text style={styles.metricBoxTarget}>{target}</Text>
    </View>
  );
};

/**
 * Consensus Section
 */
const ConsensusSection: React.FC<{ consensus: PredictionStats }> = ({ consensus }) => {
  const consensusColor =
    consensus.consensus === 'BULLISH' ? '#4CAF50' :
    consensus.consensus === 'BEARISH' ? '#E63946' : '#FF9800';

  return (
    <View style={styles.consensusSection}>
      <Text style={styles.sectionTitle}>Market Consensus</Text>

      <View style={[styles.consensusCard, { borderLeftColor: consensusColor }]}>
        <View style={styles.consensusHeader}>
          <Text style={[styles.consensusType, { color: consensusColor }]}>
            {consensus.consensus}
          </Text>
          <Text style={styles.consensusStrength}>
            Strength: {(consensus.consensusStrength * 100).toFixed(0)}%
          </Text>
        </View>

        <View style={styles.consensusBreakdown}>
          <ConsensusBar
            label="Up Signals"
            count={consensus.upSignals}
            total={consensus.totalPredictions}
            color="#4CAF50"
          />
          <ConsensusBar
            label="Down Signals"
            count={consensus.downSignals}
            total={consensus.totalPredictions}
            color="#E63946"
          />
          <ConsensusBar
            label="Neutral"
            count={consensus.neutralSignals}
            total={consensus.totalPredictions}
            color="#FF9800"
          />
        </View>
      </View>
    </View>
  );
};

/**
 * Consensus Bar Component
 */
const ConsensusBar: React.FC<{
  label: string;
  count: number;
  total: number;
  color: string;
}> = ({ label, count, total, color }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <View style={styles.consensusBar}>
      <View style={styles.consensusBarLabel}>
        <Text style={styles.consensusBarText}>{label}</Text>
        <Text style={styles.consensusBarCount}>{count}/{total}</Text>
      </View>

      <View style={styles.consensusBarContainer}>
        <View
          style={[
            styles.consensusBarFill,
            { width: `${percentage}%`, backgroundColor: color }
          ]}
        />
      </View>
    </View>
  );
};

/**
 * Predictions List
 */
const PredictionsList: React.FC<{
  predictions?: PredictionHistory[];
  filterType: string;
  onPredictionPress: (symbol: string) => void;
}> = ({ predictions, filterType, onPredictionPress }) => {
  if (!predictions || predictions.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No predictions found</Text>
      </View>
    );
  }

  const filteredPredictions = predictions.filter((p) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'BUY') return p.recommendation.includes('BUY');
    if (filterType === 'SELL') return p.recommendation.includes('SELL');
    return p.recommendation === 'NEUTRAL';
  });

  return (
    <FlatList
      scrollEnabled={false}
      data={filteredPredictions}
      keyExtractor={(item, idx) => `${item.symbol}-${idx}`}
      renderItem={({ item }) => (
        <PredictionRow
          prediction={item}
          onPress={() => onPredictionPress(item.symbol)}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
};

/**
 * Prediction Row Component
 */
const PredictionRow: React.FC<{
  prediction: PredictionHistory;
  onPress: () => void;
}> = ({ prediction, onPress }) => {
  const recColor = getRecColor(prediction.recommendation);
  const directionIcon = prediction.direction === 'UP' ? '📈' : '📉';

  return (
    <TouchableOpacity style={styles.predictionRow} onPress={onPress}>
      <View style={styles.predictionLeft}>
        <Text style={styles.predictionSymbol}>{prediction.symbol}</Text>
        <Text style={styles.predictionTime}>
          {new Date(prediction.timestamp).toLocaleTimeString()}
        </Text>
      </View>

      <View style={styles.predictionMiddle}>
        <Text style={[styles.predictionRec, { color: recColor }]}>
          {prediction.recommendation}
        </Text>
        <Text style={styles.predictionSignal}>
          {Math.abs(prediction.signalStrength).toFixed(3)}
        </Text>
      </View>

      <View style={styles.predictionRight}>
        <Text style={styles.directionEmoji}>{directionIcon}</Text>
        <View
          style={[
            styles.confidenceBadge,
            { backgroundColor: getConfidenceBgColor(prediction.confidence) }
          ]}
        >
          <Text
            style={[
              styles.confidenceText,
              { color: getConfidenceColor(prediction.confidence) }
            ]}
          >
            {(prediction.confidence * 100).toFixed(0)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Helper Functions
const getRecColor = (rec: string): string => {
  if (rec.includes('BUY')) return '#4CAF50';
  if (rec.includes('SELL')) return '#E63946';
  return '#FF9800';
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.85) return '#1B5E20';
  if (confidence >= 0.70) return '#4CAF50';
  if (confidence >= 0.55) return '#FF9800';
  if (confidence >= 0.40) return '#FF6F00';
  return '#E63946';
};

const getConfidenceBgColor = (confidence: number): string => {
  return getConfidenceColor(confidence) + '20';
};

const chartConfig = {
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  color: (opacity = 1) => `rgba(74, 144, 226, ${opacity})`,
  strokeWidth: 2,
  barPercentage: 0.5
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  headerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    justifyContent: 'space-between'
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center'
  },
  filterTabActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2'
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666'
  },
  filterTabTextActive: {
    color: '#FFFFFF'
  },
  chartsSection: {
    backgroundColor: '#FFFFFF',
    margin: 12,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12
  },
  chart: {
    alignItems: 'center',
    marginVertical: 12
  },
  lineChart: {
    borderRadius: 8
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
  },
  metricBox: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 8
  },
  metricBoxLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4
  },
  metricBoxValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 2
  },
  metricBoxTarget: {
    fontSize: 10,
    color: '#999'
  },
  consensusSection: {
    backgroundColor: '#FFFFFF',
    margin: 12,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  consensusCard: {
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderLeftWidth: 4
  },
  consensusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  consensusType: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  consensusStrength: {
    fontSize: 12,
    color: '#666'
  },
  consensusBreakdown: {
    gap: 8
  },
  consensusBar: {
    marginBottom: 8
  },
  consensusBarLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  consensusBarText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500'
  },
  consensusBarCount: {
    fontSize: 11,
    color: '#999'
  },
  consensusBarContainer: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden'
  },
  consensusBarFill: {
    height: '100%',
    borderRadius: 3
  },
  historySection: {
    backgroundColor: '#FFFFFF',
    margin: 12,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  loader: {
    marginVertical: 20
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyText: {
    fontSize: 14,
    color: '#999'
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12
  },
  predictionLeft: {
    flex: 1
  },
  predictionSymbol: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333'
  },
  predictionTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 2
  },
  predictionMiddle: {
    flex: 1,
    alignItems: 'center'
  },
  predictionRec: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2
  },
  predictionSignal: {
    fontSize: 10,
    color: '#999'
  },
  predictionRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8
  },
  directionEmoji: {
    fontSize: 16
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: 'bold'
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0'
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16
  },
  footerText: {
    fontSize: 11,
    color: '#999'
  }
});

export default GNNHistoryScreen;
