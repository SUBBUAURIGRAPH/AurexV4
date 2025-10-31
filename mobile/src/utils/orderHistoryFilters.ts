/**
 * Order History Filtering Utilities
 * Advanced filtering logic for order history
 */

import { OrderFilterCriteria } from '../components/OrderHistoryFilter';

// ==================== Types ====================

export interface Order {
  id: string;
  symbol: string;
  status: string;
  type: string;
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  filledQuantity: number;
  averageFillPrice: number;
  totalCost: number;
  commission: number;
  createdAt: string;
  updatedAt: string;
}

// ==================== Filter Functions ====================

/**
 * Apply all filter criteria to a list of orders
 */
export function applyFilters(orders: Order[], criteria: OrderFilterCriteria): Order[] {
  let filtered = [...orders];

  // Filter by symbol
  if (criteria.symbol) {
    filtered = filtered.filter((o) => o.symbol === criteria.symbol);
  }

  // Filter by status
  if (criteria.status && criteria.status.length > 0) {
    filtered = filtered.filter((o) => criteria.status!.includes(o.status));
  }

  // Filter by type
  if (criteria.type && criteria.type.length > 0) {
    filtered = filtered.filter((o) => criteria.type!.includes(o.type));
  }

  // Filter by side
  if (criteria.side && criteria.side.length > 0) {
    filtered = filtered.filter((o) => criteria.side!.includes(o.side));
  }

  // Filter by date range
  if (criteria.dateRange) {
    filtered = filtered.filter((o) => {
      const orderDate = new Date(o.createdAt);
      return (
        orderDate >= criteria.dateRange!.startDate &&
        orderDate <= criteria.dateRange!.endDate
      );
    });
  }

  // Filter by quantity range
  if (criteria.quantityRange) {
    filtered = filtered.filter(
      (o) =>
        o.quantity >= criteria.quantityRange!.min &&
        o.quantity <= criteria.quantityRange!.max
    );
  }

  // Filter by price range
  if (criteria.priceRange) {
    const price = criteria.priceRange;
    filtered = filtered.filter((o) => {
      const orderPrice = o.price || o.averageFillPrice || 0;
      return orderPrice >= price.min && orderPrice <= price.max;
    });
  }

  // Filter by cost range
  if (criteria.costRange) {
    filtered = filtered.filter(
      (o) =>
        o.totalCost >= criteria.costRange!.min &&
        o.totalCost <= criteria.costRange!.max
    );
  }

  // Filter by commission range
  if (criteria.commissionRange) {
    filtered = filtered.filter(
      (o) =>
        o.commission >= criteria.commissionRange!.min &&
        o.commission <= criteria.commissionRange!.max
    );
  }

  // Filter by minimum fill percentage
  if (criteria.minFillPercentage !== undefined && criteria.minFillPercentage > 0) {
    filtered = filtered.filter((o) => {
      const fillPercentage = (o.filledQuantity / o.quantity) * 100;
      return fillPercentage >= criteria.minFillPercentage!;
    });
  }

  return filtered;
}

/**
 * Get summary statistics from filtered orders
 */
export interface OrderStatistics {
  totalOrders: number;
  totalBuys: number;
  totalSells: number;
  totalQuantity: number;
  totalCost: number;
  totalCommission: number;
  averagePrice: number;
  filledOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  averageFillPercentage: number;
}

export function getOrderStatistics(orders: Order[]): OrderStatistics {
  if (orders.length === 0) {
    return {
      totalOrders: 0,
      totalBuys: 0,
      totalSells: 0,
      totalQuantity: 0,
      totalCost: 0,
      totalCommission: 0,
      averagePrice: 0,
      filledOrders: 0,
      pendingOrders: 0,
      cancelledOrders: 0,
      averageFillPercentage: 0,
    };
  }

  const totalOrders = orders.length;
  const totalBuys = orders.filter((o) => o.side === 'buy').length;
  const totalSells = orders.filter((o) => o.side === 'sell').length;
  const totalQuantity = orders.reduce((sum, o) => sum + o.quantity, 0);
  const totalCost = orders.reduce((sum, o) => sum + o.totalCost, 0);
  const totalCommission = orders.reduce((sum, o) => sum + o.commission, 0);
  const filledOrders = orders.filter((o) => o.status === 'filled').length;
  const pendingOrders = orders.filter((o) =>
    ['pending', 'confirmed', 'submitted', 'partial'].includes(o.status)
  ).length;
  const cancelledOrders = orders.filter((o) =>
    ['cancelled', 'rejected', 'expired'].includes(o.status)
  ).length;

  const averagePrice = totalCost > 0 ? totalCost / totalQuantity : 0;
  const totalFilled = orders.reduce((sum, o) => sum + o.filledQuantity, 0);
  const averageFillPercentage = totalQuantity > 0 ? (totalFilled / totalQuantity) * 100 : 0;

  return {
    totalOrders,
    totalBuys,
    totalSells,
    totalQuantity,
    totalCost,
    totalCommission,
    averagePrice,
    filledOrders,
    pendingOrders,
    cancelledOrders,
    averageFillPercentage,
  };
}

/**
 * Get filter count summary
 */
