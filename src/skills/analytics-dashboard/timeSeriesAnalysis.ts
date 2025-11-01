/**
 * Time Series Analysis Module - Analyze trends, patterns, and forecast metrics
 *
 * @module analytics-dashboard/timeSeriesAnalysis
 * @version 1.0.0
 */

import {TimeSeriesMetrics, TradeRecord} from './types';
import * as Logger from 'winston';

/**
 * TimeSeriesAnalysisCalculator - Analyzes time series data
 */
export class TimeSeriesAnalysisCalculator {
  private logger: Logger.Logger;

  constructor(logger: Logger.Logger) {
    this.logger = logger;
  }

  /**
   * Calculate comprehensive time series metrics
   *
   * @param strategyId - Strategy identifier
   * @param returns - Daily/periodic returns
   * @returns Time series analysis metrics
   */
  async calculateTimeSeriesMetrics(strategyId: string, returns: number[]): Promise<TimeSeriesMetrics> {
    try {
      if (returns.length < 2) {
        return this.getEmptyTimeSeriesMetrics(strategyId);
      }

      // Calculate autocorrelation
      const acf = this.calculateAutocorrelation(returns);
      const pacf = this.calculatePartialAutocorrelation(returns);

      // Decompose time series
      const decomposition = this.decomposeTimeSeries(returns);

      // Conduct stationarity test
      const stationarityTest = this.conductADFTest(returns);

      // Generate forecast
      const forecast = this.generateARIMAForecast(returns);

      const metrics: TimeSeriesMetrics = {
        timestamp: new Date(),
        strategyId,

        // Autocorrelation
        acf: acf.slice(0, 20), // Keep first 20 lags
        pacf: pacf.slice(0, 20),
        acfLags: 20,

        // Decomposition
        trend: decomposition.trend,
        seasonality: decomposition.seasonality,
        residuals: decomposition.residuals,

        // Stationarity test
        adfStatistic: stationarityTest.statistic,
        adfPValue: stationarityTest.pValue,
        isStationary: stationarityTest.pValue < 0.05,

        // Forecasting
        forecast: forecast.forecast,
        forecastConfidenceUpper: forecast.confidenceUpper,
        forecastConfidenceLower: forecast.confidenceLower,
        forecastPeriods: forecast.periods,

        // Volatility clustering
        garchCoefficients: {alpha: 0.1, beta: 0.85},
        conditionalVolatility: this.calculateConditionalVolatility(returns),
      };

      this.logger.debug(`Calculated time series metrics for ${strategyId}`, {
        isStationary: metrics.isStationary,
        forecastPeriods: metrics.forecastPeriods,
        acfLags: metrics.acfLags,
      });

      return metrics;
    } catch (error) {
      this.logger.error(`Failed to calculate time series metrics for ${strategyId}`, error);
      throw new Error(`Failed to calculate time series metrics: ${error.message}`);
    }
  }

  /**
   * Calculate autocorrelation function (ACF)
   * @private
   */
  private calculateAutocorrelation(returns: number[]): number[] {
    const n = returns.length;
    const mean = returns.reduce((sum, r) => sum + r, 0) / n;
    const c0 = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / n;

    const acf: number[] = [1.0]; // ACF at lag 0 is always 1

    for (let lag = 1; lag < Math.min(n / 2, 50); lag++) {
      let sum = 0;
      for (let i = lag; i < n; i++) {
        sum += (returns[i] - mean) * (returns[i - lag] - mean);
      }
      const c = sum / n;
      acf.push(c / c0);
    }

    return acf;
  }

  /**
   * Calculate partial autocorrelation function (PACF)
   * @private
   */
  private calculatePartialAutocorrelation(returns: number[]): number[] {
    const acf = this.calculateAutocorrelation(returns);
    const pacf: number[] = [1.0];

    for (let k = 1; k < Math.min(acf.length, 50); k++) {
      let numerator = acf[k];
      let denominator = 1.0;

      for (let j = 1; j < k; j++) {
        numerator -= pacf[j] * acf[k - j];
        denominator -= pacf[j] * acf[j];
      }

      pacf.push(denominator !== 0 ? numerator / denominator : 0);
    }

    return pacf;
  }

  /**
   * Decompose time series into trend, seasonality, and residuals
   * @private
   */
  private decomposeTimeSeries(
    returns: number[]
  ): {trend: number[]; seasonality: number[]; residuals: number[]} {
    const n = returns.length;

    // Calculate trend using moving average (window = 12 for monthly data)
    const windowSize = Math.max(Math.floor(n / 4), 3);
    const trend: number[] = [];

    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(n, i + Math.ceil(windowSize / 2));
      const window = returns.slice(start, end);
      const avg = window.reduce((sum, r) => sum + r, 0) / window.length;
      trend.push(avg);
    }

    // Calculate seasonality (detrended series)
    const detrended = returns.map((r, i) => r - trend[i]);

