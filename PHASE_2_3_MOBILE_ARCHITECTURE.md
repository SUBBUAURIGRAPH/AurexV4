# HMS Phase 2.3: Mobile App Architecture & Implementation Plan

**Date**: October 29, 2025
**Status**: 🎯 Planning Phase
**Target Timeline**: Phase 3 (Post-Phase 2.2)

---

## Executive Summary

This document outlines the comprehensive mobile application architecture for HMS (Hedge Management System). The mobile app will replicate all Phase 2.1 & 2.2 functionality (charts, order execution, position tracking) with native performance and offline capabilities.

**Key Metrics**:
- **Platform**: React Native (iOS/Android)
- **Estimated LOC**: 3,000-4,000
- **Target Timeline**: 3-4 weeks
- **Team Required**: 1 Senior Mobile Dev + 1 Backend Dev
- **Minimum Device Requirements**: iOS 12+, Android 7+

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────┐
│   Mobile App Layer (React Native)       │
├─────────────────────────────────────────┤
│  UI Components                          │
│  ├─ Chart Display (Victory Charts)     │
│  ├─ Order Management UI                 │
│  ├─ Position Dashboard                  │
│  └─ Account Settings                    │
├─────────────────────────────────────────┤
│  State Management (Redux)               │
│  ├─ Orders State                        │
│  ├─ Positions State                     │
│  ├─ Charts Data State                   │
│  └─ User Authentication                 │
├─────────────────────────────────────────┤
│  Services Layer                         │
│  ├─ API Client (REST)                  │
│  ├─ WebSocket Manager                   │
│  ├─ Local Storage (SQLite)              │
│  └─ Biometric Auth                      │
├─────────────────────────────────────────┤
│  Device APIs                            │
│  ├─ Camera (for bill pay scan)         │
│  ├─ Notifications                       │
│  ├─ Geolocation                        │
│  └─ Device Storage                      │
├─────────────────────────────────────────┤
│   Backend API (Node.js/Express)         │
│   (All Phase 2.1 & 2.2 APIs)           │
└─────────────────────────────────────────┘
```

---

## Core Components Breakdown

### 1. Authentication & Security

**Components**:
- **BiometricAuth.js** (200 LOC)
  - Face ID / Touch ID integration
  - JWT token management
  - Secure storage of credentials
  - Session timeout handling

**Features**:
- Biometric login (Face/Fingerprint)
- PIN fallback option
- Session management (30-min timeout)
- Credential encryption with device keystore
- Automatic re-authentication

**Libraries**:
- `react-native-biometrics` - Fingerprint/Face ID
- `react-native-keychain` - Secure credential storage
- `react-native-jwt-decode` - JWT handling

### 2. Charts & Visualizations

**Components**:
- **CandlestickChart.js** (300 LOC)
  - Native chart rendering with Victory Charts
  - Zoom/pan with gesture handlers
  - Technical indicator overlays
  - Real-time updates via WebSocket

- **PortfolioCharts.js** (250 LOC)
  - Pie/doughnut charts for allocation
  - Bar charts for performance
  - Line charts for value history
  - Sector breakdown visualization

**Features**:
- Smooth animations
- Touch gestures (pinch zoom, pan)
- Real-time data updates
- Offline fallback to cached data
- Custom color schemes

**Libraries**:
- `react-native-chart-kit` - Chart rendering
- `react-native-svg` - Vector graphics
- `react-native-gesture-handler` - Touch interactions
- `react-native-reanimated` - Smooth animations

### 3. Order Management

**Components**:
- **OrderForm.js** (250 LOC)
  - Order creation interface
  - Form validation
  - Order type selection (market, limit, stop)
  - Buy/sell toggle

- **OrderConfirmation.js** (200 LOC)
  - Review order details
  - Display estimated cost/P&L impact
  - Confirm/cancel actions
  - Risk warnings

- **OrderList.js** (200 LOC)
  - List all user orders
  - Filter by status/symbol
  - Swipe to cancel
  - Real-time status updates

**Features**:
- One-tap order submission
- Pre-filled favorite symbols
- Order templates
- Order history
- Quick order actions

### 4. Position Tracking

**Components**:
- **PositionsList.js** (250 LOC)
  - Display all open positions
  - Sortable by value/return
  - Color-coded gains/losses
  - Tap to view details

- **PositionDetail.js** (200 LOC)
  - Detailed position analysis
  - Entry/exit pricing
  - Profit/loss calculation
  - Position history chart

**Features**:
- Real-time position updates
- Sector allocation view
- Concentration warnings
- Quick actions (buy more, sell all)
- Position-specific P&L

### 5. Dashboard & Home

**Components**:
- **Dashboard.js** (300 LOC)
  - Portfolio summary
  - Account balance
  - Day P&L
  - Quick action buttons
  - Market news feed

**Features**:
- Customizable layout
- Pinned favorites
- Market alerts
- Performance summary
- Trading activity feed

### 6. State Management (Redux)

**Store Structure**:
```javascript
{
  auth: {
    user: { id, email, token },
    isAuthenticated: boolean,
    biometricEnabled: boolean
  },
  orders: {
    pending: [],
    active: [],
    completed: [],
    loading: boolean,
    error: null
  },
  positions: {
    list: [],
    metrics: { totalValue, totalPL, ... },
    loading: boolean,
    lastSync: timestamp
  },
  charts: {
    candlestick: { data, indicators, ... },
    portfolio: { allocation, performance, ... },
    cache: {}
  },
  settings: {
    theme: 'light|dark',
    notifications: boolean,
    refreshInterval: number
  }
}
```

**Redux Middleware**:
- Redux Thunk for async operations
- Redux Logger for debugging
- Redux Persist for offline storage

---

## API Integration Strategy

### API Client Setup

```javascript
// services/api-client.js
class APIClient {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  async request(method, endpoint, data) {
    // Implement retry logic
    // Handle network errors
    // Manage authentication
    // Queue requests when offline
  }

