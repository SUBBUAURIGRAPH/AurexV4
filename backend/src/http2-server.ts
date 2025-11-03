/**
 * HTTP/2 Server Implementation
 * Enables multiplexing and server push for improved performance
 *
 * @module http2-server
 */

import spdy from 'spdy';
import * as fs from 'fs';
import * as path from 'path';
import type { Request, Response } from 'express';
import express from 'express';
import './types/http2.js';

/**
 * Create HTTP/2 server with Express
 */
export function createHttp2Server(app: express.Application, options?: {
    key?: string;
    cert?: string;
    port?: number;
}) {
    const port = options?.port || 3000;

    try {
        // If SSL certificates are provided, create HTTPS/HTTP2 server
        if (options?.key && options?.cert) {
            const serverOptions = {
                key: fs.readFileSync(options.key),
                cert: fs.readFileSync(options.cert),
            };

            const server = spdy.createServer(serverOptions, app);

            // Enable server push for static assets
            app.get('/', (req: Request, res: Response) => {
                // Push static resources
                if (res.push) {
                    res.push('/css/style.css', {
                        status: 200,
                        method: 'GET',
                        request: { accept: '*/*' },
                        response: { 'content-type': 'text/css' },
                    });

                    res.push('/js/app.js', {
                        status: 200,
                        method: 'GET',
                        request: { accept: '*/*' },
                        response: { 'content-type': 'application/javascript' },
                    });
                }

                res.json({ status: 'healthy', http2: true });
            });

            return server;
        } else {
            // Fall back to standard HTTP server (HTTP/2 requires TLS in production)
            // For development/testing, use plain HTTP/1.1
            console.warn('HTTP/2 requires SSL certificates. Falling back to HTTP/1.1');
            return app as any;
        }
    } catch (error) {
        console.error('Failed to create HTTP/2 server:', error);
        throw error;
    }
}

/**
 * Configure Express for HTTP/2 optimization
 */
export function configureHttp2Express(app: express.Application) {
    // Enable compression for HTTP/2
    app.use((req: Request, res: Response, next) => {
        // Set HTTP/2 specific headers
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('X-XSS-Protection', '1; mode=block');

        // Enable HTTP/2 prioritization
        res.setHeader('Link', '</css/style.css>; rel=preload; as=style');
        res.setHeader('Link', '</js/app.js>; rel=preload; as=script');

        next();
    });

    // Optimize for HTTP/2 multiplexing
    app.disable('x-powered-by');

    // Enable keep-alive
    app.use((req: Request, res: Response, next) => {
        res.set('Connection', 'keep-alive');
        res.set('Keep-Alive', 'timeout=5, max=100');
        next();
    });

    return app;
}

/**
 * HTTP/2 Server Push Helper
 */
export function http2ServerPush(res: Response, filePath: string, contentType: string) {
    if (!res.push) return; // Fallback for non-HTTP/2 servers

    try {
        const push = res.push(filePath, {
            status: 200,
            method: 'GET',
            request: { accept: '*/*' },
            response: { 'content-type': contentType },
        });

        push.on('error', (err: Error) => {
            console.error(`Failed to push ${filePath}:`, err);
        });
    } catch (error) {
        console.error('HTTP/2 server push error:', error);
    }
}

export default createHttp2Server;
