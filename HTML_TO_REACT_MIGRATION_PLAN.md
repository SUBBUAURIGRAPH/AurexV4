# HTML Dashboard → React Migration Plan

**Date**: October 31, 2025
**Status**: 🔄 **PLANNING & IMPLEMENTATION**
**Source**: `build/dashboard.html` (379 lines, Tailwind CSS)
**Target**: `web/src/pages/dashboard/HermesMainDashboard.tsx`

---

## 📋 Migration Overview

### Current State
- **File**: `build/dashboard.html`
- **Size**: 23 KB HTML
- **Type**: Static HTML with inline styles
- **Styling**: Tailwind CSS + inline <style> block
- **Interactivity**: None (static layout)
- **Features**:
  - Sidebar navigation
  - Header with user info
  - 4 metric cards
  - 2 chart sections
  - 2 data tables

### Target State
- **File**: `web/src/pages/dashboard/HermesMainDashboard.tsx`
- **Type**: React functional component with TypeScript
- **Styling**: Tailwind CSS (external), CSS modules for complex styles
- **Interactivity**:
  - Real data from API/Redux
  - Navigation routing
  - Dynamic table data
  - Chart interactivity
  - Status badges
- **Features**:
  - Real-time portfolio updates
  - API integration
  - Redux state management
  - Error handling
  - Loading states
  - Responsive design

---

## 🏗️ Component Structure

### Component Hierarchy
```
HermesMainDashboard (Page)
├── Sidebar
│   ├── Header (Logo + Title)
│   └── Navigation (8 items)
├── MainContent
│   ├── DashboardHeader
│   │   ├── Greeting
│   │   └── UserInfo
│   ├── QuickActions
│   │   └── 4 ActionButtons
│   ├── MetricsGrid
│   │   ├── PortfolioValueCard
│   │   ├── AvailableBalanceCard
│   │   ├── TodayReturnCard
│   │   └── YTDReturnCard
│   ├── ChartsSection
│   │   ├── PerformanceChart
│   │   └── AllocationChart
│   ├── RecentTradesTable
│   └── CurrentHoldingsTable
```

---

## 📁 Files to Create

### 1. Main Dashboard Component
**File**: `web/src/pages/dashboard/HermesMainDashboard.tsx`
**Size**: 400+ LOC
**Exports**: HermesMainDashboard component

### 2. Sidebar Component
**File**: `web/src/components/dashboard/Sidebar.tsx`
**Size**: 150+ LOC
**Features**:
- Navigation items
- Active state
- Responsive toggle (mobile)
- Logo and branding

### 3. Header Component
**File**: `web/src/components/dashboard/DashboardHeader.tsx`
**Size**: 100+ LOC
**Features**:
- Greeting with time
- User info display
- Market status
- AI risk score

### 4. Metrics Cards Component
**File**: `web/src/components/dashboard/MetricsCard.tsx`
**Size**: 100+ LOC
**Features**:
- Portfolio value
- Available balance
- Today's return
- YTD return
- Trend indicators

### 5. Performance Chart Component
**File**: `web/src/components/dashboard/PerformanceChart.tsx`
**Size**: 150+ LOC
**Features**:
- Bar chart visualization
- Time period selector
- Real data integration
- Hover effects

### 6. Asset Allocation Component
**File**: `web/src/components/dashboard/AssetAllocation.tsx`
**Size**: 150+ LOC
**Features**:
- Progress bars
- Percentage display
- Color coding
- Rebalance suggestions

### 7. Recent Trades Table
**File**: `web/src/components/dashboard/RecentTradesTable.tsx`
**Size**: 150+ LOC
**Features**:
- Trade list
- Status badges
- Signal type display
- View all button

### 8. Holdings Table
**File**: `web/src/components/dashboard/HoldingsTable.tsx`
**Size**: 150+ LOC
**Features**:
- Position list
- Gain/loss display
- Risk indicators
- Rebalance button

### 9. Styles (CSS Module)
**File**: `web/src/pages/dashboard/HermesMainDashboard.module.css`
**Size**: 200+ LOC
**Features**:
- Glassmorphism effects
- Gradients
- Animations
- Media queries

---

## 🔄 Migration Steps

### Phase 1: Component Structure (2 hours)
- [ ] Create component folder structure
- [ ] Create all component files
- [ ] Set up TypeScript interfaces
- [ ] Implement basic layout (no data)

### Phase 2: Styling Migration (1.5 hours)
- [ ] Extract inline styles to CSS module
- [ ] Apply Tailwind classes
- [ ] Implement glassmorphism effects
- [ ] Add responsive breakpoints

### Phase 3: Interactivity (2 hours)
- [ ] Implement React hooks (useState, useEffect)
- [ ] Add navigation functionality
- [ ] Add form inputs (timeframe selector)
- [ ] Add button handlers

### Phase 4: Data Integration (2 hours)
- [ ] Connect to Redux store
- [ ] Create API service calls
- [ ] Implement data fetching
- [ ] Add loading states

