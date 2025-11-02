/**
 * HTTP/2 Type Definitions for SPDY Response Extensions
 * Extends Express Response with HTTP/2 server push capabilities
 */

import { Response } from 'express';
import { Stream } from 'stream';

declare module 'express-serve-static-core' {
    interface Response {
        /**
         * HTTP/2 Server Push API (SPDY)
         * @param path - Resource path to push
         * @param options - Push options including headers
         */
        push?: (
            path: string,
            options: {
                status: number;
                method: string;
                request: { accept: string };
                response: { 'content-type': string };
            }
        ) => Stream;
    }
}
