/**
 * Order Command Handler
 * Handles order creation, management, and tracking operations
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios';
import * as chalk from 'chalk';
import * as inquirer from 'inquirer';
import { CommandOptions, OrderInfo, OutputFormat } from '../types';
import Formatter from '../utils/formatter';
import Validator from '../utils/validator';
import ConfigManager from '../utils/config';
import AuthManager from '../utils/auth';

/**
 * Order Handler Class
 * Manages order lifecycle operations
 *
 * @example
 * ```bash
 * # Create a market order
 * hms order create --symbol AAPL --side buy --quantity 100 --type market
 *
 * # Create a limit order
 * hms order create --symbol MSFT --side sell --quantity 50 --type limit --price 350.00
 *
 * # List active orders
 * hms order list
 *
 * # Cancel an order
 * hms order cancel order-123
 * ```
 */
export class OrderHandler {
  private config = ConfigManager.getInstance();
  private auth = AuthManager.getInstance();
  private apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: this.config.getApiUrl(),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Create new order
   *
   * @param options - Command options
   * @example
   * ```bash
   * # Market order
   * hms order create --symbol AAPL --side buy --quantity 100 --type market
   *
   * # Limit order
   * hms order create --symbol MSFT --side sell --quantity 50 --type limit --price 350.00
   *
   * # Stop order
   * hms order create --symbol TSLA --side buy --quantity 25 --type stop --stopPrice 200.00
   *
   * # Bracket order
   * hms order create --symbol NVDA --side buy --quantity 10 --type bracket --price 500 --takeProfit 550 --stopLoss 480
   * ```
   */
  async create(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Create Order');

      let orderData: any = {};

      // Interactive order creation if not all params provided
      if (!options.symbol || !options.side || !options.quantity || !options.type) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'symbol',
            message: 'Symbol:',
            default: options.symbol,
            validate: (input) => {
              try {
                Validator.validateSymbol(input);
                return true;
              } catch {
                return 'Invalid symbol format';
              }
            }
          },
          {
            type: 'list',
            name: 'side',
            message: 'Side:',
            choices: ['buy', 'sell'],
            default: options.side || 'buy'
          },
          {
            type: 'input',
            name: 'quantity',
            message: 'Quantity:',
            default: options.quantity || '100',
            validate: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0 || 'Must be a positive number'
          },
          {
            type: 'list',
            name: 'type',
            message: 'Order Type:',
            choices: ['market', 'limit', 'stop', 'trailing_stop', 'bracket'],
            default: options.type || 'market'
          }
        ]);

        orderData = { ...options, ...answers };
      } else {
        orderData = options;
      }

      // Validate required fields
      const symbol = Validator.validateSymbol(orderData.symbol);
      const side = Validator.validateString(orderData.side, 'Side', {
        enum: ['buy', 'sell']
      });
      const quantity = Validator.validateQuantity(parseFloat(orderData.quantity));
      const type = Validator.validateString(orderData.type, 'Type', {
        enum: ['market', 'limit', 'stop', 'trailing_stop', 'bracket']
      });

      // Build order payload
      const payload: any = {
        userId: this.config.getUserId(),
        symbol,
        side,
        quantity,
        type
      };

      // Add type-specific fields
      if (type === 'limit' || type === 'bracket') {
        if (!orderData.price) {
          const priceAnswer = await inquirer.prompt([
            {
              type: 'input',
              name: 'price',
              message: 'Limit Price:',
              validate: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0 || 'Must be a positive number'
            }
          ]);
          orderData.price = priceAnswer.price;
        }
        payload.price = Validator.validatePrice(parseFloat(orderData.price));
      }

      if (type === 'stop' || type === 'trailing_stop') {
        if (!orderData.stopPrice) {
          const stopAnswer = await inquirer.prompt([
            {
              type: 'input',
              name: 'stopPrice',
              message: 'Stop Price:',
              validate: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0 || 'Must be a positive number'
            }
          ]);
          orderData.stopPrice = stopAnswer.stopPrice;
        }
        payload.stopPrice = Validator.validatePrice(parseFloat(orderData.stopPrice));
      }

      if (type === 'bracket') {
        // Take profit and stop loss
        if (!orderData.takeProfit || !orderData.stopLoss) {
          const bracketAnswers = await inquirer.prompt([
            {
              type: 'input',
              name: 'takeProfit',
              message: 'Take Profit Price:',
              default: orderData.takeProfit,
              validate: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0 || 'Must be a positive number'
            },
            {
              type: 'input',
              name: 'stopLoss',
              message: 'Stop Loss Price:',
              default: orderData.stopLoss,
              validate: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0 || 'Must be a positive number'
            }
          ]);
          orderData.takeProfit = bracketAnswers.takeProfit;
          orderData.stopLoss = bracketAnswers.stopLoss;
        }
        payload.takeProfit = Validator.validatePrice(parseFloat(orderData.takeProfit));
        payload.stopLoss = Validator.validatePrice(parseFloat(orderData.stopLoss));
      }

      // Optional fields
      if (orderData.timeInForce) {
        payload.timeInForce = orderData.timeInForce;
      }
      if (orderData.expiresAt) {
        payload.expiresAt = Validator.validateDate(orderData.expiresAt);
      }

      // Confirm order
      if (!options.yes) {
        console.log(chalk.cyan('\nOrder Summary:'));
        console.log(`  ${side.toUpperCase()} ${quantity} ${symbol} @ ${type.toUpperCase()}`);
        if (payload.price) console.log(`  Limit Price: $${payload.price.toFixed(2)}`);
        if (payload.stopPrice) console.log(`  Stop Price: $${payload.stopPrice.toFixed(2)}`);
        if (payload.takeProfit) console.log(`  Take Profit: $${payload.takeProfit.toFixed(2)}`);
        if (payload.stopLoss) console.log(`  Stop Loss: $${payload.stopLoss.toFixed(2)}`);
        console.log('');

        const confirmation = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: 'Submit order?',
            default: false
          }
        ]);

        if (!confirmation.confirmed) {
          Formatter.info('Order cancelled');
          return;
        }
      }

      const stopLoading = Formatter.loading('Submitting order...');

      try {
        const response = await this.apiClient.post('/orders', payload, {
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const order: OrderInfo = response.data.data;

        Formatter.success('Order submitted successfully!');
        console.log(chalk.cyan('\nOrder Details:'));
        console.log(`  Order ID: ${chalk.yellow(order.id)}`);
        console.log(`  Symbol: ${chalk.yellow(order.symbol)}`);
        console.log(`  Side: ${chalk.yellow(order.side.toUpperCase())}`);
        console.log(`  Quantity: ${chalk.yellow(order.quantity)}`);
        console.log(`  Type: ${chalk.yellow(order.type.toUpperCase())}`);
        console.log(`  Status: ${chalk.yellow(order.status.toUpperCase())}`);
        console.log(`  Created: ${chalk.yellow(new Date(order.createdAt).toLocaleString())}`);
        console.log('');

      } catch (error: any) {
        stopLoading();
        throw this.handleApiError(error);
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * List orders
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms order list
   * hms order list --status pending
   * hms order list --symbol AAPL
   * ```
   */
  async list(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Orders');

      const params: any = {
        userId: this.config.getUserId()
      };

      if (options.status) {
        params.status = Validator.validateString(options.status, 'Status', {
          enum: ['pending', 'filled', 'cancelled', 'expired']
        });
      }

      if (options.symbol) {
        params.symbol = Validator.validateSymbol(options.symbol);
      }

      const stopLoading = Formatter.loading('Fetching orders...');

      try {
        const response = await this.apiClient.get('/orders', {
          params,
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const orders: OrderInfo[] = response.data.data;

        if (orders.length === 0) {
          Formatter.warning('No orders found');
          console.log(chalk.yellow('\nUse "hms order create" to create a new order\n'));
          return;
        }

        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          const ordersData = orders.map(o => ({
            ID: o.id,
            Symbol: o.symbol,
            Side: o.side.toUpperCase(),
            Type: o.type.toUpperCase(),
            Quantity: o.quantity.toLocaleString(),
            Price: o.price ? `$${o.price.toFixed(2)}` : 'Market',
            Filled: o.filledQuantity.toLocaleString(),
            Status: this.formatStatus(o.status),
            Created: new Date(o.createdAt).toLocaleDateString()
          }));

          console.log(Formatter.format(ordersData, OutputFormat.TABLE));
          console.log(chalk.cyan(`\nTotal: ${orders.length} orders\n`));
        } else {
          console.log(Formatter.format(orders, format));
        }

      } catch (error: any) {
        stopLoading();
        throw this.handleApiError(error);
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Show order details
   *
   * @param id - Order ID
   * @param options - Command options
   * @example
   * ```bash
   * hms order show order-123
   * hms order show order-123 --format json
   * ```
   */
  async show(id: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Order Details');

      const stopLoading = Formatter.loading('Fetching order...');

      try {
        const response = await this.apiClient.get(`/orders/${id}`, {
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const order: OrderInfo = response.data.data;
        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.JSON) {
          console.log(JSON.stringify(order, null, 2));
        } else if (format === OutputFormat.TABLE) {
          const orderData = {
            'Order ID': order.id,
            'Symbol': order.symbol,
            'Side': order.side.toUpperCase(),
            'Type': order.type.toUpperCase(),
            'Quantity': order.quantity.toLocaleString(),
            'Filled Quantity': order.filledQuantity.toLocaleString(),
            'Price': order.price ? `$${order.price.toFixed(2)}` : 'Market',
            'Stop Price': order.stopPrice ? `$${order.stopPrice.toFixed(2)}` : 'N/A',
            'Filled Price': order.filledPrice ? `$${order.filledPrice.toFixed(2)}` : 'N/A',
            'Status': order.status.toUpperCase(),
            'Created': new Date(order.createdAt).toLocaleString(),
            'Updated': new Date(order.updatedAt).toLocaleString(),
            'Expires': order.expiresAt ? new Date(order.expiresAt).toLocaleString() : 'N/A'
          };

          console.log(Formatter.format(orderData, OutputFormat.TABLE));
        } else {
          console.log(Formatter.format(order, format));
        }

      } catch (error: any) {
        stopLoading();
        throw this.handleApiError(error);
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Cancel order
   *
   * @param id - Order ID
   * @param options - Command options
   * @example
   * ```bash
   * hms order cancel order-123
   * hms order cancel order-123 --force
   * ```
   */
  async cancel(id: string, options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Cancel Order');

      // Confirm cancellation
      if (!options.force && !options.yes) {
        const confirmation = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: `Cancel order ${id}?`,
            default: false
          }
        ]);

        if (!confirmation.confirmed) {
          Formatter.info('Cancellation aborted');
          return;
        }
      }

      const stopLoading = Formatter.loading('Cancelling order...');

      try {
        await this.apiClient.delete(`/orders/${id}`, {
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        Formatter.success(`Order ${id} cancelled successfully`);

      } catch (error: any) {
        stopLoading();
        throw this.handleApiError(error);
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Show order history
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms order history --days 30
   * hms order history --symbol AAPL --from 2024-01-01 --to 2024-02-01
   * ```
   */
  async history(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Order History');

      const params: any = {
        userId: this.config.getUserId(),
        days: options.days || 30
      };

      if (options.symbol) {
        params.symbol = Validator.validateSymbol(options.symbol);
      }

      if (options.from) {
        params.startDate = Validator.validateDate(options.from);
      }
      if (options.to) {
        params.endDate = Validator.validateDate(options.to);
      }

      const stopLoading = Formatter.loading('Fetching order history...');

      try {
        const response = await this.apiClient.get('/orders/history', {
          params,
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const orders: OrderInfo[] = response.data.data;

        if (orders.length === 0) {
          Formatter.warning('No order history found');
          return;
        }

        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          const historyData = orders.map(o => ({
            Date: new Date(o.createdAt).toLocaleDateString(),
            Symbol: o.symbol,
            Side: o.side.toUpperCase(),
            Type: o.type.toUpperCase(),
            Quantity: o.quantity.toLocaleString(),
            Price: o.filledPrice ? `$${o.filledPrice.toFixed(2)}` : 'N/A',
            Status: this.formatStatus(o.status),
            'Order ID': o.id
          }));

          console.log(Formatter.format(historyData, OutputFormat.TABLE));
          console.log(chalk.cyan(`\nTotal: ${orders.length} orders\n`));
        } else {
          console.log(Formatter.format(orders, format));
        }

      } catch (error: any) {
        stopLoading();
        throw this.handleApiError(error);
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Show order templates
   *
   * @param options - Command options
   * @example
   * ```bash
   * hms order templates
   * hms order templates --create "Quick Buy AAPL"
   * ```
   */
  async templates(options: CommandOptions): Promise<void> {
    try {
      this.requireAuth();
      Formatter.header('Order Templates');

      // Create template
      if (options.create) {
        await this.createTemplate(options);
        return;
      }

      // List templates
      const stopLoading = Formatter.loading('Fetching templates...');

      try {
        const response = await this.apiClient.get('/orders/templates', {
          params: { userId: this.config.getUserId() },
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        const templates = response.data.data;

        if (templates.length === 0) {
          Formatter.warning('No templates found');
          console.log(chalk.yellow('\nUse --create to create a new template\n'));
          return;
        }

        const format = (options.format as OutputFormat) || this.config.getOutputFormat();

        if (format === OutputFormat.TABLE) {
          const templatesData = templates.map((t: any) => ({
            ID: t.id,
            Name: t.name,
            Symbol: t.symbol,
            Side: t.side.toUpperCase(),
            Type: t.type.toUpperCase(),
            Quantity: t.quantity.toLocaleString(),
            Price: t.price ? `$${t.price.toFixed(2)}` : 'Market'
          }));

          console.log(Formatter.format(templatesData, OutputFormat.TABLE));
          console.log(chalk.cyan(`\nTotal: ${templates.length} templates\n`));
        } else {
          console.log(Formatter.format(templates, format));
        }

      } catch (error: any) {
        stopLoading();
        throw this.handleApiError(error);
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Create order template
   */
  private async createTemplate(options: CommandOptions): Promise<void> {
    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Template Name:',
          default: options.create
        },
        {
          type: 'input',
          name: 'symbol',
          message: 'Symbol:',
          validate: (input) => {
            try {
              Validator.validateSymbol(input);
              return true;
            } catch {
              return 'Invalid symbol';
            }
          }
        },
        {
          type: 'list',
          name: 'side',
          message: 'Side:',
          choices: ['buy', 'sell']
        },
        {
          type: 'list',
          name: 'type',
          message: 'Type:',
          choices: ['market', 'limit', 'stop']
        },
        {
          type: 'input',
          name: 'quantity',
          message: 'Quantity:',
          validate: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0 || 'Must be positive'
        }
      ]);

      const payload = {
        userId: this.config.getUserId(),
        ...answers
      };

      if (answers.type === 'limit') {
        const priceAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'price',
            message: 'Price:',
            validate: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0 || 'Must be positive'
          }
        ]);
        payload.price = parseFloat(priceAnswer.price);
      }

      const stopLoading = Formatter.loading('Creating template...');

      try {
        const response = await this.apiClient.post('/orders/templates', payload, {
          headers: this.auth.getAuthHeader()
        });

        stopLoading();

        Formatter.success(`Template "${answers.name}" created successfully!`);
        console.log(chalk.cyan(`Template ID: ${response.data.data.id}\n`));

      } catch (error: any) {
        stopLoading();
        throw this.handleApiError(error);
      }

    } catch (error) {
      if (error instanceof Error) {
        Formatter.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Format order status with color
   */
  private formatStatus(status: string): string {
    switch (status) {
      case 'filled':
        return chalk.green(status.toUpperCase());
      case 'pending':
        return chalk.yellow(status.toUpperCase());
      case 'cancelled':
      case 'expired':
        return chalk.red(status.toUpperCase());
      default:
        return status.toUpperCase();
    }
  }

  /**
   * Require authentication
   */
  private requireAuth(): void {
    if (!this.auth.isAuthenticated()) {
      throw new Error('Not authenticated. Please login first using "hms account login"');
    }
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: any): Error {
    if (error.response) {
      const message = error.response.data?.message || error.message;
      return new Error(`API Error: ${message}`);
    }
    return error;
  }
}

export default OrderHandler;