export function getActiveFilterCount(criteria: OrderFilterCriteria): number {
  let count = 0;

  if (criteria.symbol) count++;
  if (criteria.status?.length) count += criteria.status.length;
  if (criteria.type?.length) count += criteria.type.length;
  if (criteria.side?.length) count += criteria.side.length;
  if (criteria.dateRange) count++;
  if (criteria.quantityRange) count++;
  if (criteria.priceRange) count++;
  if (criteria.costRange) count++;
  if (criteria.commissionRange) count++;
  if (criteria.minFillPercentage) count++;

  return count;
}

/**
 * Get human-readable filter description
 */
export function getFilterDescription(criteria: OrderFilterCriteria): string[] {
  const descriptions: string[] = [];

  if (criteria.symbol) {
    descriptions.push(`Symbol: ${criteria.symbol}`);
  }

  if (criteria.status?.length) {
    descriptions.push(`Status: ${criteria.status.join(', ')}`);
  }

  if (criteria.type?.length) {
    descriptions.push(`Type: ${criteria.type.join(', ')}`);
  }

  if (criteria.side?.length) {
    descriptions.push(`Side: ${criteria.side.map((s) => s.toUpperCase()).join(', ')}`);
  }

  if (criteria.quantityRange) {
    descriptions.push(
      `Quantity: ${criteria.quantityRange.min}-${criteria.quantityRange.max}`
    );
  }

  if (criteria.priceRange) {
    descriptions.push(
      `Price: $${criteria.priceRange.min.toFixed(2)}-$${criteria.priceRange.max.toFixed(2)}`
    );
  }

  if (criteria.costRange) {
    descriptions.push(
      `Cost: $${criteria.costRange.min.toFixed(2)}-$${criteria.costRange.max.toFixed(2)}`
    );
  }

  if (criteria.minFillPercentage) {
    descriptions.push(`Min Fill: ${criteria.minFillPercentage}%`);
  }

  if (criteria.dateRange) {
    descriptions.push(
      `Date: ${criteria.dateRange.startDate.toLocaleDateString()}-${criteria.dateRange.endDate.toLocaleDateString()}`
    );
  }

  return descriptions;
}

/**
 * Export orders as CSV
 */
export function exportOrdersAsCSV(orders: Order[]): string {
  const headers = [
    'ID',
    'Symbol',
    'Side',
    'Type',
    'Quantity',
    'Price',
    'Filled Qty',
    'Avg Fill Price',
    'Total Cost',
    'Commission',
    'Status',
    'Created At',
    'Updated At',
  ];

  const rows = orders.map((o) => [
    o.id,
    o.symbol,
    o.side.toUpperCase(),
    o.type.toUpperCase(),
    o.quantity,
    o.price?.toFixed(2) || 'N/A',
    o.filledQuantity,
    o.averageFillPrice.toFixed(2),
    o.totalCost.toFixed(2),
    o.commission.toFixed(2),
    o.status,
    o.createdAt,
    o.updatedAt,
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  return csv;
}

/**
 * Group orders by symbol
 */
export function groupOrdersBySymbol(orders: Order[]): Map<string, Order[]> {
  const grouped = new Map<string, Order[]>();

  orders.forEach((order) => {
    if (!grouped.has(order.symbol)) {
      grouped.set(order.symbol, []);
    }
    grouped.get(order.symbol)!.push(order);
  });

  return grouped;
}

/**
 * Group orders by status
 */
export function groupOrdersByStatus(orders: Order[]): Map<string, Order[]> {
  const grouped = new Map<string, Order[]>();

  orders.forEach((order) => {
    if (!grouped.has(order.status)) {
      grouped.set(order.status, []);
    }
    grouped.get(order.status)!.push(order);
  });

  return grouped;
}

/**
 * Get orders within date range
 */
export function getOrdersInDateRange(
  orders: Order[],
  startDate: Date,
  endDate: Date
): Order[] {
  return orders.filter((o) => {
    const orderDate = new Date(o.createdAt);
    return orderDate >= startDate && orderDate <= endDate;
  });
}

/**
 * Get profitable orders (sell orders with positive P&L, or buy orders)
 */
export function getProfitableOrders(orders: Order[]): Order[] {
  return orders.filter((o) => {
    if (o.status !== 'filled') return false;
    if (o.side === 'buy') return true;

    // For sells, check if average fill price is higher than average buy price
    // This is a simplified check - in real app would need full transaction history
    return o.averageFillPrice > 0;
  });
}

/**
 * Get loss-making orders
 */
export function getLossOrders(orders: Order[]): Order[] {
  return orders.filter((o) => {
    if (o.status !== 'filled') return false;
    if (o.side === 'sell') {
      // Simplified check - would need full transaction history in real app
      return false;
    }
    return o.totalCost > 0 && o.filledQuantity > 0;
  });
}

/**
 * Calculate P&L for orders (simplified)
 */
export function calculateOrderPL(orders: Order[]): number {
  return orders.reduce((total, o) => {
    if (o.status !== 'filled') return total;

    const grossCost = o.filledQuantity * o.averageFillPrice;
    const netCost = grossCost + o.commission;

    if (o.side === 'buy') {
      return total - netCost;
    } else {
      return total + netCost;
    }
  }, 0);
}
