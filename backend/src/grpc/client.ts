/**
 * gRPC Client for Internal Service Communication
 * Uses HTTP/2 multiplexing for efficient communication between services
 *
 * @module grpc/client
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

/**
 * Analytics Service Client
 */
export class AnalyticsServiceClient {
    private client: any;
    private channel: grpc.Channel;

    constructor(host: string = 'localhost', port: number = 50051) {
        const protoPath = path.join(__dirname, 'proto', 'analytics.proto');
        const packageDefinition = protoLoader.loadSync(protoPath, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
        });

        const hmsProto = grpc.loadPackageDefinition(packageDefinition) as any;
        const address = `${host}:${port}`;

        // Create channel with connection pooling
        this.channel = grpc.createChannel(address, grpc.credentials.createInsecure(), {
            'grpc.max_concurrent_streams': 1000,
            'grpc.max_receive_message_length': 10 * 1024 * 1024,
            'grpc.keepalive_time_ms': 30000,
        });

        this.client = new hmsProto.hms.analytics.AnalyticsService(
            address,
            grpc.credentials.createInsecure(),
            {
                'grpc.max_concurrent_streams': 1000,
            }
        );
    }

    /**
     * Get performance metrics (unary RPC)
     */
    async getPerformanceMetrics(request: {
        strategy_id: string;
        start_date?: string;
        end_date?: string;
    }): Promise<any> {
        return new Promise((resolve, reject) => {
            this.client.getPerformanceMetrics(request, (err: any, response: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Get risk analysis (unary RPC)
     */
    async getRiskAnalysis(request: {
        strategy_id: string;
        confidence_level?: string;
    }): Promise<any> {
        return new Promise((resolve, reject) => {
            this.client.getRiskAnalysis(request, (err: any, response: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Get portfolio analysis (unary RPC)
     */
    async getPortfolioAnalysis(request: {
        strategy_ids: string[];
    }): Promise<any> {
        return new Promise((resolve, reject) => {
            this.client.getPortfolioAnalysis(request, (err: any, response: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Stream metrics updates (server streaming RPC)
     */
    streamMetrics(request: {
        strategy_id: string;
        update_interval_ms?: number;
    }): grpc.ClientReadableStream<any> {
        return this.client.streamMetrics(request);
    }

    /**
     * Close the gRPC channel
     */
    close(): Promise<void> {
        return new Promise((resolve) => {
            this.channel.close();
            setTimeout(() => resolve(), 1000);
        });
    }
}

/**
 * Create singleton instance of Analytics Service Client
 */
let analyticsClient: AnalyticsServiceClient | null = null;

export function getAnalyticsClient(
    host: string = process.env.GRPC_ANALYTICS_HOST || 'localhost',
    port: number = parseInt(process.env.GRPC_ANALYTICS_PORT || '50051')
): AnalyticsServiceClient {
    if (!analyticsClient) {
        analyticsClient = new AnalyticsServiceClient(host, port);
    }
    return analyticsClient;
}

export function closeAnalyticsClient(): void {
    if (analyticsClient) {
        analyticsClient.close();
        analyticsClient = null;
    }
}

export default AnalyticsServiceClient;
