import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Dimension, ZoomLevel } from '@minecraft-map/shared';
import { DIMENSIONS, ZOOM_LEVELS } from '@minecraft-map/shared';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getConfig } from '../config/index.js';

interface TileParams {
    dimension: string;
    z: string;
    x: string;
    y: string;
}

/**
 * Register tile serving routes
 */
export async function registerTileRoutes(app: FastifyInstance): Promise<void> {
    /**
     * GET /tiles/:dimension/:z/:x/:y.png - Get a map tile
     */
    app.get(
        '/tiles/:dimension/:z/:x/:y.png',
        async (request: FastifyRequest<{ Params: TileParams }>, reply: FastifyReply) => {
            const { dimension, z, x, y } = request.params;
            const config = getConfig();

            // Validate dimension
            if (!DIMENSIONS.includes(dimension as Dimension)) {
                return reply.code(400).send({
                    success: false,
                    error: `Invalid dimension: ${dimension}. Must be one of: ${DIMENSIONS.join(', ')}`,
                });
            }

            // Validate zoom level
            const zoom = parseInt(z, 10);
            if (!ZOOM_LEVELS.includes(zoom as ZoomLevel)) {
                return reply.code(400).send({
                    success: false,
                    error: `Invalid zoom level: ${z}. Must be one of: ${ZOOM_LEVELS.join(', ')}`,
                });
            }

            // Parse coordinates
            const tileX = parseInt(x, 10);
            const tileY = parseInt(y, 10);

            if (isNaN(tileX) || isNaN(tileY)) {
                return reply.code(400).send({
                    success: false,
                    error: 'Invalid tile coordinates',
                });
            }

            // Build tile path
            const tilePath = path.join(config.dataDir, 'tiles', dimension, z, x, `${y}.png`);

            // Check if tile exists
            if (!fs.existsSync(tilePath)) {
                // Return a placeholder or 404
                // For now, return 404 - in Phase 2 we'll generate tiles on demand
                return reply.code(404).send({
                    success: false,
                    error: 'Tile not found',
                });
            }

            // Read and send the tile
            const tileBuffer = fs.readFileSync(tilePath);
            return reply
                .header('Content-Type', 'image/png')
                .header('Cache-Control', 'public, max-age=60')
                .send(tileBuffer);
        }
    );
}
