# GNN Mobile Integration Guide

**Status**: ✅ Complete
**Platform**: React Native (iOS/Android)
**Language**: TypeScript
**Version**: 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Mobile Components](#mobile-components)
5. [API Integration](#api-integration)
6. [Usage Examples](#usage-examples)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The GNN mobile integration provides a complete React Native application for displaying stock price predictions, signals, confidence scores, and performance metrics calculated by the HMS GNN prediction system.

### Features

✅ **Real-time Predictions** - Live stock predictions with confidence scoring
✅ **Signal Visualization** - Visual breakdown of technical, fundamental, GNN, and graph signals
✅ **Confidence Indicators** - Visual confidence gauge with 5 levels
✅ **Performance Metrics** - Sharpe ratio, Sortino, Calmar, Win Rate, and more
✅ **Prediction History** - Track recent predictions with filtering
✅ **Market Consensus** - View overall market sentiment
✅ **Risk Assessment** - Risk level analysis with descriptions
✅ **Alerts** - Set custom price and signal alerts
✅ **Watchlist** - Manage favorite stocks
✅ **Real-time Sync** - Auto-refresh with configurable intervals

---

## Installation

### 1. Prerequisites

```bash
Node.js >= 14.0
npm >= 6.0 or yarn >= 1.22
React Native CLI
Xcode (for iOS)
Android Studio (for Android)
```

### 2. Install Dependencies

```bash
cd C:\subbuworking\HMS\plugin\mobile

npm install
# or
yarn install
```

### 3. Required Packages

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-native": "^0.71.0",
    "@react-navigation/native": "^6.0.0",
    "@react-navigation/bottom-tabs": "^6.0.0",
    "@react-navigation/stack": "^6.0.0",
    "@tanstack/react-query": "^4.0.0",
    "axios": "^1.3.0",
    "react-native-chart-kit": "^6.12.0",
    "@react-native-async-storage/async-storage": "^1.17.0"
  }
}
```

### 4. Install iOS Dependencies

```bash
cd ios
pod install
cd ..
```

### 5. Build and Run

```bash
# iOS
npm run ios

# Android
npm run android

# Run on specific device
npm run ios -- --device "iPhone 14"
```

---

## Configuration

### 1. Initialize API Service

In your app's entry point (App.tsx or main.ts):

```typescript
import { initializeGNNAPI } from './api/GNNPredictionAPI';

export default function App() {
  useEffect(() => {
    // Initialize GNN API with backend URL
    initializeGNNAPI({
      baseURL: 'https://api.hms-trading.com',  // or http://localhost:3000
      timeout: 10000,
      retries: 2
    });
  }, []);

  return (
    // Your app components
  );
}
```

### 2. Configure Navigation

```typescript
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import GNNPredictionScreen from './screens/GNNPredictionScreen';
import GNNHistoryScreen from './screens/GNNHistoryScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function GNNStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#4A90E2',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        }
      }}
    >
      <Stack.Screen
        name="Prediction"
        component={GNNPredictionScreen}
        options={{ title: 'GNN Predictions' }}
      />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          // Return appropriate icon based on route
          return focused ? <Icon name={route.name} /> : null;
        },
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: '#999'
      })}
    >
      <Tab.Screen
        name="Predictions"
        component={GNNStack}
        options={{ title: 'Predictions' }}
      />
      <Tab.Screen
        name="History"
        component={GNNHistoryScreen}
        options={{ title: 'History' }}
      />
    </Tab.Navigator>
  );
}
```

### 3. Configure Redux (Optional)

For state management of cached predictions:

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { predictionSlice } from './store/predictionSlice';

const store = configureStore({
  reducer: {
    predictions: predictionSlice.reducer
  }
});

export default store;
```

---

## Mobile Components

### 1. GNNPredictionScreen

**Location**: `screens/GNNPredictionScreen.tsx`

**Purpose**: Displays comprehensive prediction details for a single stock

**Props**:
```typescript
interface Props {
  symbol: string;  // Stock symbol (e.g., "AAPL")
}
```

**Features**:
- Prediction header with symbol and probability
- Signal breakdown visualization
- Confidence indicator with visual gauge
- Performance metrics dashboard
- Risk assessment card
- Action buttons (Buy, Sell, Set Alert)
- Auto-refresh every minute