  // Create order
  async createOrder(orderRequest) {}

  // Confirm order
  async confirmOrder(confirmationToken) {}

  // Get positions
  async getPositions() {}

  // Get charts
  async getChartData(symbol, period) {}

  // Get P&L
  async getPnL() {}
}
```

### WebSocket Integration

```javascript
// services/websocket-client.js
class MobileWebSocketClient extends EventEmitter {
  constructor(brokerURL) {
    this.url = brokerURL;
    this.socket = null;
    this.subscriptions = new Set();
  }

  connect() {
    // Establish WebSocket
    // Implement reconnection logic
    // Handle offline/online transitions
  }

  subscribeToOrderUpdates(orderId) {}
  subscribeToPositionUpdates() {}
  subscribeToAccountUpdates() {}
}
```

---

## Offline Strategy

### Local Data Storage (SQLite)

**Tables**:
- **users** - User profile & settings
- **orders** - Local order cache
- **positions** - Position snapshots
- **transactions** - Transaction history
- **cache** - API response cache

**Sync Strategy**:
1. Store all data locally
2. Queue API calls when offline
3. Sync on reconnection
4. Handle conflicts (server version wins)
5. Maintain 30-day history

**Implementation**:
```javascript
// services/sqlite-storage.js
class SQLiteStorage {
  async saveOrder(order) {
    // Save to SQLite
    // Update Redux state
    // Queue for sync
  }

  async getOrdersByStatus(status) {}

  async syncWithServer() {
    // Sync pending orders
    // Fetch latest positions
    // Update cache
  }
}
```

---

## Push Notifications

**Types**:
- **Order Executed** - When order fills
- **Order Rejected** - Order cancelled
- **Price Alert** - Symbol reaches threshold
- **Position Update** - Major position change
- **P&L Alert** - Daily loss/gain threshold

**Implementation**:
```javascript
// services/push-notifications.js
import PushNotification from 'react-native-push-notification';

