/**
 * GNN Prediction Results Screen
 * Displays comprehensive stock price predictions with signals, confidence, and metrics
 *
 * Components:
 * - Prediction Header (Symbol, Price, Recommendation)
 * - Signal Breakdown (Technical, Fundamental, GNN, Graph)
 * - Confidence Indicator (Visual gauge)
 * - Performance Metrics (Sharpe, Win Rate, Drawdown)
 * - Risk Assessment
 * - Action Buttons
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions
} from 'react-native';
import { LineChart, ProgressChart } from 'react-native-chart-kit';
import { useQuery } from '@tanstack/react-query';
import { GNNPredictionAPI } from '../api/GNNPredictionAPI';

interface GNNPrediction {
  symbol: string;
  timestamp: string;
  gnnPrediction: {
    direction: 'UP' | 'DOWN';
    probability: number;
    confidence: number;
    signalStrength: number;
  };
  signals: {
    technical: SignalData;
    fundamental: SignalData;
    graph: SignalData;
    aggregated: SignalData;
  };
  confidence: number;
  confidenceLevel: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
  recommendation: {
    type: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
    action: string;
    description: string;
    signalStrength: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  };
}

interface SignalData {
  strength: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  [key: string]: any;
}

interface PerformanceMetrics {
  accuracy?: {
    hitRate: number;
    precision: number;
    rocAuc: number;
  };
  performance?: {
    riskAdjustedMetrics: {
      sharpeRatio: number;
      sortinoRatio: number;
      calmarRatio: number;
    };
    tradeMetrics: {
      winRate: number;
      profitFactor: number;
    };
    riskMetrics: {
      maxDrawdown: number;
      volatility: number;
    };
  };
}

const screenWidth = Dimensions.get('window').width;

const GNNPredictionScreen: React.FC<{ symbol: string }> = ({ symbol }) => {
  const [refreshing, setRefreshing] = useState(false);

  // Fetch prediction data
  const { data: prediction, isLoading, refetch } = useQuery<GNNPrediction>({
    queryKey: ['gnnPrediction', symbol],
    queryFn: () => GNNPredictionAPI.getPrediction(symbol),
    refetchInterval: 60000 // Refetch every minute
  });

  // Fetch performance metrics
  const { data: metrics } = useQuery<PerformanceMetrics>({
    queryKey: ['gnnMetrics', symbol],
    queryFn: () => GNNPredictionAPI.getMetrics(symbol),
    refetchInterval: 300000 // Refetch every 5 minutes
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading || !prediction) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading prediction...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header Section */}
      <PredictionHeader prediction={prediction} />

      {/* Recommendation Card */}
      <RecommendationCard prediction={prediction} />

      {/* Signal Breakdown */}
      <SignalBreakdown signals={prediction.signals} />

      {/* Confidence Indicator */}
      <ConfidenceIndicator confidence={prediction.confidence} level={prediction.confidenceLevel} />

      {/* Performance Metrics */}
      {metrics && <PerformanceMetricsSection metrics={metrics} />}

      {/* Risk Assessment */}
      <RiskAssessmentCard risk={prediction.recommendation.riskLevel} />

      {/* Action Buttons */}
      <ActionButtons symbol={symbol} recommendation={prediction.recommendation.type} />

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Last updated: {new Date(prediction.timestamp).toLocaleTimeString()}
        </Text>
      </View>
    </ScrollView>
  );
};

/**
 * Prediction Header Component
 */
const PredictionHeader: React.FC<{ prediction: GNNPrediction }> = ({ prediction }) => {
  const directionColor = prediction.gnnPrediction.direction === 'UP' ? '#4CAF50' : '#E63946';
  const directionIcon = prediction.gnnPrediction.direction === 'UP' ? '📈' : '📉';

  return (
    <View style={[styles.card, styles.header]}>
      <View style={styles.symbolRow}>
        <Text style={styles.symbol}>{prediction.symbol}</Text>
        <Text style={[styles.directionEmoji]}>{directionIcon}</Text>
      </View>

      <View style={styles.probabilityRow}>
        <View>
          <Text style={styles.labelSmall}>Probability</Text>
          <Text style={[styles.probability, { color: directionColor }]}>
            {(prediction.gnnPrediction.probability * 100).toFixed(1)}%
          </Text>
        </View>

        <View>
          <Text style={styles.labelSmall}>Signal Strength</Text>
          <Text style={styles.signalStrength}>
            {Math.abs(prediction.gnnPrediction.signalStrength).toFixed(2)}
          </Text>
        </View>

        <View>
          <Text style={styles.labelSmall}>Confidence</Text>
          <Text style={[styles.confidenceValue, { color: getConfidenceColor(prediction.confidence) }]}>
            {(prediction.confidence * 100).toFixed(0)}%
          </Text>
        </View>
      </View>
    </View>
  );
};