**Usage**:
```typescript
<GNNPredictionScreen symbol="AAPL" />
```

**Sub-components**:
- `PredictionHeader` - Symbol, price, direction
- `RecommendationCard` - Buy/Sell/Hold recommendation
- `SignalBreakdown` - Individual signal sources
- `ConfidenceIndicator` - 5-segment confidence gauge
- `PerformanceMetricsSection` - Sharpe, Sortino, Win Rate, etc.
- `RiskAssessmentCard` - Risk level with description
- `ActionButtons` - Trading action buttons

---

### 2. GNNHistoryScreen

**Location**: `screens/GNNHistoryScreen.tsx`

**Purpose**: Displays prediction history, consensus, and statistics

**Features**:
- Recent predictions list with filtering
- Performance trend charts
- Market consensus visualization
- Accuracy and performance metrics
- Filter by recommendation type
- Pull-to-refresh functionality
- Auto-refresh every 2 minutes

**Sub-components**:
- `HeaderStats` - Quick stats cards
- `FilterTabs` - Filter by ALL/BUY/SELL/NEUTRAL
- `PerformanceCharts` - Trend visualization
- `ConsensusSection` - Market sentiment
- `PredictionsList` - Historical predictions
- `PredictionRow` - Individual prediction item

---

### 3. Signal Row Component

**Location**: `screens/GNNPredictionScreen.tsx`

**Purpose**: Displays individual signal source

**Props**:
```typescript
interface Props {
  name: string;           // "Technical Analysis"
  strength: number;       // 0-1 strength
  direction: string;      // UP/DOWN/NEUTRAL
  color: string;         // Color for visualization
}
```

**Visual Elements**:
- Signal name
- Direction arrow (↑/↓/→)
- Strength bar
- Percentage value

---

### 4. Metric Row Component

**Location**: `screens/GNNPredictionScreen.tsx`

**Purpose**: Displays performance metric

**Props**:
```typescript
interface Props {
  label: string;        // "Sharpe Ratio"
  value: string;        // "1.85"
  target: string;       // ">1.5"
  positive: boolean;    // Color indicator
}
```

---

## API Integration

### 1. GNNPredictionAPI Service

**Location**: `api/GNNPredictionAPI.ts`

**Initialization**:
```typescript
import { initializeGNNAPI } from './api/GNNPredictionAPI';

initializeGNNAPI({
  baseURL: 'https://api.hms-trading.com',
  timeout: 10000,
  retries: 2
});
```

### 2. Available Methods

#### Predictions
```typescript
// Get single prediction
const prediction = await GNNPredictionAPI.getPrediction('AAPL');

// Get batch predictions
const predictions = await GNNPredictionAPI.getBatchPredictions(['AAPL', 'MSFT', 'GOOGL']);

// Get detailed metrics
const metrics = await GNNPredictionAPI.getMetrics('AAPL');

// Get prediction breakdown
const breakdown = await GNNPredictionAPI.getPredictionBreakdown('AAPL');
```

#### History & Consensus
```typescript
// Get prediction history
const history = await GNNPredictionAPI.getHistory({
  type: 'BUY',  // or 'SELL', 'NEUTRAL', 'ALL'
  limit: 20,
  symbol: 'AAPL'
});

// Get market consensus
const consensus = await GNNPredictionAPI.getConsensus();

// Get performance metrics
const performance = await GNNPredictionAPI.getPerformance();

// Get sector consensus
const sectorConsensus = await GNNPredictionAPI.getSectorConsensus('TECH');
```

#### Graph Analysis
```typescript
// Get overall graph
const graph = await GNNPredictionAPI.getGraphAnalysis();

// Get stock neighbors
const neighbors = await GNNPredictionAPI.getGraphAnalysis('AAPL');

// Compare predictions
const comparison = await GNNPredictionAPI.comparePredictions(['AAPL', 'MSFT', 'GOOGL']);
```

#### Alerts
```typescript
// Create alert
const alert = await GNNPredictionAPI.createAlert('AAPL', {
  type: 'SIGNAL',
  value: 0.75,
  condition: 'ABOVE'
});

// Get alerts
const alerts = await GNNPredictionAPI.getAlerts();

// Update alert
await GNNPredictionAPI.updateAlert(alertId, {
  value: 0.80
});

// Delete alert
await GNNPredictionAPI.deleteAlert(alertId);
```

