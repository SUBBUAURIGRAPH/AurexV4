/**
 * Performance Chart Component
 * 30-day portfolio performance visualization
 * @version 1.0.0
 */

import React, { useState, useMemo } from 'react';
import styles from './PerformanceChart.module.css';

interface PerformanceChartProps {
  portfolio?: {
    performanceData?: Array<{
      date: string;
      value: number;
    }>;
  };
}

type TimeRange = '1W' | '1M' | '3M' | '1Y' | 'ALL';

const PerformanceChart: React.FC<PerformanceChartProps> = ({ portfolio }) => {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1M');

  // Generate sample performance data for 30 days
  const generateSampleData = () => {
    const data = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    let baseValue = 100;
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      baseValue += (Math.random() - 0.4) * 3; // Random walk with slight upward bias
      data.push({
        date: date.toISOString().split('T')[0],
        value: Math.max(baseValue, 80) // Prevent going too negative
      });
    }
    return data;
  };

  const performanceData = portfolio?.performanceData || generateSampleData();

  // Calculate min and max for scaling
  const { minValue, maxValue, range } = useMemo(() => {
    const values = performanceData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return {
      minValue: min,
      maxValue: max,
      range: max - min || 1
    };
  }, [performanceData]);

  // Calculate percentage change
  const startValue = performanceData[0]?.value || 100;
  const endValue = performanceData[performanceData.length - 1]?.value || 100;
  const percentChange = ((endValue - startValue) / startValue) * 100;
  const isPositive = percentChange >= 0;

  // Prepare chart data with normalized heights
  const chartData = performanceData.map(point => ({
    ...point,
    normalizedHeight: ((point.value - minValue) / range) * 100
  }));

  // Time range options
  const timeRanges: TimeRange[] = ['1W', '1M', '3M', '1Y', 'ALL'];

  return (
    <div className={styles.chartContainer}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Performance Chart</h3>
          <div className={styles.stats}>
            <span className={styles.period}>Last {selectedRange}</span>
            <span className={`${styles.change} ${isPositive ? styles.positive : styles.negative}`}>
              {isPositive ? '+' : ''}{percentChange.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className={styles.controls}>
          {timeRanges.map(range => (
            <button
              key={range}
              className={`${styles.rangeButton} ${selectedRange === range ? styles.active : ''}`}
              onClick={() => setSelectedRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chartArea}>
        <div className={styles.chart}>
          {/* Y-axis labels */}
          <div className={styles.yAxis}>
            <div className={styles.yLabel}>{maxValue.toFixed(0)}</div>
            <div className={styles.yLabel}>{((minValue + maxValue) / 2).toFixed(0)}</div>
            <div className={styles.yLabel}>{minValue.toFixed(0)}</div>
          </div>

          {/* Chart bars */}
          <div className={styles.barsContainer}>
            {chartData.map((point, index) => (
              <div key={index} className={styles.barWrapper}>
                <div
                  className={`${styles.bar} ${isPositive ? styles.positive : styles.negative}`}
                  style={{
                    height: `${Math.max(point.normalizedHeight, 5)}%`
                  }}
                  title={`${point.date}: ${point.value.toFixed(2)}`}
                >
                  <span className={styles.barValue}>{point.value.toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* X-axis labels (every 5 days) */}
        <div className={styles.xAxis}>
          {chartData.map((point, index) => {
            if (index % 5 === 0 || index === chartData.length - 1) {
              return (
                <div key={index} className={styles.xLabel}>
                  {point.date.split('-')[2]}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>

      {/* Summary stats */}
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Highest</span>
          <span className={styles.summaryValue}>${maxValue.toFixed(2)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Lowest</span>
          <span className={styles.summaryValue}>${minValue.toFixed(2)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Range</span>
          <span className={styles.summaryValue}>${range.toFixed(2)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Average</span>
          <span className={styles.summaryValue}>${((minValue + maxValue) / 2).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceChart;
