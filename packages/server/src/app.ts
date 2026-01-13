import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { registerRoutes } from './api/index.js';
import { setConfig } from './config/index.js';
import type { ServerConfig } from './types/index.js';

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

  // Register all routes
  await registerRoutes(app);

  return app;
}