/**
 * Recommendation Card Component
 */
const RecommendationCard: React.FC<{ prediction: GNNPrediction }> = ({ prediction }) => {
  const rec = prediction.recommendation;
  const bgColor = getRecommendationColor(rec.type);

  return (
    <View style={[styles.card, { backgroundColor: bgColor + '20', borderLeftColor: bgColor, borderLeftWidth: 4 }]}>
      <Text style={[styles.recommendationType, { color: bgColor }]}>{rec.type}</Text>
      <Text style={styles.description}>{rec.description}</Text>
      <View style={styles.actionRow}>
        <Text style={styles.action}>Action: {rec.action}</Text>
        <Text style={[styles.riskBadge, getRiskBadgeStyle(rec.riskLevel)]}>
          {rec.riskLevel}
        </Text>
      </View>
    </View>
  );
};

/**
 * Signal Breakdown Component
 */
const SignalBreakdown: React.FC<{ signals: GNNPrediction['signals'] }> = ({ signals }) => {
  const signalSources = [
    { name: 'GNN Neural Network', data: signals.gnnPrediction || { strength: 0, direction: 'NEUTRAL' }, color: '#4A90E2' },
    { name: 'Technical Analysis', data: signals.technical, color: '#50C878' },
    { name: 'Fundamental Analysis', data: signals.fundamental, color: '#FFB703' },
    { name: 'Market Graph', data: signals.graph, color: '#8E7CC3' }
  ];

  return (
    <View style={[styles.card, styles.signalCard]}>
      <Text style={styles.cardTitle}>Signal Breakdown</Text>

      {signalSources.map((source, idx) => (
        <SignalRow
          key={idx}
          name={source.name}
          strength={source.data.strength || 0}
          direction={source.data.direction}
          color={source.color}
        />
      ))}

      {/* Aggregated Signal */}
      <View style={styles.aggregatedSignalContainer}>
        <Text style={styles.aggregatedLabel}>Aggregated Signal</Text>
        <View style={styles.aggregatedBar}>
          <View
            style={[
              styles.aggregatedFill,
              {
                width: `${Math.abs(signals.aggregated.signal) * 100}%`,
                backgroundColor: signals.aggregated.signal > 0 ? '#4CAF50' : '#E63946'
              }
            ]}
          />
        </View>
      </View>
    </View>
  );
};

/**
 * Signal Row Component
 */
const SignalRow: React.FC<{
  name: string;
  strength: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  color: string;
}> = ({ name, strength, direction, color }) => {
  const directionIcon = direction === 'UP' ? '↑' : direction === 'DOWN' ? '↓' : '→';

  return (
    <View style={styles.signalRow}>
      <View style={styles.signalInfo}>
        <Text style={styles.signalName}>{name}</Text>
        <View style={styles.directionContainer}>
          <Text style={[styles.directionText, { color: color }]}>{directionIcon}</Text>
          <Text style={styles.strengthText}>{Math.abs(strength).toFixed(3)}</Text>
        </View>
      </View>

      <View style={styles.signalBar}>
        <View
          style={[
            styles.signalBarFill,
            {
              width: `${Math.abs(strength) * 100}%`,
              backgroundColor: color
            }
          ]}
        />
      </View>
    </View>
  );
};

/**
 * Confidence Indicator Component
 */
const ConfidenceIndicator: React.FC<{ confidence: number; level: string }> = ({ confidence, level }) => {
  const segments = 5;
  const filledSegments = Math.ceil(confidence * segments);

  return (
    <View style={[styles.card, styles.confidenceCard]}>
      <Text style={styles.cardTitle}>Confidence Level</Text>

      <View style={styles.confidenceSegments}>
        {Array.from({ length: segments }).map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.confidenceSegment,
              {
                backgroundColor: idx < filledSegments ? getConfidenceColor(confidence) : '#E0E0E0'
              }
            ]}
          />
        ))}
      </View>

      <View style={styles.confidenceLevelRow}>
        <Text style={styles.levelLabel}>{level}</Text>
        <Text style={[styles.levelPercentage, { color: getConfidenceColor(confidence) }]}>
          {(confidence * 100).toFixed(1)}%
        </Text>
      </View>

      <View style={styles.confidenceDescription}>
        <Text style={styles.descriptionText}>{getConfidenceDescription(level)}</Text>
      </View>
    </View>
  );
};

