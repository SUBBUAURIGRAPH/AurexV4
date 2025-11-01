/**
 * Market Calendars Integration
 * Provides access to economic and earnings calendars
 *
 * Features:
 * - Economic event calendar
 * - Earnings calendar
 * - Volatility impact assessment
 * - Trading restrictions during key events
 */

const EventEmitter = require('events');
const uuid = require('uuid');

class MarketCalendars extends EventEmitter {
  constructor() {
    super();
    this.economicEvents = new Map();
    this.earningsCalendar = new Map();
    this.userAlerts = new Map();
  }

  /**
   * Add economic event
   */
  addEconomicEvent(eventData) {
    const {
      id,
      country,
      eventName,
      eventType, // 'interest_rate', 'inflation', 'employment', 'gdp', etc.
      scheduledTime,
      importance, // 'low', 'medium', 'high'
      forecast,
      previous,
      symbols // Array of affected symbols
    } = eventData;

    const eventId = id || uuid.v4();

    const event = {
      id: eventId,
      country,
      eventName,
      eventType,
      scheduledTime: new Date(scheduledTime),
      importance,
      forecast,
      previous,
      actual: null,
      symbols: symbols || [],
      status: 'scheduled',
      impact: null,
      createdAt: new Date(),
      source: 'economic_calendar'
    };

    this.economicEvents.set(eventId, event);
    this.emit('event:added:economic', event);

    return event;
  }

  /**
   * Add earnings report
   */
  addEarningsReport(reportData) {
    const {
      id,
      symbol,
      company,
      reportDate,
      reportTime,
      epsEstimate,
      revenueEstimate,
      fiscalPeriod,
      importance // 'low', 'medium', 'high'
    } = reportData;

    const reportId = id || uuid.v4();

    const report = {
      id: reportId,
      symbol,
      company,
      reportDate: new Date(reportDate),
      reportTime,
      epsEstimate,
      revenueEstimate,
      actualEPS: null,
      actualRevenue: null,
      surprise: null, // (Actual - Estimate) / Estimate
      fiscalPeriod,
      importance,
      status: 'scheduled',
      createdAt: new Date(),
      source: 'earnings_calendar'
    };

    // Use symbol as key for quick lookup
    const symbolKey = symbol.toUpperCase();
    if (!this.earningsCalendar.has(symbolKey)) {
      this.earningsCalendar.set(symbolKey, []);
    }
    this.earningsCalendar.get(symbolKey).push(report);

    this.emit('event:added:earnings', report);

    return report;
  }

  /**
   * Get upcoming economic events
   */
  getUpcomingEconomicEvents(daysAhead = 7) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const upcoming = [];
    for (const event of this.economicEvents.values()) {
      if (event.scheduledTime >= now && event.scheduledTime <= futureDate) {
        upcoming.push(event);
      }
    }

    // Sort by time
    upcoming.sort((a, b) => a.scheduledTime - b.scheduledTime);