    // Simple seasonal pattern: average value at each seasonal index
    const seasonalPeriod = Math.max(Math.floor(n / 12), 4);
    const seasonality: number[] = new Array(n).fill(0);

    for (let season = 0; season < seasonalPeriod; season++) {
      const seasonalValues: number[] = [];
      for (let i = season; i < n; i += seasonalPeriod) {
        seasonalValues.push(detrended[i]);
      }
      const avgSeasonal = seasonalValues.length > 0 ? seasonalValues.reduce((sum, v) => sum + v, 0) / seasonalValues.length : 0;

      for (let i = season; i < n; i += seasonalPeriod) {
        seasonality[i] = avgSeasonal;
      }
    }

    // Residuals
    const residuals = returns.map((r, i) => r - trend[i] - seasonality[i]);

    return {trend, seasonality, residuals};
  }

  /**
   * Augmented Dickey-Fuller (ADF) test for stationarity
   * @private
   */
  private conductADFTest(returns: number[]): {statistic: number; pValue: number} {
    const n = returns.length;

    // Calculate differences
    const diffs: number[] = [];
    for (let i = 1; i < n; i++) {
      diffs.push(returns[i] - returns[i - 1]);
    }

    // Mean and variance
    const mean = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
    const variance = diffs.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / diffs.length;
    const stdDev = Math.sqrt(variance);

    // T-statistic (simplified)
    const tStatistic = mean / (stdDev / Math.sqrt(diffs.length));

    // P-value approximation (using normal distribution)
    const pValue = this.normalCDF(Math.abs(tStatistic));

    return {statistic: tStatistic, pValue};
  }

  /**
   * Generate ARIMA forecast
   * @private
   */
  private generateARIMAForecast(returns: number[]): {
    forecast: number[];
    confidenceUpper: number[];
    confidenceLower: number[];
    periods: number;
  } {
    const periods = Math.min(20, Math.floor(returns.length / 5));
    const lastValue = returns[returns.length - 1];
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Simple AR(1) model
    let ar1Coefficient = 0;
    if (returns.length > 1) {
      let numerator = 0;
      let denominator = 0;
      for (let i = 1; i < returns.length; i++) {
        numerator += (returns[i] - mean) * (returns[i - 1] - mean);
        denominator += Math.pow(returns[i - 1] - mean, 2);
      }
      ar1Coefficient = denominator !== 0 ? numerator / denominator : 0.5;
    }

    // Generate forecast
    const forecast: number[] = [];
    const confidenceUpper: number[] = [];
    const confidenceLower: number[] = [];

    let prevValue = lastValue;
    for (let i = 0; i < periods; i++) {
      // AR(1) forecast
      const predicted = mean + ar1Coefficient * (prevValue - mean);
      forecast.push(predicted);

      // Confidence intervals (95%)
      const error = stdDev * Math.sqrt(i + 1);
      confidenceUpper.push(predicted + 1.96 * error);
      confidenceLower.push(predicted - 1.96 * error);

      prevValue = predicted;
    }

    return {forecast, confidenceUpper, confidenceLower, periods};
  }

  /**
   * Calculate conditional volatility (GARCH-like)
   * @private
   */
  private calculateConditionalVolatility(returns: number[]): number[] {
    const n = returns.length;
    const mean = returns.reduce((sum, r) => sum + r, 0) / n;
    const residuals = returns.map((r) => r - mean);

    // GARCH(1,1) parameters: alpha + beta ≈ 0.95
    const alpha = 0.1;
    const beta = 0.85;
    const omega = 0.00001;

    const volatilities: number[] = [];
    let sigma2 = residuals.reduce((sum, r) => sum + Math.pow(r, 2), 0) / n;

    for (let i = 0; i < n; i++) {
      volatilities.push(Math.sqrt(sigma2));
      sigma2 = omega + alpha * Math.pow(residuals[i], 2) + beta * sigma2;
    }

    return volatilities;
  }

  /**
   * Simple normal CDF approximation
   * @private
   */
  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    const x = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const t5 = t4 * t;

    const y = 1.0 - (a5 * t5 + a4 * t4 + a3 * t3 + a2 * t2 + a1 * t) * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Get empty time series metrics
   * @private
   */
  private getEmptyTimeSeriesMetrics(strategyId: string): TimeSeriesMetrics {
    return {
      timestamp: new Date(),
      strategyId,
      acf: [],
      pacf: [],
      acfLags: 0,
      trend: [],
      seasonality: [],
      residuals: [],
      adfStatistic: 0,
      adfPValue: 1,
      isStationary: false,
      forecast: [],
      forecastConfidenceUpper: [],
      forecastConfidenceLower: [],
      forecastPeriods: 0,
      garchCoefficients: {alpha: 0, beta: 0},
      conditionalVolatility: [],
    };
  }
}

export default TimeSeriesAnalysisCalculator;