/**
 * Performance Metrics Section
 */
const PerformanceMetricsSection: React.FC<{ metrics: PerformanceMetrics }> = ({ metrics }) => {
  if (!metrics.performance) return null;

  const perf = metrics.performance;

  return (
    <View style={[styles.card, styles.metricsCard]}>
      <Text style={styles.cardTitle}>Performance Metrics</Text>

      <MetricRow
        label="Sharpe Ratio"
        value={perf.riskAdjustedMetrics.sharpeRatio.toFixed(2)}
        target=">1.5"
        positive={perf.riskAdjustedMetrics.sharpeRatio > 1.5}
      />

      <MetricRow
        label="Sortino Ratio"
        value={perf.riskAdjustedMetrics.sortinoRatio.toFixed(2)}
        target=">2.0"
        positive={perf.riskAdjustedMetrics.sortinoRatio > 2.0}
      />

      <MetricRow
        label="Win Rate"
        value={`${perf.tradeMetrics.winRate.toFixed(1)}%`}
        target=">50%"
        positive={perf.tradeMetrics.winRate > 50}
      />

      <MetricRow
        label="Max Drawdown"
        value={`${(perf.riskMetrics.maxDrawdown * 100).toFixed(2)}%`}
        target="<20%"
        positive={perf.riskMetrics.maxDrawdown < 0.2}
      />

      <MetricRow
        label="Volatility (Annual)"
        value={`${(perf.riskMetrics.volatility * 100).toFixed(2)}%`}
        target="<30%"
        positive={perf.riskMetrics.volatility < 0.3}
      />

      <MetricRow
        label="Profit Factor"
        value={perf.tradeMetrics.profitFactor.toFixed(2)}
        target=">1.0"
        positive={perf.tradeMetrics.profitFactor > 1.0}
      />

      {metrics.accuracy && (
        <>
          <View style={styles.divider} />
          <Text style={[styles.cardTitle, { fontSize: 14, marginTop: 10 }]}>Accuracy Metrics</Text>

          <MetricRow
            label="Hit Rate"
            value={`${metrics.accuracy.hitRate.toFixed(1)}%`}
            target=">52%"
            positive={metrics.accuracy.hitRate > 52}
          />

          <MetricRow
            label="Precision"
            value={`${metrics.accuracy.precision.toFixed(1)}%`}
            target=">60%"
            positive={metrics.accuracy.precision > 60}
          />

          <MetricRow
            label="ROC-AUC"
            value={metrics.accuracy.rocAuc.toFixed(3)}
            target=">0.60"
            positive={metrics.accuracy.rocAuc > 0.6}
          />
        </>
      )}
    </View>
  );
};

/**
 * Metric Row Component
 */
const MetricRow: React.FC<{
  label: string;
  value: string;
  target: string;
  positive: boolean;
}> = ({ label, value, target, positive }) => {
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricLabel}>
        <Text style={styles.metricName}>{label}</Text>
        <Text style={styles.metricTarget}>{target}</Text>
      </View>

      <View style={styles.metricValue}>
        <View
          style={[
            styles.metricBadge,
            { backgroundColor: positive ? '#E8F5E9' : '#FFEBEE' }
          ]}
        >
          <Text style={[styles.metricValueText, { color: positive ? '#2E7D32' : '#C62828' }]}>
            {value}
          </Text>
        </View>
      </View>
    </View>
  );
};

/**
 * Risk Assessment Card
 */
const RiskAssessmentCard: React.FC<{ risk: string }> = ({ risk }) => {
  const riskColor = getRiskColor(risk);

  return (
    <View style={[styles.card, { borderTopColor: riskColor, borderTopWidth: 3 }]}>
      <Text style={styles.cardTitle}>Risk Assessment</Text>

      <View style={styles.riskRow}>
        <View
          style={[
            styles.riskIndicator,
            { backgroundColor: riskColor }
          ]}
        />
        <View style={styles.riskContent}>
          <Text style={styles.riskLevel}>{risk} RISK</Text>
          <Text style={styles.riskDescription}>{getRiskDescription(risk)}</Text>
        </View>
      </View>
    </View>
  );
};

/**
 * Action Buttons
 */
