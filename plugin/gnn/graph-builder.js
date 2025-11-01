/**
 * Graph Builder
 * Constructs correlation graphs and market relationship networks for GNN input
 *
 * Features:
 * - Stock correlation calculation
 * - Sector relationship mapping
 * - Graph adjacency matrix construction
 * - Community detection
 * - Market network visualization
 */

const EventEmitter = require('events');

/**
 * Graph Builder
 * Builds market relationship graphs for GNN input
 */
class GraphBuilder extends EventEmitter {
  constructor(config = {}) {
    super();

    this.logger = config.logger || console;
    this.correlationThreshold = config.correlationThreshold || 0.5;
    this.maxNeighbors = config.maxNeighbors || 10;
    this.database = config.database;

    this.stocks = [];
    this.correlationMatrix = null;
    this.adjacencyMatrix = null;
    this.graph = null;
  }

  /**
   * Build market graph from price data
   * @param {Array} stocks - Array of {symbol, priceHistory} objects
   * @param {Array} sectorMap - Mapping of symbols to sectors
   * @returns {Promise<Object>} Constructed graph
   */
  async buildGraph(stocks, sectorMap = {}) {
    try {
      this.stocks = stocks;

      // Calculate correlation matrix
      const correlationMatrix = this.calculateCorrelationMatrix(stocks);
      this.correlationMatrix = correlationMatrix;

      // Build adjacency matrix from correlations
      const adjacencyMatrix = this.buildAdjacencyMatrix(correlationMatrix);
      this.adjacencyMatrix = adjacencyMatrix;

      // Create graph structure
      const graph = {
        nodes: this.createNodes(stocks, sectorMap),
        edges: this.createEdges(stocks, correlationMatrix, sectorMap),
        correlationMatrix: correlationMatrix,
        adjacencyMatrix: adjacencyMatrix,
        stats: this.calculateGraphStats(stocks, correlationMatrix)
      };

      this.graph = graph;

      this.logger.info(`📊 Graph built with ${graph.nodes.length} nodes and ${graph.edges.length} edges`);
      this.emit('graph:built', graph);

      return graph;
    } catch (error) {
      this.logger.error('Error building market graph:', error);
      throw error;
    }
  }