### Phase 5: Error Handling & Polish (1.5 hours)
- [ ] Add error boundaries
- [ ] Implement fallback UI
- [ ] Add loading spinners
- [ ] Test responsiveness

**Total Estimated Time**: 9 hours

---

## 📊 Data Integration Points

### Redux State
```typescript
portfolio: {
  totalValue: number;
  availableBalance: number;
  cash: number;
  todayReturn: number;
  ytdReturn: number;
  positions: Position[];
  allocation: AssetAllocation[];
}

trades: {
  recentTrades: Trade[];
  currentHoldings: Position[];
}

user: {
  name: string;
  email: string;
  memberType: string;
  joinedDate: Date;
}
```

### API Endpoints
```
GET /api/portfolio/summary
GET /api/portfolio/allocation
GET /api/portfolio/performance/{period}
GET /api/trades/recent
GET /api/trades/holdings
GET /api/user/profile
```

---

## 🎨 Styling Approach

### Color Palette
```css
Primary: #667eea (Indigo)
Secondary: #764ba2 (Purple)
Success: #22c55e (Green)
Warning: #f59e0b (Amber)
Danger: #ef4444 (Red)
Background: #000000 (Black)
Text Primary: #ffffff (White)
Text Secondary: #a1a1a1 (Gray)
```

### Design System
- **Spacing**: 4px base unit (Tailwind)
- **Border Radius**: 8px-20px
- **Shadows**: None (glassmorphism)
- **Glassmorphism**: blur(10px), rgba(255,255,255,0.05)

---

## 🧪 Testing Strategy

### Unit Tests
- MetricsCard component
- Table components
- Chart components
- Sidebar navigation

### Integration Tests
- Dashboard with Redux
- Data fetching and display
- Navigation between pages
- Error handling

### E2E Tests
- Full dashboard flow
- User interactions
- Responsive layout

---

## 📱 Responsive Design

### Breakpoints
- **Mobile** (<768px):
  - Sidebar hidden (toggle)
  - Single column layout
  - Full-width tables
  - Smaller cards

- **Tablet** (768-1024px):
  - Sidebar visible
  - 2-column grid
  - Scrollable tables

- **Desktop** (>1024px):
  - Sidebar visible
  - Full grid layout
  - All features visible

---

## 🚀 Implementation Timeline

### Day 1 (4 hours)
- [ ] Create component structure
- [ ] Implement layout components
- [ ] Apply basic styling
- [ ] Commit: "refactor: Migrate HTML dashboard to React - Part 1"

### Day 2 (3 hours)
- [ ] Add Tailwind styling
- [ ] Implement interactivity
- [ ] Add component state
- [ ] Commit: "refactor: Complete React dashboard styling and interactivity - Part 2"

### Day 3 (2 hours)
- [ ] Integrate with Redux
- [ ] Add API integration
- [ ] Add error handling
- [ ] Commit: "feat: Complete React dashboard with data integration - Part 3"

---

## ✅ Acceptance Criteria

### Functionality
- [ ] All sections render correctly
- [ ] Navigation works
- [ ] Tables display data
- [ ] Charts update
- [ ] Responsive on mobile/tablet/desktop

### Code Quality
- [ ] TypeScript strict mode
- [ ] 80%+ test coverage
- [ ] No console errors
- [ ] Proper error handling

### Performance
- [ ] Load time <1s
- [ ] Smooth interactions
- [ ] No memory leaks
- [ ] Optimized re-renders

### Design
- [ ] Matches original HTML
- [ ] Glassmorphism effects working
- [ ] All colors correct
- [ ] Hover states working

---

## 🔄 Backward Compatibility

### During Migration
- Keep `build/dashboard.html` for fallback
- Both HTML and React versions coexist
- Users can access either version

### After Migration
- Deprecate HTML version
- Archive `build/dashboard.html`
- Full React-based dashboard

---

## 📝 Notes

### Technical Decisions
1. **Tailwind CSS**: Keep using for consistency
2. **TypeScript**: Strict mode for type safety
3. **Redux**: For state management
4. **Hooks**: useState, useEffect, useCallback
5. **Components**: Functional, reusable
6. **Styling**: CSS modules + Tailwind

### Considerations
- Performance: Memoization for expensive renders
- Accessibility: ARIA labels, semantic HTML
- Mobile: Touch-friendly button sizes
- Dark mode: Already implemented
- Real-time: WebSocket for updates

---

**#memorize**: HTML_TO_REACT_MIGRATION - Oct 31, 2025. Migrate build/dashboard.html (379L) to web/src/pages/dashboard/HermesMainDashboard.tsx. Plan: 8 component files (400+ LOC total). Structure: Sidebar + MainContent with 6 sections. Data: Redux + API integration. Styling: Tailwind CSS + CSS modules. Timeline: 9 hours (2-3 days). Breakpoints: mobile/tablet/desktop. Tests: unit/integration/e2e. Deploy: parallel run HTML+React, then switch. Status: PLANNING COMPLETE, ready for implementation. 🚀

---

**Document Version**: 1.0.0
**Date**: October 31, 2025
**Status**: 📋 PLAN COMPLETE - Ready for Implementation
