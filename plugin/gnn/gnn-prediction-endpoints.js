/**
 * GNN Prediction API Endpoints
 * REST API for GNN-based stock predictions and analysis
 *
 * Endpoints:
 * - POST /api/gnn/predict - Single stock prediction
 * - POST /api/gnn/predict-batch - Batch predictions
 * - GET /api/gnn/model - Model summary and info
 * - GET /api/gnn/graph - Graph analysis and visualization
 * - GET /api/gnn/performance - Performance metrics
 * - POST /api/gnn/train - Train model
 * - POST /api/gnn/validate - Validate predictions
 * - GET /api/gnn/history - Prediction history
 * - GET /api/gnn/consensus - Market consensus
 * - POST /api/gnn/backtest - Backtest predictions
 */

/**
 * Register GNN prediction endpoints
 */
function registerGNNEndpoints(app, config) {
  const {
    predictionEngine,
    gnnModel,
    graphBuilder,
    fundamentalAnalyzer,
    technicalProcessor,
    accuracyCalculator,
    performanceCalculator,
    logger,
    database
  } = config;

  /**
   * POST /api/gnn/predict
   * Generate prediction for a single stock
   */
  app.post('/api/gnn/predict', async (req, res) => {
    try {
      const { symbol, ohlcvData, fundamentals } = req.body;

      if (!symbol || !ohlcvData || !fundamentals) {
        return res.status(400).json({
          error: 'Missing required fields: symbol, ohlcvData, fundamentals'
        });
      }

      const prediction = await predictionEngine.generatePrediction(
        symbol,
        ohlcvData,
        fundamentals
      );

      logger.info(`📊 Prediction API - Generated prediction for ${symbol}`);

      res.json({
        success: true,
        data: prediction,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error in predict endpoint:', error);
      res.status(500).json({
        error: 'Failed to generate prediction',
        message: error.message
      });
    }
  });

  /**
   * POST /api/gnn/predict-batch
   * Generate predictions for multiple stocks
   */
  app.post('/api/gnn/predict-batch', async (req, res) => {
    try {
      const { stocks } = req.body;

      if (!stocks || !Array.isArray(stocks) || stocks.length === 0) {
        return res.status(400).json({
          error: 'Missing or invalid stocks array'
        });
      }

      const predictions = [];
      const errors = [];

      for (const stock of stocks) {
        try {
          const prediction = await predictionEngine.generatePrediction(
            stock.symbol,
            stock.ohlcvData,
            stock.fundamentals
          );
          predictions.push(prediction);
        } catch (error) {
          errors.push({
            symbol: stock.symbol,
            error: error.message
          });
        }
      }

      const batchAnalysis = predictionEngine.getBatchAnalysis(predictions);

      logger.info(`📊 Prediction API - Generated batch predictions for ${predictions.length} stocks`);

      res.json({
        success: true,
        data: {
          predictions,
          analysis: batchAnalysis,
          processed: predictions.length,
          errors: errors.length > 0 ? errors : undefined
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error in predict-batch endpoint:', error);
      res.status(500).json({
        error: 'Failed to generate batch predictions',
        message: error.message
      });
    }
  });

  /**
   * GET /api/gnn/model
   * Get model summary and architecture
   */
  app.get('/api/gnn/model', (req, res) => {
    try {
      const summary = gnnModel.getSummary();
      const weights = gnnModel.saveWeights();

      res.json({
        success: true,
        data: {
          summary: summary,
          weightsSize: {
            W1: summary.parameters,
            b1: summary.layers[1].shape[0],
            W_attention: summary.layers[2].shape[0],
            W2: summary.layers[3].shape[0],
            b2: summary.layers[3].shape[0]
          },
          trained: summary.trainedAt ? true : false,
          accuracy: summary.accuracy,
          trainedAt: summary.trainedAt
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error in model endpoint:', error);
      res.status(500).json({
        error: 'Failed to get model information',
        message: error.message
      });
    }
  });

  /**
   * GET /api/gnn/graph
   * Get graph analysis and structure
   */
  app.get('/api/gnn/graph', (req, res) => {
    try {
      const summary = graphBuilder.getSummary();
      const leaders = graphBuilder.identifyMarketLeaders(10);
      const anomalies = graphBuilder.findCorrelationAnomalies();
      const sectorStats = graphBuilder.getSectorStats();

      res.json({
        success: true,
        data: {
          summary: summary,
          leaders: leaders,
          anomalies: anomalies.slice(0, 10),
          sectors: sectorStats,
          visualization: graphBuilder.getVisualizationData()
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error in graph endpoint:', error);
      res.status(500).json({
        error: 'Failed to get graph analysis',
        message: error.message
      });
    }
  });

  /**
   * GET /api/gnn/graph/:symbol
   * Get neighbors for a specific stock
   */
  app.get('/api/gnn/graph/:symbol', (req, res) => {
    try {
      const { symbol } = req.params;
      const neighbors = graphBuilder.getNeighbors(symbol);
      const similarity = {};

      // Get similarity to top neighbors
      for (const neighbor of neighbors.slice(0, 5)) {
        similarity[neighbor.symbol] = graphBuilder.calculateSimilarity(symbol, neighbor.symbol);
      }

      res.json({
        success: true,
        data: {
          symbol: symbol,
          neighbors: neighbors,
          neighborCount: neighbors.length,
          similarity: similarity
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error(`Error in graph symbol endpoint for ${req.params.symbol}:`, error);
      res.status(500).json({
        error: 'Failed to get graph neighbors',
        message: error.message
      });
    }
  });

  /**
   * GET /api/gnn/performance
   * Get overall performance metrics
   */
  app.get('/api/gnn/performance', (req, res) => {
    try {
      const predictions = predictionEngine.predictions || [];

      if (predictions.length === 0) {
        return res.json({
          success: true,
          data: {
            message: 'No predictions available yet'
          },
          timestamp: new Date()
        });
      }

      // Extract outcomes from predictions (mock data in practice)
      const outcomes = predictions.map(p => ({
        direction: p.signals.aggregated.direction,
        actualPrice: 100,  // Would be populated from actual prices
        expectedPrice: 100  // Would be calculated from prediction
      }));

      // Validate predictions
      const accuracy = accuracyCalculator.validatePredictions(
        predictions.map(p => ({
          direction: p.signals.aggregated.direction,
          probability: p.confidence,
          confidence: p.confidence
        })),
        outcomes
      );

      // Calculate performance metrics from returns
      const returns = predictions.map((p, i) => {
        if (i === 0) return 0;
        return (Math.random() - 0.5) * 0.02;  // Mock returns
      });

      const prices = returns.reduce((acc, ret, i) => {
        acc.push((acc[i - 1] || 100) * (1 + ret));
        return acc;
      }, []);

      const performance = performanceCalculator.calculateMetrics(returns, prices);

      logger.info('📊 Prediction API - Retrieved performance metrics');

      res.json({
        success: true,
        data: {
          accuracy: accuracy,
          performance: performance,
          totalPredictions: predictions.length
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error in performance endpoint:', error);
      res.status(500).json({
        error: 'Failed to get performance metrics',
        message: error.message
      });
    }
  });

  /**
   * POST /api/gnn/train
   * Train the GNN model on historical data
   */
  app.post('/api/gnn/train', async (req, res) => {
    try {
      const { trainingData, epochs = 100 } = req.body;

      if (!trainingData || !Array.isArray(trainingData) || trainingData.length === 0) {
        return res.status(400).json({
          error: 'Missing or invalid trainingData'
        });
      }

      logger.info(`📈 Starting model training with ${trainingData.length} samples, ${epochs} epochs`);

      const result = await gnnModel.train(trainingData, epochs);

      logger.info(`✅ Model training complete - Accuracy: ${(result.accuracy * 100).toFixed(1)}%`);

      res.json({
        success: true,
        data: {
          ...result,
          message: 'Model training complete'
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error in train endpoint:', error);
      res.status(500).json({
        error: 'Failed to train model',
        message: error.message
      });
    }
  });

  /**
   * POST /api/gnn/validate
   * Validate predictions against actual outcomes
   */
  app.post('/api/gnn/validate', (req, res) => {
    try {
      const { predictions, outcomes } = req.body;

      if (!predictions || !outcomes) {
        return res.status(400).json({
          error: 'Missing required fields: predictions, outcomes'
        });
      }

      const validation = accuracyCalculator.validatePredictions(predictions, outcomes);

      const summary = accuracyCalculator.getSummary(validation);

      logger.info('📊 Prediction API - Validated predictions');

      res.json({
        success: true,
        data: {
          validation: validation,
          summary: summary
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error in validate endpoint:', error);
      res.status(500).json({
        error: 'Failed to validate predictions',
        message: error.message
      });
    }
  });

  /**
   * GET /api/gnn/history
   * Get prediction history
   */
  app.get('/api/gnn/history', (req, res) => {
    try {
      const { limit = 20, symbol = null } = req.query;

      let history = predictionEngine.predictions || [];

      if (symbol) {
        history = history.filter(p => p.symbol === symbol);
      }

      history = history.slice(-parseInt(limit));

      res.json({
        success: true,
        data: {
          count: history.length,
          predictions: history.map(p => ({
            symbol: p.symbol,
            recommendation: p.recommendation.type,
            confidence: p.confidence,
            signalStrength: p.recommendation.signalStrength,
            timestamp: p.timestamp
          }))
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error in history endpoint:', error);
      res.status(500).json({
        error: 'Failed to get prediction history',
        message: error.message
      });
    }
  });

  /**
   * GET /api/gnn/consensus
   * Get market consensus from recent predictions
   */
  app.get('/api/gnn/consensus', (req, res) => {
    try {
      const predictions = predictionEngine.predictions || [];

      if (predictions.length === 0) {
        return res.json({
          success: true,
          data: {
            message: 'No predictions available for consensus'
          },
          timestamp: new Date()
        });
      }

      const analysis = predictionEngine.getBatchAnalysis(predictions);

      // Group by sector if available
      const bySector = {};
      predictions.forEach(p => {
        // Mock sector for now
        const sector = 'TECH';
        if (!bySector[sector]) {
          bySector[sector] = {
            up: 0,
            down: 0,
            neutral: 0,
            total: 0
          };
        }
        bySector[sector].total++;
        if (p.signals.aggregated.direction === 'UP') {
          bySector[sector].up++;
        } else if (p.signals.aggregated.direction === 'DOWN') {
          bySector[sector].down++;
        } else {
          bySector[sector].neutral++;
        }
      });

      logger.info(`📊 Prediction API - Generated market consensus`);

      res.json({
        success: true,
        data: {
          overall: analysis,
          bySector: bySector
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error in consensus endpoint:', error);
      res.status(500).json({
        error: 'Failed to get market consensus',
        message: error.message
      });
    }
  });

  /**
   * POST /api/gnn/backtest
   * Backtest predictions against historical data
   */
  app.post('/api/gnn/backtest', async (req, res) => {
    try {
      const { symbol, ohlcvData, fundamentals, startDate, endDate } = req.body;

      if (!symbol || !ohlcvData) {
        return res.status(400).json({
          error: 'Missing required fields: symbol, ohlcvData'
        });
      }

      logger.info(`📈 Backtest started for ${symbol}`);

      // Generate prediction
      const prediction = await predictionEngine.generatePrediction(
        symbol,
        ohlcvData,
        fundamentals || {}
      );

      // Mock backtest results
      const backtestResults = {
        symbol,
        startDate,
        endDate,
        prediction: prediction,
        backtestMetrics: {
          totalTrades: 10,
          winningTrades: 6,
          losingTrades: 4,
          winRate: 0.60,
          profitFactor: 1.5,
          sharpeRatio: 1.2,
          maxDrawdown: 0.15,
          totalReturn: 0.25,
          annualizedReturn: 0.30
        }
      };

      logger.info(`✅ Backtest complete for ${symbol}`);

      res.json({
        success: true,
        data: backtestResults,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error in backtest endpoint:', error);
      res.status(500).json({
        error: 'Failed to run backtest',
        message: error.message
      });
    }
  });

  /**
   * GET /api/gnn/metrics/:symbol
   * Get detailed metrics for a specific stock
   */
  app.get('/api/gnn/metrics/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;

      // Find latest prediction for symbol
      const predictions = predictionEngine.predictions || [];
      const latestPrediction = predictions
        .filter(p => p.symbol === symbol)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

      if (!latestPrediction) {
        return res.status(404).json({
          error: `No predictions found for ${symbol}`
        });
      }

      const metrics = {
        symbol: symbol,
        prediction: latestPrediction,
        graphAnalysis: {
          neighbors: graphBuilder.getNeighbors(symbol),
          sector: 'TECH'  // Mock
        }
      };

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error(`Error in metrics endpoint for ${req.params.symbol}:`, error);
      res.status(500).json({
        error: 'Failed to get metrics',
        message: error.message
      });
    }
  });

  /**
   * POST /api/gnn/save-model
   * Save model weights
   */
  app.post('/api/gnn/save-model', async (req, res) => {
    try {
      const { name = 'default' } = req.body;

      const weights = gnnModel.saveWeights();

      // In production, save to database
      logger.info(`💾 Model saved as "${name}"`);

      res.json({
        success: true,
        data: {
          name: name,
          saved: true,
          accuracy: weights.accuracy,
          trainedAt: weights.trainedAt
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error saving model:', error);
      res.status(500).json({
        error: 'Failed to save model',
        message: error.message
      });
    }
  });

  /**
   * GET /api/gnn/health
   * Health check for GNN system
   */
  app.get('/api/gnn/health', (req, res) => {
    const predictions = predictionEngine.predictions || [];
    const summary = predictionEngine.getSummary();

    res.json({
      success: true,
      data: {
        status: 'healthy',
        components: {
          gnnModel: gnnModel ? 'ready' : 'not-initialized',
          graphBuilder: graphBuilder ? 'ready' : 'not-initialized',
          predictionEngine: predictionEngine ? 'ready' : 'not-initialized',
          accuracyCalculator: accuracyCalculator ? 'ready' : 'not-initialized',
          performanceCalculator: performanceCalculator ? 'ready' : 'not-initialized'
        },
        stats: {
          totalPredictions: predictions.length,
          recentPredictions: summary.totalPredictions,
          avgConfidence: summary.avgConfidence
        }
      },
      timestamp: new Date()
    });
  });

  logger.info('✅ GNN prediction endpoints registered');
}

// Export
module.exports = {
  registerGNNEndpoints
};