    return upcoming;
  }

  /**
   * Get upcoming earnings for a symbol
   */
  getSymbolEarnings(symbol, daysAhead = 90) {
    const symbolKey = symbol.toUpperCase();
    const reports = this.earningsCalendar.get(symbolKey) || [];

    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const upcoming = reports.filter(r => {
      return r.reportDate >= now && r.reportDate <= futureDate;
    });

    return upcoming.sort((a, b) => a.reportDate - b.reportDate);
  }

  /**
   * Get economic events for specific countries
   */
  getCountryEvents(countries = [], daysAhead = 7) {
    const countrySet = new Set(countries.map(c => c.toUpperCase()));
    const events = this.getUpcomingEconomicEvents(daysAhead);

    return events.filter(e => countrySet.has(e.country.toUpperCase()));
  }

  /**
   * Get high-impact events
   */
  getHighImpactEvents(daysAhead = 7, importance = ['high']) {
    const events = this.getUpcomingEconomicEvents(daysAhead);
    return events.filter(e => importance.includes(e.importance));
  }

  /**
   * Create alert for economic event
   */
  createEconomicEventAlert(userId, eventId, config = {}) {
    const event = this.economicEvents.get(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    const alertId = uuid.v4();

    const alert = {
      id: alertId,
      userId,
      eventId,
      eventName: event.eventName,
      type: 'economic_event',
      triggerTime: new Date(event.scheduledTime.getTime() - (config.minutesBefore || 15) * 60 * 1000),
      status: 'active',
      createdAt: new Date(),
      notifyUser: config.notifyUser !== false,
      restrictTrading: config.restrictTrading || false,
      symbols: event.symbols
    };

    if (!this.userAlerts.has(userId)) {
      this.userAlerts.set(userId, []);
    }
    this.userAlerts.get(userId).push(alert);

    this.emit('alert:created', alert);

    return alert;
  }

  /**
   * Create alert for earnings report
   */
  createEarningsAlert(userId, reportId, config = {}) {
    const reports = Array.from(this.earningsCalendar.values()).flat();
    const report = reports.find(r => r.id === reportId);

    if (!report) {
      throw new Error('Earnings report not found');
    }

    const alertId = uuid.v4();

    const alert = {
      id: alertId,
      userId,
      reportId,
      symbol: report.symbol,
      company: report.company,
      type: 'earnings',
      triggerTime: new Date(report.reportDate.getTime() - (config.daysBefore || 1) * 24 * 60 * 60 * 1000),
      reportTime: report.reportTime,
      status: 'active',
      createdAt: new Date(),
      notifyUser: config.notifyUser !== false,
      restrictTrading: config.restrictTrading || false // Restrict trading before earnings
    };

    if (!this.userAlerts.has(userId)) {
      this.userAlerts.set(userId, []);
    }
    this.userAlerts.get(userId).push(alert);

    this.emit('alert:created', alert);

    return alert;
  }

  /**
   * Get user alerts
   */
  getUserAlerts(userId) {
    return this.userAlerts.get(userId) || [];
  }

  /**
   * Get active alerts (not yet triggered)
   */
  getActiveAlerts(userId) {
    const userAlerts = this.getUserAlerts(userId);
    const now = new Date();

    return userAlerts.filter(alert => {
      return alert.status === 'active' && alert.triggerTime > now;
    });
  }

  /**
   * Check if trading should be restricted
   */
  shouldRestrictTrading(symbol) {
    const now = new Date();
    const restrictions = [];

    // Check earnings
    const earnings = this.getSymbolEarnings(symbol, 1);
    for (const report of earnings) {
      if (report.status === 'scheduled') {
        const timeTillReport = report.reportDate - now;
        if (timeTillReport < 24 * 60 * 60 * 1000) { // Within 24 hours
          restrictions.push({
            type: 'earnings',
            symbol,
            event: report.company,
            time: report.reportDate
          });
        }
      }
    }

    // Check economic events affecting symbol
    const events = this.getHighImpactEvents(1);
    for (const event of events) {
      if (event.symbols.includes(symbol)) {
        const timeToEvent = event.scheduledTime - now;
        if (timeToEvent < 30 * 60 * 1000) { // Within 30 minutes
          restrictions.push({
            type: 'economic_event',
            symbol,
            event: event.eventName,
            time: event.scheduledTime,
            country: event.country
          });
        }
      }
    }

    return restrictions.length > 0 ? restrictions : null;
  }

  /**
   * Record economic event result
   */
  recordEconomicEventResult(eventId, actual, impact = null) {
    const event = this.economicEvents.get(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    event.actual = actual;
    event.status = 'completed';
    event.impact = impact || this.calculateEventImpact(event);

    this.emit('event:completed:economic', event);

    return event;
  }

  /**
   * Record earnings result
   */
  recordEarningsResult(reportId, actualEPS, actualRevenue) {
    const reports = Array.from(this.earningsCalendar.values()).flat();
    const report = reports.find(r => r.id === reportId);

    if (!report) {
      throw new Error('Report not found');
    }

    report.actualEPS = actualEPS;
    report.actualRevenue = actualRevenue;
    report.surprise = actualEPS ? (actualEPS - report.epsEstimate) / report.epsEstimate : null;
    report.status = 'completed';

    this.emit('event:completed:earnings', report);

    return report;
  }

  /**
   * Calculate event impact (placeholder)
   */
  calculateEventImpact(event) {
    // Simplified impact calculation
    if (event.importance === 'high') {
      return event.actual > event.forecast ? 'positive' : 'negative';
    }
    return 'neutral';
  }

  /**
   * Get earnings season dates
   */
  getEarningsSeasonDates(year) {
    // Typical US earnings seasons
    return [
      { season: 'Q1', start: new Date(`${year}-04-01`), end: new Date(`${year}-04-30`) },
      { season: 'Q2', start: new Date(`${year}-07-01`), end: new Date(`${year}-07-31`) },
      { season: 'Q3', start: new Date(`${year}-10-01`), end: new Date(`${year}-10-31`) },
      { season: 'Q4', start: new Date(`${year}-01-01`), end: new Date(`${year}-02-28`) }
    ];
  }

  /**
   * Get volatility forecast for event
   */
  getEventVolatilityForecast(eventId) {
    const event = this.economicEvents.get(eventId);
    if (!event) {
      return null;
    }

    // Return volatility estimate based on event importance
    const volatilityMap = {
      low: 0.01, // 1% expected move
      medium: 0.03, // 3% expected move
      high: 0.05 // 5% expected move
    };

    return {
      eventId,
      expectedVolatility: volatilityMap[event.importance] || 0.01,
      timeWindow: 60 * 60 * 1000, // 1 hour before/after event
      symbols: event.symbols
    };
  }

  /**
   * Get calendar statistics
   */
  getCalendarStatistics(period = 'month') {
    const stats = {
      period,
      economicEventCount: 0,
      earningsReportCount: 0,
      highImpactEvents: 0,
      affectedSymbols: new Set()
    };

    const now = new Date();
    const dayRange = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const futureDate = new Date(now.getTime() + dayRange * 24 * 60 * 60 * 1000);

    for (const event of this.economicEvents.values()) {
      if (event.scheduledTime >= now && event.scheduledTime <= futureDate) {
        stats.economicEventCount += 1;
        if (event.importance === 'high') {
          stats.highImpactEvents += 1;
        }
        event.symbols.forEach(s => stats.affectedSymbols.add(s));
      }
    }

    for (const reports of this.earningsCalendar.values()) {
      for (const report of reports) {
        if (report.reportDate >= now && report.reportDate <= futureDate) {
          stats.earningsReportCount += 1;
          stats.affectedSymbols.add(report.symbol);
        }
      }
    }

    stats.affectedSymbols = Array.from(stats.affectedSymbols);

    return stats;
  }
}

module.exports = MarketCalendars;