#### Watchlist
```typescript
// Get watchlist
const watchlist = await GNNPredictionAPI.getWatchlist();

// Add to watchlist
await GNNPredictionAPI.addToWatchlist('AAPL');

// Remove from watchlist
await GNNPredictionAPI.removeFromWatchlist('AAPL');
```

#### Utilities
```typescript
// Get model info
const modelInfo = await GNNPredictionAPI.getModelInfo();

// Health check
const isHealthy = await GNNPredictionAPI.healthCheck();

// Get trending
const trending = await GNNPredictionAPI.getTrendingSymbols(10);

// Export predictions
const csvBlob = await GNNPredictionAPI.exportPredictions('CSV');
```

### 3. Error Handling

```typescript
import { GNNPredictionAPI } from './api/GNNPredictionAPI';

try {
  const prediction = await GNNPredictionAPI.getPrediction('AAPL');
} catch (error) {
  if (error.message.includes('401')) {
    // Handle auth error
  } else if (error.message.includes('429')) {
    // Handle rate limit
  } else {
    // Handle other errors
  }
}
```

---

## Usage Examples

### 1. Display Single Stock Prediction

```typescript
import React from 'react';
import GNNPredictionScreen from './screens/GNNPredictionScreen';

export default function StockDetailScreen({ route }) {
  const { symbol } = route.params;

  return <GNNPredictionScreen symbol={symbol} />;
}
```

### 2. Create Watchlist Screen

```typescript
import React, { useEffect, useState } from 'react';
import { View, FlatList, TouchableOpacity, Text } from 'react-native';
import { GNNPredictionAPI } from './api/GNNPredictionAPI';

export default function WatchlistScreen() {
  const [watchlist, setWatchlist] = useState([]);

  useEffect(() => {
    GNNPredictionAPI.getWatchlist().then(setWatchlist);
  }, []);

  return (
    <View>
      <FlatList
        data={watchlist}
        keyExtractor={(item) => item.symbol}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('Prediction', { symbol: item.symbol })}
          >
            <Text>{item.symbol}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
```

### 3. Set Price Alert

```typescript
async function setPriceAlert(symbol: string, price: number) {
  try {
    const alert = await GNNPredictionAPI.createAlert(symbol, {
      type: 'PRICE',
      value: price,
      condition: 'ABOVE'
    });

    Alert.alert('Alert Created', `Will notify when ${symbol} goes above $${price}`);
  } catch (error) {
    Alert.alert('Error', error.message);
  }
}
```

### 4. Compare Multiple Stocks

```typescript
async function compareStocks(symbols: string[]) {
  const comparison = await GNNPredictionAPI.comparePredictions(symbols);

  // Display comparison results
  const sorted = comparison.predictions.sort((a, b) => b.confidence - a.confidence);

  return (
    <View>
      {sorted.map((pred) => (
        <View key={pred.symbol}>
          <Text>{pred.symbol}</Text>
          <Text>{pred.recommendation.type}</Text>
          <Text>{(pred.confidence * 100).toFixed(0)}%</Text>
        </View>
      ))}
    </View>
  );
}
```

### 5. Display Market Consensus

```typescript
import React, { useEffect, useState } from 'react';
import { GNNPredictionAPI } from './api/GNNPredictionAPI';
import ConsensusSection from './screens/GNNHistoryScreen';

export default function MarketConsensusScreen() {
  const [consensus, setConsensus] = useState(null);

  useEffect(() => {
    GNNPredictionAPI.getConsensus().then(setConsensus);
  }, []);

  if (!consensus) return <Loading />;

  return <ConsensusSection consensus={consensus} />;
}
```

---

## Best Practices

### 1. Caching Strategy

```typescript
// Use React Query for automatic caching
const { data, isLoading, refetch } = useQuery({
  queryKey: ['gnnPrediction', symbol],
  queryFn: () => GNNPredictionAPI.getPrediction(symbol),
  staleTime: 60000,      // 1 minute
  cacheTime: 300000,     // 5 minutes
  refetchInterval: 60000 // Auto-refetch every minute
});
```

