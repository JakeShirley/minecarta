import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { API_BASE_PATH } from '@minecarta/shared';
import { registerWorldRoutes } from './world-routes.js';
import { registerPlayerRoutes } from './player-routes.js';
import { registerTileRoutes } from './tile-routes.js';
import type { HealthCheckResponse } from '../types/index.js';

const startTime = Date.now();

/**
 * Register all API routes
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
    // Health check endpoint (no auth required)
    app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
        const response: HealthCheckResponse = {
            status: 'ok',
            uptime: Date.now() - startTime,
            timestamp: Date.now(),
        };
        return reply.send(response);
    });

    // Register API routes under versioned prefix
    await app.register(
        async api => {
            // World data ingestion routes (auth required)
            await api.register(registerWorldRoutes);

            // Player query routes (public)
            await api.register(registerPlayerRoutes);

            // Tile serving routes (public)
            await api.register(registerTileRoutes);
        },
        { prefix: API_BASE_PATH }
    );
}
