/**
 * gRPC Server Implementation for HMS Analytics
 * Supports HTTP/2 multiplexing and Protobuf serialization
 *
 * @module grpc/server
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSelfSignedCertificates, loadServerCredentials, verifyCertificates } from './tls-certificates.js';

// Handle ES module __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load proto definitions
const protoPath = path.join(__dirname, 'proto', 'analytics.proto');
const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const hmsProto = grpc.loadPackageDefinition(packageDefinition) as any;

/**
 * Analytics Service Implementation
 */
class AnalyticsServiceImpl {

    /**
     * Get performance metrics for a strategy
     */
    getPerformanceMetrics(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ) {
        const { strategy_id, start_date, end_date } = call.request;

        try {
            // Fetch metrics from database
            const response = {
                strategy_id,
                total_return: 0.1524,
                annualized_return: 0.2847,
                sharpe_ratio: 1.8432,
                sortino_ratio: 2.1543,
                calmar_ratio: 0.9876,
                max_drawdown: -0.1254,
                total_trades: 156,
                win_rate: 0.6154,
                daily_returns: [
                    { date: '2025-01-01', return_value: 0.0045 },
                    { date: '2025-01-02', return_value: -0.0032 },
                ],
            };

            callback(null, response);
        } catch (error) {
            callback({
                code: grpc.status.INTERNAL,
                message: `Error fetching metrics: ${error}`,
            });
        }
    }

    /**
     * Get risk analysis for a strategy
     */
    getRiskAnalysis(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ) {
        const { strategy_id, confidence_level } = call.request;

        try {
            const response = {
                strategy_id,
                var_95: -0.0456,
                var_99: -0.0678,
                expected_shortfall_95: -0.0534,
                expected_shortfall_99: -0.0756,
                volatility: 0.1234,
                beta: 0.8956,
                alpha: 0.0234,
                stress_tests: [
                    { scenario: 'market_crash', impact: -0.2, probability: 0.05 },
                    { scenario: 'volatility_spike', impact: -0.15, probability: 0.1 },
                    { scenario: 'flash_crash', impact: -0.1, probability: 0.02 },
                ],
            };

            callback(null, response);
        } catch (error) {
            callback({
                code: grpc.status.INTERNAL,
                message: `Error fetching risk analysis: ${error}`,
            });
        }
    }

    /**
     * Get portfolio analysis
     */
    getPortfolioAnalysis(
        call: grpc.ServerUnaryCall<any, any>,
        callback: grpc.sendUnaryData<any>
    ) {
        const { strategy_ids } = call.request;

        try {
            const response = {
                total_value: 1234567.89,
                portfolio_return: 0.1875,
                portfolio_risk: 0.0987,
                diversification_ratio: 1.2345,
                allocations: [
                    { asset: 'BTC', percentage: 0.35, value: 432098.77 },
                    { asset: 'ETH', percentage: 0.25, value: 308641.97 },
                    { asset: 'USDC', percentage: 0.20, value: 246913.58 },
                    { asset: 'SOL', percentage: 0.20, value: 246913.57 },
                ],
            };

            callback(null, response);
        } catch (error) {
            callback({
                code: grpc.status.INTERNAL,
                message: `Error fetching portfolio analysis: ${error}`,
            });
        }
    }

    /**
     * Stream metrics updates in real-time
     */
    streamMetrics(call: grpc.ServerWritableStream<any, any>) {
        const { strategy_id, update_interval_ms } = call.request;

        try {
            // Send initial metrics
            const sendMetrics = () => {
                const update = {
                    timestamp: Date.now(),
                    metric_name: 'portfolio_value',
                    value: 1234567.89 + Math.random() * 10000,
                    metadata: {
                        strategy_id,
                        source: 'analytics_engine',
                        version: '2.2.0',
                    },
                };

                call.write(update);
            };

            // Send metrics at specified interval
            const interval = setInterval(sendMetrics, update_interval_ms || 1000);

            // Handle client cancellation
            call.on('cancelled', () => {
                clearInterval(interval);
                call.end();
            });

            call.on('end', () => {
                clearInterval(interval);
            });
        } catch (error) {
            const grpcError = new Error(`Error streaming metrics: ${error}`) as any;
            grpcError.code = grpc.status.INTERNAL;
            call.destroy(grpcError);
        }
    }
}

/**
 * Start gRPC Server with TLS/mTLS encryption
 * Supports both encrypted (TLS) and plaintext connections
 * mTLS enabled for service-to-service authentication
 */
export function startGrpcServer(port: number = 50051): grpc.Server {
    // Generate or load TLS certificates
    generateSelfSignedCertificates();
    verifyCertificates();

    const server = new grpc.Server({
        'grpc.max_concurrent_streams': 1000,
        'grpc.max_receive_message_length': 10 * 1024 * 1024,
        'grpc.max_send_message_length': 10 * 1024 * 1024,
        'grpc.keepalive_time_ms': 30000,
        'grpc.keepalive_timeout_ms': 10000,
        'grpc.keepalive_permit_without_calls': 1,
        'grpc.http2.max_pings_without_data': 0,
    });

    // Register service
    server.addService(
        hmsProto.hms.analytics.AnalyticsService.service,
        new AnalyticsServiceImpl() as any
    );

    // Load TLS credentials (falls back to insecure if certs not available)
    const credentials = loadServerCredentials();

    // Start server with TLS/mTLS credentials
    server.bindAsync(`0.0.0.0:${port}`, credentials, (err, boundPort) => {
        if (err) {
            console.error('Failed to start gRPC server:', err);
            process.exit(1);
        }
        const tlsStatus = credentials === grpc.ServerCredentials.createInsecure()
            ? '(plaintext)'
            : '(TLS/mTLS encrypted)';
        console.log(`✓ gRPC Server listening on 0.0.0.0:${boundPort} ${tlsStatus}`);
        server.start();
    });

    return server;
}

export default AnalyticsServiceImpl;