class NotificationManager {
  async setupNotifications(userId) {
    // Configure Firebase Cloud Messaging
    // Request user permissions
    // Register device token
  }

  async handleNotification(notification) {
    // Parse notification type
    // Navigate to relevant screen
    // Update app state
  }
}
```

---

## Security Measures

### Authentication

- **Biometric Login**
  - Face ID (iOS)
  - Touch ID (iOS)
  - Fingerprint (Android)
  - PIN fallback

- **Token Management**
  - Secure storage in device keychain
  - Automatic refresh on expiry
  - Logout on failed authentication

### Data Protection

- **Encryption**
  - End-to-end encryption for sensitive data
  - HTTPS for all API calls
  - SQLite encryption with SQLCipher

- **Certificate Pinning**
  - Pin API certificate
  - Validate server identity
  - Prevent MITM attacks

---

## Performance Optimization

### Bundle Size

**Target**: < 30MB IPA (iOS), < 20MB APK (Android)

**Optimization Strategies**:
1. Code splitting
2. Lazy loading of screens
3. Tree shaking unused code
4. Image optimization
5. ProGuard obfuscation (Android)

### Runtime Performance

**Goals**:
- App startup: < 2 seconds
- Navigation: < 500ms
- Chart render: < 1 second
- Order submission: < 1 second

**Techniques**:
1. Memoization of components
2. Virtual lists for large datasets
3. Image caching
4. Network request batching
5. Progressive data loading

---

## Phase 3 Implementation Timeline

### Week 1: Foundation & Auth
- [ ] Setup React Native project
- [ ] Configure Redux store
- [ ] Implement biometric authentication
- [ ] Setup API client & WebSocket
- [ ] Secure credential storage

### Week 2: Charts & Dashboard
- [ ] Implement candlestick chart
- [ ] Create portfolio visualizations
- [ ] Build dashboard UI
- [ ] Connect to WebSocket streams
- [ ] Real-time data updates

### Week 3: Orders & Trading
- [ ] Create order form & validation
- [ ] Implement confirmation workflow
- [ ] Build order list & details
- [ ] Add order history
- [ ] Quick action buttons

### Week 4: Positions & P&L
- [ ] Position list & detail views
- [ ] P&L calculations & display
- [ ] Sector allocation view
- [ ] Position alerts
- [ ] Transaction history

### Week 5: Polish & Testing
- [ ] UI/UX refinements
- [ ] Performance optimization
- [ ] Unit & integration tests
- [ ] Beta testing
- [ ] App store submission prep

---

## Testing Strategy

### Unit Tests
- Redux actions & reducers
- API client methods
- Calculation functions
- Utility functions
- **Target**: 80%+ coverage

### Integration Tests
- Screen flows
- API integration
- WebSocket connections
- Offline sync
- Authentication flows

### E2E Tests
- Critical user journeys
- Order submission flow
- Position management
- Chart interactions
- Biometric login

**Tools**:
- Jest for unit tests
- React Native Testing Library
- Detox for E2E tests

---

## Deployment Strategy

### App Store Requirements

**iOS**:
- Xcode 12+
- Deployment target: iOS 12+
- 64-bit architecture
- App Store Connect account
- TestFlight beta testing

**Android**:
- Android Studio 4+
- Min SDK: 21
- Target SDK: 31+
- Google Play Console account
- Beta testing via Google Play

### Release Process

1. **Beta Testing** (1-2 weeks)
   - Internal testing
   - Beta users (TestFlight/Google Play)
   - Feedback collection

2. **Store Submission** (3-5 days review)
   - App Store review
   - Play Store review
   - Address any rejections

3. **Public Release**
   - Staged rollout (10% → 50% → 100%)
   - Monitor crash reports
   - Respond to user feedback

---

## Cost Estimation

### Development
- Senior Mobile Developer: 200 hours @ $150/hr = $30,000
- Backend Support: 40 hours @ $120/hr = $4,800
- QA/Testing: 60 hours @ $100/hr = $6,000

### Infrastructure
- Firebase Cloud Messaging: $1/1000 notifications ≈ $100/month
- App Store/Play Store: $99/year (iOS) + $25/year (Android)
- TestFlight/Beta: Included

### Total Estimated Cost
- **Development**: $40,800
- **Monthly Infrastructure**: $100
- **Annual**: $41,000 + ($100 × 12)

---

## Success Criteria

### Functional Requirements
- ✅ All Phase 2.1 & 2.2 features available on mobile
- ✅ Biometric authentication working
- ✅ Real-time order/position updates
- ✅ Offline capability for 24 hours
- ✅ Push notifications for orders & alerts

### Non-Functional Requirements
- ✅ App startup < 2 seconds
- ✅ Chart rendering < 1 second
- ✅ Order submission < 1 second
- ✅ Bundle size < 30MB (iOS), < 20MB (Android)
- ✅ Crash-free rate > 99.5%
- ✅ Battery impact < 5% per hour

### Quality Metrics
- ✅ Unit test coverage > 80%
- ✅ E2E test coverage for critical flows
- ✅ Zero critical security issues
- ✅ 4.5+ star app store rating

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| WebSocket reconnection issues | Medium | High | Implement exponential backoff, fallback to polling |
| Offline sync conflicts | Medium | Medium | Server-side conflict resolution, retry logic |
| Chart rendering performance | Low | High | Use native C++ bridge, cache chart data |
| Biometric integration issues | Low | Medium | Implement PIN fallback, test on multiple devices |
| App store rejection | Low | High | Pre-review with Apple/Google, follow guidelines |
| Battery drain from WebSocket | Medium | High | Implement intelligent reconnection, background limits |

---

## Dependencies & Prerequisites

### Technical Stack
- **Framework**: React Native 0.70+
- **State Management**: Redux + Redux Thunk
- **Navigation**: React Navigation 6+
- **Charts**: Victory Charts / react-native-chart-kit
- **Database**: SQLite (react-native-sqlite-storage)
- **Storage**: react-native-keychain
- **Biometrics**: react-native-biometrics

### External Services
- ✅ Broker API (Alpaca) with WebSocket support
- ✅ Backend APIs from Phase 2.1 & 2.2
- ✅ Firebase for push notifications
- ✅ App Store & Play Store developer accounts

### Team & Skills
- 1 Senior React Native developer (3+ years)
- 1 Backend/DevOps engineer
- 1 QA engineer
- Mobile security expertise recommended

---

## Next Steps

1. **Approve Architecture** - Stakeholder sign-off
2. **Setup Development Environment** - Install React Native CLI, SDKs
3. **Create Project Structure** - Initialize React Native app
4. **Begin Phase 3 Development** - Start with Week 1 tasks
5. **Continuous Testing** - Daily builds and testing

---

## Appendix: Tech Stack Justification

### Why React Native?

**Advantages**:
- Single codebase for iOS & Android
- 80%+ code sharing between platforms
- Large ecosystem and community
- Fast development cycle
- Hot reload for rapid iteration

**Considerations**:
- Performance may not match native apps
- Some platform-specific issues
- Requires knowledge of native SDKs
- Build size can be larger

### Chart Library Choice

**Considered Options**:
1. **Victory Charts** - Recommended
   - Pure JavaScript, good for React Native
   - Extensive customization
   - Good performance

2. **react-native-chart-kit**
   - Canvas-based, good performance
   - Simpler API
   - Less customization

3. **Native Implementation**
   - Best performance
   - High development cost
   - Platform-specific code

---

## Conclusion

The mobile app will extend HMS's capabilities to on-the-go trading with all the power of the web platform. By leveraging React Native, we achieve rapid development while maintaining high performance and user experience. The offline-first approach ensures trading can continue even with poor connectivity.

**Estimated Completion**: Q1 2026
**Launch Target**: App Store & Play Store

---

**Document Version**: 1.0
**Last Updated**: October 29, 2025
**Status**: 🎯 Approved for Planning