### 2. Performance Optimization

```typescript
// Use React.memo to prevent unnecessary re-renders
const PredictionCard = React.memo(({ prediction }) => {
  return <View>{/* Content */}</View>;
}, (prevProps, nextProps) => {
  return prevProps.prediction.symbol === nextProps.prediction.symbol &&
         prevProps.prediction.confidence === nextProps.prediction.confidence;
});
```

### 3. Error Handling

```typescript
// Implement proper error boundaries
<ErrorBoundary
  onError={(error) => {
    console.error('GNN Error:', error);
    // Report to analytics
  }}
>
  <GNNPredictionScreen symbol={symbol} />
</ErrorBoundary>
```

### 4. Loading States

```typescript
// Show proper loading indicators
if (isLoading) {
  return <ActivityIndicator size="large" color="#4A90E2" />;
}

if (error) {
  return <ErrorView error={error} onRetry={refetch} />;
}

return <Content data={data} />;
```

### 5. Network Optimization

```typescript
// Implement offline support with AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

async function getPredictionWithFallback(symbol) {
  try {
    return await GNNPredictionAPI.getPrediction(symbol);
  } catch (error) {
    // Fall back to cached data
    const cached = await AsyncStorage.getItem(`prediction_${symbol}`);
    return cached ? JSON.parse(cached) : null;
  }
}
```

---

## Troubleshooting

### Issue: API Connection Error

**Symptoms**: "No response from server"

**Solutions**:
1. Verify backend API is running
2. Check baseURL configuration
3. Verify network connectivity
4. Check CORS settings on backend

```typescript
// Debug connection
const isHealthy = await GNNPredictionAPI.healthCheck();
console.log('API Health:', isHealthy);
```

### Issue: Slow Prediction Loading

**Symptoms**: Screen takes >2 seconds to load

**Solutions**:
1. Reduce data size in API responses
2. Implement pagination for history
3. Use lazy loading for indicators
4. Cache aggressively

```typescript
// Implement pagination
const { data } = useQuery({
  queryKey: ['predictions', page],
  queryFn: () => GNNPredictionAPI.getHistory({ limit: 20, offset: page * 20 })
});
```

### Issue: Memory Leaks

**Symptoms**: App becomes slow over time

**Solutions**:
1. Properly cancel queries on unmount
2. Clear old cache entries
3. Use React.memo for components

```typescript
useEffect(() => {
  return () => {
    // Cancel pending requests
    queryClient.cancelQueries();
  };
}, []);
```

### Issue: Stale Data

**Symptoms**: Seeing outdated predictions

**Solutions**:
1. Reduce staleTime
2. Increase refetchInterval
3. Implement manual refresh button

```typescript
<TouchableOpacity onPress={() => refetch()}>
  <Text>Refresh</Text>
</TouchableOpacity>
```

---

## Environment Variables

Create `.env` file:

```
REACT_APP_API_URL=https://api.hms-trading.com
REACT_APP_API_TIMEOUT=10000
REACT_APP_ENABLE_LOGGING=true
REACT_APP_LOG_LEVEL=info
```

Use in code:

```typescript
const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
```

---

## Performance Metrics

### Target Load Times
- Prediction screen: <500ms
- History screen: <1000ms
- API request: <200ms
- Memory usage: <100MB
- Battery impact: Minimal (idle mode between updates)

### Optimization Tips
- Use FlatList instead of ScrollView for long lists
- Implement image caching
- Debounce search inputs
- Batch network requests

---

## Next Steps

1. **Push Notifications**: Implement alert notifications
2. **Offline Support**: Full offline capability with sync
3. **Dark Mode**: Implement theme switching
4. **Biometric Auth**: Add fingerprint/face login
5. **Portfolio Integration**: Connect to brokerage APIs
6. **Advanced Charts**: Add more technical analysis charts

---

## Support

- **Backend API Docs**: See `GNN_IMPLEMENTATION_GUIDE.md`
- **Component Props**: Check TypeScript interfaces in component files
- **API Methods**: See `GNNPredictionAPI.ts` documentation
- **Troubleshooting**: See section above

---

**Status**: ✅ Production Ready
**Last Updated**: October 30, 2025
**Version**: 1.0.0

