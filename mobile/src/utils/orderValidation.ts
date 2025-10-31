/**
 * Order Validation Utilities
 * Comprehensive validation for trading orders with type safety
 */

import { OrderType, OrderSide } from '../types/index';

// ==================== Types ====================

export interface OrderInput {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  limitPrice?: number;
  timeInForce?: 'day' | 'gtc' | 'ioc' | 'fok';
  notes?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ==================== Constants ====================

const VALIDATION_RULES = {
  SYMBOL: {
    minLength: 1,
    maxLength: 10,
    pattern: /^[A-Z0-9]+$/,
  },
  QUANTITY: {
    min: 1,
    max: 1000000,
  },
  PRICE: {
    min: 0.01,
    max: 1000000,
  },
  STOP_PRICE: {
    min: 0.01,
    max: 1000000,
  },
};

const ERROR_MESSAGES = {
  symbol: {
    required: 'Symbol is required',
    invalid: 'Symbol must be 1-10 uppercase letters or numbers',
  },
  quantity: {
    required: 'Quantity is required',
    invalid: 'Quantity must be a positive number',
    min: `Quantity must be at least ${VALIDATION_RULES.QUANTITY.min}`,
    max: `Quantity cannot exceed ${VALIDATION_RULES.QUANTITY.max}`,
    notInteger: 'Quantity must be a whole number',
  },
  price: {
    required: 'Price is required for this order type',
    invalid: 'Price must be a positive number',
    min: `Price must be at least ${VALIDATION_RULES.PRICE.min}`,
    max: `Price cannot exceed ${VALIDATION_RULES.PRICE.max}`,
  },
  stopPrice: {
    required: 'Stop price is required for this order type',
    invalid: 'Stop price must be a positive number',
    min: `Stop price must be at least ${VALIDATION_RULES.STOP_PRICE.min}`,
    max: `Stop price cannot exceed ${VALIDATION_RULES.STOP_PRICE.max}`,
  },
  limitPrice: {
    required: 'Limit price is required for this order type',
    invalid: 'Limit price must be a positive number',
  },
  orderType: {
    invalid: 'Invalid order type',
  },
  timeInForce: {
    invalid: 'Invalid time in force option',
  },
};

// ==================== Validation Functions ====================

/**
 * Validates a symbol string
 */
function validateSymbol(symbol: string | undefined): ValidationError | null {
  if (!symbol) {
    return { field: 'symbol', message: ERROR_MESSAGES.symbol.required, severity: 'error' };
  }

  if (!VALIDATION_RULES.SYMBOL.pattern.test(symbol)) {
    return { field: 'symbol', message: ERROR_MESSAGES.symbol.invalid, severity: 'error' };
  }

  return null;
}

/**
 * Validates quantity
 */
function validateQuantity(quantity: number | string | undefined): ValidationError | null {
  if (quantity === undefined || quantity === null || quantity === '') {
    return { field: 'quantity', message: ERROR_MESSAGES.quantity.required, severity: 'error' };
  }

  const qty = typeof quantity === 'string' ? parseFloat(quantity) : quantity;

  if (isNaN(qty)) {
    return { field: 'quantity', message: ERROR_MESSAGES.quantity.invalid, severity: 'error' };
  }

  if (!Number.isInteger(qty)) {
    return { field: 'quantity', message: ERROR_MESSAGES.quantity.notInteger, severity: 'error' };
  }

  if (qty < VALIDATION_RULES.QUANTITY.min) {
    return { field: 'quantity', message: ERROR_MESSAGES.quantity.min, severity: 'error' };
  }

  if (qty > VALIDATION_RULES.QUANTITY.max) {
    return { field: 'quantity', message: ERROR_MESSAGES.quantity.max, severity: 'error' };
  }

  return null;
}

/**
 * Validates price for limit/stop-limit orders
 */
function validatePrice(price: number | undefined, required: boolean = false): ValidationError | null {
  if (!price && !required) {
    return null;
  }

  if (!price && required) {
    return { field: 'price', message: ERROR_MESSAGES.price.required, severity: 'error' };
  }

  if (typeof price !== 'number' || isNaN(price)) {
    return { field: 'price', message: ERROR_MESSAGES.price.invalid, severity: 'error' };
  }

  if (price < VALIDATION_RULES.PRICE.min) {
    return { field: 'price', message: ERROR_MESSAGES.price.min, severity: 'error' };
  }

  if (price > VALIDATION_RULES.PRICE.max) {
    return { field: 'price', message: ERROR_MESSAGES.price.max, severity: 'error' };
  }

  return null;
}

/**
 * Validates stop price for stop/stop-limit orders
 */
function validateStopPrice(stopPrice: number | undefined, required: boolean = false): ValidationError | null {
  if (!stopPrice && !required) {
    return null;
  }

  if (!stopPrice && required) {
    return { field: 'stopPrice', message: ERROR_MESSAGES.stopPrice.required, severity: 'error' };
  }

  if (typeof stopPrice !== 'number' || isNaN(stopPrice)) {
    return { field: 'stopPrice', message: ERROR_MESSAGES.stopPrice.invalid, severity: 'error' };
  }

  if (stopPrice < VALIDATION_RULES.STOP_PRICE.min) {
    return { field: 'stopPrice', message: ERROR_MESSAGES.stopPrice.min, severity: 'error' };
  }

  if (stopPrice > VALIDATION_RULES.STOP_PRICE.max) {
    return { field: 'stopPrice', message: ERROR_MESSAGES.stopPrice.max, severity: 'error' };
  }

  return null;
}

/**
 * Validates limit price for stop-limit orders
 */
function validateLimitPrice(limitPrice: number | undefined, required: boolean = false): ValidationError | null {
  if (!limitPrice && !required) {
    return null;
  }

  if (!limitPrice && required) {
    return { field: 'limitPrice', message: ERROR_MESSAGES.limitPrice.required, severity: 'error' };
  }

  if (typeof limitPrice !== 'number' || isNaN(limitPrice)) {
    return { field: 'limitPrice', message: ERROR_MESSAGES.limitPrice.invalid, severity: 'error' };
  }

  return null;
}

/**
 * Validates order type
 */
function validateOrderType(orderType: OrderType | undefined): ValidationError | null {
  const validTypes: OrderType[] = ['market', 'limit', 'stop', 'stop-limit', 'trailing-stop'];

  if (!orderType || !validTypes.includes(orderType)) {
    return { field: 'type', message: ERROR_MESSAGES.orderType.invalid, severity: 'error' };
  }

  return null;
}

/**
 * Validates time in force
 */
function validateTimeInForce(tif: string | undefined): ValidationError | null {
  const validValues = ['day', 'gtc', 'ioc', 'fok'];

  if (!tif) {
    return null; // Optional field with default 'day'
  }

  if (!validValues.includes(tif)) {
    return { field: 'timeInForce', message: ERROR_MESSAGES.timeInForce.invalid, severity: 'error' };
  }

  return null;
}

/**
 * Validates price/stopPrice consistency for sell orders
 */
function validateSellOrderPrices(
  side: OrderSide,
  price: number | undefined,
  stopPrice: number | undefined
): ValidationError | null {
  if (side !== 'sell') {
    return null;
  }

  // For sell orders, stopPrice should typically be lower than price for profit taking
  if (stopPrice && price && stopPrice > price) {
    return {
      field: 'prices',
      message: 'Stop price should typically be lower than limit price for sell orders',
      severity: 'warning',
    };
  }

  return null;
}

/**
 * Validates buy order prices consistency
 */
function validateBuyOrderPrices(
  side: OrderSide,
  price: number | undefined,
  stopPrice: number | undefined
): ValidationError | null {
  if (side !== 'buy') {
    return null;
  }

  // For buy orders, stopPrice should typically be lower than price (stop-loss)
  if (stopPrice && price && stopPrice > price) {
    return {
      field: 'prices',
      message: 'Stop price should typically be lower than limit price for buy orders (stop-loss)',
      severity: 'warning',
    };
  }

  return null;
}

// ==================== Main Validation ====================

/**
 * Comprehensive order validation
 * Returns all errors and warnings found in the order
 */
export function validateOrder(order: Partial<OrderInput>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validate basic fields
  const symbolError = validateSymbol(order.symbol);
  if (symbolError) errors.push(symbolError);

  const quantityError = validateQuantity(order.quantity);
  if (quantityError) errors.push(quantityError);

  const orderTypeError = validateOrderType(order.type);
  if (orderTypeError) errors.push(orderTypeError);

  // Validate order type-specific fields
  if (order.type === 'limit') {
    const priceError = validatePrice(order.price, true);
    if (priceError) errors.push(priceError);
  } else if (order.type === 'stop') {
    const stopPriceError = validateStopPrice(order.stopPrice, true);
    if (stopPriceError) errors.push(stopPriceError);
  } else if (order.type === 'stop-limit') {
    const stopPriceError = validateStopPrice(order.stopPrice, true);
    if (stopPriceError) errors.push(stopPriceError);

    const limitPriceError = validateLimitPrice(order.limitPrice, true);
    if (limitPriceError) errors.push(limitPriceError);
  } else if (order.type === 'trailing-stop') {
    const stopPriceError = validateStopPrice(order.stopPrice, true);
    if (stopPriceError) errors.push(stopPriceError);
  }
  // 'market' type doesn't require price validation

  // Validate optional fields
  const tifError = validateTimeInForce(order.timeInForce);
  if (tifError) errors.push(tifError);

  // Validate price consistency warnings
  const sellPriceWarning = validateSellOrderPrices(order.side || 'buy', order.price, order.stopPrice);
  if (sellPriceWarning) warnings.push(sellPriceWarning);

  const buyPriceWarning = validateBuyOrderPrices(order.side || 'buy', order.price, order.stopPrice);
  if (buyPriceWarning) warnings.push(buyPriceWarning);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validation for specific fields (used for real-time validation in forms)
 */
export function validateField(
  fieldName: keyof OrderInput,
  value: any,
  orderContext?: Partial<OrderInput>
): ValidationError | null {
  switch (fieldName) {
    case 'symbol':
      return validateSymbol(value);
    case 'quantity':
      return validateQuantity(value);
    case 'price':
      return validatePrice(value, orderContext?.type === 'limit' || orderContext?.type === 'stop-limit');
    case 'stopPrice':
      return validateStopPrice(value, orderContext?.type === 'stop' || orderContext?.type === 'stop-limit');
    case 'limitPrice':
      return validateLimitPrice(value, orderContext?.type === 'stop-limit');
    case 'type':
      return validateOrderType(value);
    case 'timeInForce':
      return validateTimeInForce(value);
    default:
      return null;
  }
}

/**
 * Get required fields for a specific order type
 */
export function getRequiredFieldsForOrderType(orderType: OrderType): (keyof OrderInput)[] {
  const baseRequired: (keyof OrderInput)[] = ['symbol', 'side', 'quantity'];

  switch (orderType) {
    case 'market':
      return baseRequired;
    case 'limit':
      return [...baseRequired, 'price'];
    case 'stop':
      return [...baseRequired, 'stopPrice'];
    case 'stop-limit':
      return [...baseRequired, 'stopPrice', 'limitPrice'];
    case 'trailing-stop':
      return [...baseRequired, 'stopPrice'];
    default:
      return baseRequired;
  }
}

/**
 * Get field configuration for UI rendering based on order type
 */
export function getOrderTypeFieldConfig(orderType: OrderType) {
  const config = {
    showPrice: false,
    showStopPrice: false,
    showLimitPrice: false,
    priceRequired: false,
    stopPriceRequired: false,
    limitPriceRequired: false,
  };

  switch (orderType) {
    case 'limit':
      config.showPrice = true;
      config.priceRequired = true;
      break;
    case 'stop':
      config.showStopPrice = true;
      config.stopPriceRequired = true;
      break;
    case 'stop-limit':
      config.showStopPrice = true;
      config.showLimitPrice = true;
      config.stopPriceRequired = true;
      config.limitPriceRequired = true;
      break;
    case 'trailing-stop':
      config.showStopPrice = true;
      config.stopPriceRequired = true;
      break;
  }

  return config;
}

/**
 * Calculate estimated order cost (for display purposes)
 */
export function calculateEstimatedCost(
  orderType: OrderType,
  quantity: number,
  price?: number,
  stopPrice?: number,
  limitPrice?: number
): number {
  if (orderType === 'market') {
    // For market orders, we can't estimate without current market price
    return 0;
  }

  if (orderType === 'limit') {
    return price ? quantity * price : 0;
  }

  if (orderType === 'stop') {
    return stopPrice ? quantity * stopPrice : 0;
  }

  if (orderType === 'stop-limit') {
    // Use limit price for estimation
    return limitPrice ? quantity * limitPrice : 0;
  }

  if (orderType === 'trailing-stop') {
    return stopPrice ? quantity * stopPrice : 0;
  }

  return 0;
}

/**
 * Get human-readable order description
 */
export function getOrderDescription(order: Partial<OrderInput>): string {
  const { symbol, side, type, quantity, price, stopPrice, limitPrice } = order;

  if (!symbol || !side || !type || !quantity) {
    return 'Incomplete order';
  }

  const action = side === 'buy' ? 'Buy' : 'Sell';

  switch (type) {
    case 'market':
      return `${action} ${quantity} shares of ${symbol} at market price`;
    case 'limit':
      return `${action} ${quantity} shares of ${symbol} at $${price} per share`;
    case 'stop':
      return `${action} ${quantity} shares of ${symbol} when price reaches $${stopPrice}`;
    case 'stop-limit':
      return `${action} ${quantity} shares of ${symbol}: stop at $${stopPrice}, limit at $${limitPrice}`;
    case 'trailing-stop':
      return `${action} ${quantity} shares of ${symbol} with trailing stop of $${stopPrice}`;
    default:
      return 'Unknown order type';
  }
}