const ActionButtons: React.FC<{ symbol: string; recommendation: string }> = ({ symbol, recommendation }) => {
  const isBullish = recommendation.includes('BUY');

  return (
    <View style={styles.buttonsContainer}>
      <TouchableOpacity
        style={[
          styles.actionButton,
          { backgroundColor: isBullish ? '#4CAF50' : '#9E9E9E' }
        ]}
      >
        <Text style={styles.buttonText}>Buy Now</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.actionButton,
          { backgroundColor: !isBullish ? '#E63946' : '#9E9E9E' }
        ]}
      >
        <Text style={styles.buttonText}>Sell Now</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#2196F3' }]}>
        <Text style={styles.buttonText}>Set Alert</Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Helper Functions
 */

const getRecommendationColor = (type: string): string => {
  switch (type) {
    case 'STRONG_BUY':
    case 'BUY':
      return '#4CAF50';
    case 'STRONG_SELL':
    case 'SELL':
      return '#E63946';
    default:
      return '#FF9800';
  }
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.85) return '#1B5E20';  // Dark green
  if (confidence >= 0.70) return '#4CAF50';  // Green
  if (confidence >= 0.55) return '#FF9800';  // Orange
  if (confidence >= 0.40) return '#FF6F00';  // Dark orange
  return '#E63946';                           // Red
};

const getRiskColor = (risk: string): string => {
  switch (risk) {
    case 'LOW':
      return '#4CAF50';
    case 'MEDIUM':
      return '#FF9800';
    case 'HIGH':
      return '#FF6F00';
    case 'VERY_HIGH':
      return '#E63946';
    default:
      return '#9E9E9E';
  }
};

const getRiskBadgeStyle = (risk: string) => {
  const color = getRiskColor(risk);
  return {
    backgroundColor: color + '20',
    color: color
  };
};

const getConfidenceDescription = (level: string): string => {
  switch (level) {
    case 'VERY_HIGH':
      return 'Act with conviction. Strong multi-source agreement.';
    case 'HIGH':
      return 'Strong signal. Reliable for decision making.';
    case 'MEDIUM':
      return 'Moderate signal. Consider in conjunction with other analysis.';
    case 'LOW':
      return 'Weak signal. Use caution in trading decisions.';
    case 'VERY_LOW':
      return 'Insufficient confidence. Insufficient data sources agreeing.';
    default:
      return 'Unknown confidence level.';
  }
};

const getRiskDescription = (risk: string): string => {
  switch (risk) {
    case 'LOW':
      return 'Conservative position with minimal downside exposure';
    case 'MEDIUM':
      return 'Moderate risk with balanced return potential';
    case 'HIGH':
      return 'Elevated risk. Consider position sizing carefully';
    case 'VERY_HIGH':
      return 'Significant risk. Use only with conviction';
    default:
      return 'Unknown risk level';
  }
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 8
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666'
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  header: {
    paddingVertical: 20
  },
  symbolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  symbol: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333'
  },
  directionEmoji: {
    fontSize: 32
  },
  probabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  labelSmall: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4
  },
  probability: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  signalStrength: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90E2'
  },
  confidenceValue: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  recommendationType: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8
  },
  description: {
    fontSize: 14,
    color: '#555',
    marginBottom: 12
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  action: {
    fontSize: 12,
    color: '#666'
  },
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 'bold'
  },
  signalCard: {
    paddingBottom: 20
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12
  },
  signalRow: {
    marginBottom: 16
  },
  signalInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  signalName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333'
  },
  directionContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  directionText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 4
  },
  strengthText: {
    fontSize: 12,
    color: '#666'
  },
  signalBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden'
  },
  signalBarFill: {
    height: '100%',
    borderRadius: 3
  },
  aggregatedSignalContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0'
  },
  aggregatedLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  aggregatedBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden'
  },
  aggregatedFill: {
    height: '100%',
    borderRadius: 4
  },
  confidenceCard: {
    paddingVertical: 20
  },
  confidenceSegments: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  confidenceSegment: {
    flex: 1,
    height: 10,
    marginHorizontal: 2,
    borderRadius: 5
  },
  confidenceLevelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  levelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333'
  },
  levelPercentage: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  confidenceDescription: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8
  },
  descriptionText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18
  },
  metricsCard: {
    paddingBottom: 20
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  metricLabel: {
    flex: 1
  },
  metricName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333'
  },
  metricTarget: {
    fontSize: 11,
    color: '#999',
    marginTop: 2
  },
  metricValue: {
    flex: 0.4,
    alignItems: 'flex-end'
  },
  metricBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  metricValueText: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  riskIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12
  },
  riskContent: {
    flex: 1
  },
  riskLevel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4
  },
  riskDescription: {
    fontSize: 12,
    color: '#666'
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  buttonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF'
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

export default GNNPredictionScreen;