  /**
   * Calculate correlation matrix for all stocks
   * @private
   */
  calculateCorrelationMatrix(stocks) {
    const n = stocks.length;
    const correlations = Array(n).fill(null).map(() => Array(n).fill(0));

    // Self-correlation is 1
    for (let i = 0; i < n; i++) {
      correlations[i][i] = 1.0;
    }

    // Calculate pairwise correlations
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const correlation = this.calculatePearsonCorrelation(
          stocks[i].priceHistory,
          stocks[j].priceHistory
        );

        correlations[i][j] = correlation;
        correlations[j][i] = correlation;
      }
    }

    return correlations;
  }

  /**
   * Calculate Pearson correlation between two price series
   * @private
   */
  calculatePearsonCorrelation(series1, series2) {
    // Get returns (log returns for better distribution)
    const minLen = Math.min(series1.length, series2.length);
    if (minLen < 2) return 0;

    const returns1 = [];
    const returns2 = [];

    for (let i = 1; i < minLen; i++) {
      returns1.push(Math.log(series1[i] / series1[i - 1]));
      returns2.push(Math.log(series2[i] / series2[i - 1]));
    }

    // Calculate means
    const mean1 = returns1.reduce((a, b) => a + b) / returns1.length;
    const mean2 = returns2.reduce((a, b) => a + b) / returns2.length;

    // Calculate covariance and standard deviations
    let covariance = 0;
    let var1 = 0;
    let var2 = 0;

    for (let i = 0; i < returns1.length; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;

      covariance += diff1 * diff2;
      var1 += diff1 * diff1;
      var2 += diff2 * diff2;
    }

    const std1 = Math.sqrt(var1 / returns1.length);
    const std2 = Math.sqrt(var2 / returns2.length);

    if (std1 === 0 || std2 === 0) return 0;

    const correlation = covariance / (returns1.length * std1 * std2);
    return Number(Math.max(-1, Math.min(1, correlation)).toFixed(4));
  }

  /**
   * Build adjacency matrix from correlation matrix
   * @private
   */
  buildAdjacencyMatrix(correlationMatrix) {
    const n = correlationMatrix.length;
    const adjacency = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      // Get correlations for this stock, sorted by strength
      const correlations = correlationMatrix[i].map((corr, idx) => ({
        idx,
        corr: Math.abs(corr)
      })).sort((a, b) => b.corr - a.corr);

      // Connect to top neighbors (excluding self)
      let connected = 0;
      for (const { idx, corr } of correlations) {
        if (idx === i) continue;  // Skip self
        if (corr >= this.correlationThreshold && connected < this.maxNeighbors) {
          adjacency[i][idx] = Math.abs(correlationMatrix[i][idx]);
          connected++;
        }
      }
    }

    return adjacency;
  }

  /**
   * Create graph nodes from stocks
   * @private
   */
  createNodes(stocks, sectorMap) {
    return stocks.map((stock, idx) => ({
      id: stock.symbol,
      index: idx,
      symbol: stock.symbol,
      sector: sectorMap[stock.symbol] || 'UNKNOWN',
      priceHistory: stock.priceHistory,
      features: null,  // Will be filled later with technical/fundamental features
      degree: 0  // Will be calculated
    }));
  }

  /**
   * Create graph edges from correlations
   * @private
   */
  createEdges(stocks, correlationMatrix, sectorMap) {
    const edges = [];
    const n = stocks.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const correlation = correlationMatrix[i][j];

        if (Math.abs(correlation) >= this.correlationThreshold) {
          edges.push({
            source: stocks[i].symbol,
            target: stocks[j].symbol,
            sourceIdx: i,
            targetIdx: j,
            weight: Math.abs(correlation),
            correlation: correlation,
            relationship: correlation > 0 ? 'positive' : 'negative',
            sameSector: sectorMap[stocks[i].symbol] === sectorMap[stocks[j].symbol]
          });
        }
      }
    }

    return edges;
  }

  /**
   * Calculate graph statistics
   * @private
   */
  calculateGraphStats(stocks, correlationMatrix) {
    const n = stocks.length;
    const correlations = [];

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        correlations.push(correlationMatrix[i][j]);
      }
    }

    const avgCorrelation = correlations.reduce((a, b) => a + b, 0) / correlations.length;
    const maxCorrelation = Math.max(...correlations);
    const minCorrelation = Math.min(...correlations);

    // Calculate degree for each node
    const degrees = stocks.map((_, i) => {
      let degree = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j && Math.abs(correlationMatrix[i][j]) >= this.correlationThreshold) {
          degree++;
        }
      }
      return degree;
    });

    const avgDegree = degrees.reduce((a, b) => a + b, 0) / degrees.length;

    return {
      nodeCount: n,
      edgeCount: correlations.filter(c => Math.abs(c) >= this.correlationThreshold).length,
      avgCorrelation: Number(avgCorrelation.toFixed(4)),
      maxCorrelation: Number(maxCorrelation.toFixed(4)),
      minCorrelation: Number(minCorrelation.toFixed(4)),
      avgDegree: Number(avgDegree.toFixed(2)),
      maxDegree: Math.max(...degrees),
      minDegree: Math.min(...degrees)
    };
  }

  /**
   * Get neighbors for a given stock
   * @param {string} symbol - Stock symbol
   * @returns {Array} Neighbor stocks with correlation weights
   */
  getNeighbors(symbol) {
    if (!this.graph) return [];

    const nodeIdx = this.graph.nodes.findIndex(n => n.symbol === symbol);
    if (nodeIdx === -1) return [];

    const neighbors = [];
    const adjacency = this.adjacencyMatrix[nodeIdx];

    for (let j = 0; j < adjacency.length; j++) {
      if (adjacency[j] > 0) {
        neighbors.push({
          symbol: this.graph.nodes[j].symbol,
          correlation: this.correlationMatrix[nodeIdx][j],
          weight: adjacency[j]
        });
      }
    }

    return neighbors.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  }

  /**
   * Detect communities in the graph
   * @returns {Array} Community assignments
   */
  detectCommunities() {
    if (!this.graph) return [];

    // Simple community detection using modularity (Louvain-like)
    const n = this.graph.nodes.length;
    const communities = Array(n).fill(0);
    let communityId = 0;

    const visited = new Set();

    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue;

      // BFS to find connected component
      const queue = [i];
      visited.add(i);
      communities[i] = communityId;

      while (queue.length > 0) {
        const nodeIdx = queue.shift();

        for (let j = 0; j < this.adjacencyMatrix[nodeIdx].length; j++) {
          if (!visited.has(j) && this.adjacencyMatrix[nodeIdx][j] > 0) {
            visited.add(j);
            communities[j] = communityId;
            queue.push(j);
          }
        }
      }

      communityId++;
    }

    return communities;
  }

  /**
   * Get graph visualization data
   * @returns {Object} Data for visualization
   */
  getVisualizationData() {
    if (!this.graph) return { nodes: [], edges: [] };

    const communities = this.detectCommunities();

    return {
      nodes: this.graph.nodes.map((node, idx) => ({
        id: node.symbol,
        label: node.symbol,
        sector: node.sector,
        community: communities[idx],
        size: this.graph.stats.avgDegree > 0 ? 10 + (this.getNeighbors(node.symbol).length / this.graph.stats.maxDegree) * 30 : 10
      })),
      edges: this.graph.edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        relationship: edge.relationship
      })),
      communities: communityId
    };
  }

  /**
   * Extract neighbor features for GNN
   * @param {string} symbol - Stock symbol
   * @param {Function} featureExtractor - Function to extract features from stock data
   * @returns {Promise<Array>} Array of neighbor feature vectors
   */
  async extractNeighborFeatures(symbol, featureExtractor) {
    try {
      const neighbors = this.getNeighbors(symbol);

      const neighborFeatures = [];
      for (const neighbor of neighbors) {
        const neighborNode = this.graph.nodes.find(n => n.symbol === neighbor.symbol);
        if (neighborNode) {
          const features = await featureExtractor(neighborNode.symbol);
          neighborFeatures.push({
            symbol: neighbor.symbol,
            features: features,
            correlation: neighbor.correlation
          });
        }
      }

      return neighborFeatures;
    } catch (error) {
      this.logger.error(`Error extracting neighbor features for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Calculate similarity between stocks
   * @param {string} symbol1 - First stock symbol
   * @param {string} symbol2 - Second stock symbol
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(symbol1, symbol2) {
    if (!this.graph) return 0;

    const idx1 = this.graph.nodes.findIndex(n => n.symbol === symbol1);
    const idx2 = this.graph.nodes.findIndex(n => n.symbol === symbol2);

    if (idx1 === -1 || idx2 === -1) return 0;

    return Number(Math.abs(this.correlationMatrix[idx1][idx2]).toFixed(4));
  }

  /**
   * Get sector stats
   * @returns {Object} Statistics by sector
   */
  getSectorStats() {
    if (!this.graph) return {};

    const stats = {};

    for (const node of this.graph.nodes) {
      if (!stats[node.sector]) {
        stats[node.sector] = {
          stocks: [],
          avgCorrelation: 0,
          internalEdges: 0
        };
      }
      stats[node.sector].stocks.push(node.symbol);
    }

    // Calculate intra-sector correlations
    for (const sector in stats) {
      const stockIndices = [];
      for (const stock of stats[sector].stocks) {
        const idx = this.graph.nodes.findIndex(n => n.symbol === stock);
        if (idx !== -1) stockIndices.push(idx);
      }

      let sumCorr = 0;
      let count = 0;
      for (let i = 0; i < stockIndices.length; i++) {
        for (let j = i + 1; j < stockIndices.length; j++) {
          sumCorr += Math.abs(this.correlationMatrix[stockIndices[i]][stockIndices[j]]);
          count++;
          if (this.adjacencyMatrix[stockIndices[i]][stockIndices[j]] > 0) {
            stats[sector].internalEdges++;
          }
        }
      }

      stats[sector].avgCorrelation = count > 0 ? Number((sumCorr / count).toFixed(4)) : 0;
    }

    return stats;
  }

  /**
   * Identify market leaders (high degree nodes)
   * @returns {Array} Top nodes by connectivity
   */
  identifyMarketLeaders(limit = 5) {
    if (!this.graph) return [];

    const leaders = this.graph.nodes.map((node, idx) => ({
      symbol: node.symbol,
      degree: this.getNeighbors(node.symbol).length,
      sector: node.sector,
      avgCorrelation: this.graph.nodes[idx].avgCorrelation || 0
    })).sort((a, b) => b.degree - a.degree).slice(0, limit);

    return leaders;
  }

  /**
   * Find correlation anomalies
   * @returns {Array} Unusual correlation relationships
   */
  findCorrelationAnomalies() {
    if (!this.graph) return [];

    const anomalies = [];
    const stats = this.graph.stats;

    for (const edge of this.graph.edges) {
      // Anomaly if correlation is significantly different from average
      const deviation = Math.abs(edge.correlation - stats.avgCorrelation);
      if (deviation > stats.avgCorrelation * 0.5) {
        anomalies.push({
          source: edge.source,
          target: edge.target,
          correlation: edge.correlation,
          deviation: Number(deviation.toFixed(4)),
          isNegative: edge.correlation < 0
        });
      }
    }

    return anomalies.sort((a, b) => b.deviation - a.deviation);
  }

  /**
   * Get graph summary
   * @returns {Object} Summary of graph structure
   */
  getSummary() {
    if (!this.graph) return {};

    const sectorStats = this.getSectorStats();
    const leaders = this.identifyMarketLeaders(10);
    const anomalies = this.findCorrelationAnomalies();

    return {
      graph: {
        nodeCount: this.graph.nodes.length,
        edgeCount: this.graph.edges.length,
        density: this.graph.stats.edgeCount / (this.graph.nodes.length * (this.graph.nodes.length - 1) / 2)
      },
      correlations: {
        average: this.graph.stats.avgCorrelation,
        max: this.graph.stats.maxCorrelation,
        min: this.graph.stats.minCorrelation,
        threshold: this.correlationThreshold
      },
      connectivity: {
        avgDegree: this.graph.stats.avgDegree,
        maxDegree: this.graph.stats.maxDegree,
        minDegree: this.graph.stats.minDegree
      },
      sectors: Object.keys(sectorStats).length,
      leaders: leaders,
      anomalies: anomalies.slice(0, 10)
    };
  }
}

// Export
module.exports = {
  GraphBuilder
};
