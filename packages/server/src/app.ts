import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { registerRoutes } from './api/index.js';
import { setConfig } from './config/index.js';
import type { ServerConfig } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create and configure the Fastify application
 */
export async function createApp(config: ServerConfig): Promise<FastifyInstance> {
    // Set the config so it's available throughout the app
    setConfig(config);

    const app = Fastify({
        logger: {
            level: config.logLevel,
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'HH:MM:ss Z',
                    ignore: 'pid,hostname',
                },
            },
        },
    });

    // Register CORS
    await app.register(cors, {
        origin: true, // Allow all origins in development
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-mc-auth-token'],
    });

    // Serve static files from public directory
    await app.register(fastifyStatic, {
        root: join(__dirname, '..', 'public'),
        prefix: '/',
        cacheControl: false,
        setHeaders: res => {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        },
    });

    // Register all routes
    await registerRoutes(app);

    return app;
}
