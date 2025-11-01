/**
 * Donut Chart Component
 * Displays proportional data in a circular ring format with center info
 * Similar to PieChart but with inner radius for additional context
 */

import React from 'react';
import { PieChart } from './PieChart';

interface DataPoint {
  x: string;
  y: number;
  color?: string;
}

interface DonutChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  title?: string;
  showLegend?: boolean;
  showLabels?: boolean;
  centerText?: string;
  centerValue?: string;
}

export const DonutChart: React.FC<DonutChartProps> = (props) => {
  // Donut chart is essentially a pie chart with inner radius
  // We use 50 as default inner radius to create the donut effect
  return (
    <PieChart
      {...props}
      innerRadius={60}
    />
  );
};
