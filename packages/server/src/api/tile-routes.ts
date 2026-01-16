import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Dimension, ZoomLevel, MapType } from '@minecarta/shared';
import { DIMENSIONS, ZOOM_LEVELS, MAP_TYPES } from '@minecarta/shared';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getConfig } from '../config/index.js';
import { getTileStorageService } from '../tiles/tile-storage.js';
import { registerAuth } from './auth.js';

interface TileParams {
    dimension: string;
    mapType: string;
    z: string;
    x: string;
    y: string;
}

/**
 * Register tile serving routes
 */
export async function registerTileRoutes(app: FastifyInstance): Promise<void> {
    /**
     * GET /tiles/:dimension/:mapType/:z/:x/:y.png - Get a map tile
     */
    app.get(
        '/tiles/:dimension/:mapType/:z/:x/:y.png',
        async (request: FastifyRequest<{ Params: TileParams }>, reply: FastifyReply) => {
            const { dimension, mapType, z, x, y } = request.params;
            const config = getConfig();

            // Validate dimension
            if (!DIMENSIONS.includes(dimension as Dimension)) {
                return reply.code(400).send({
                    success: false,
                    error: `Invalid dimension: ${dimension}. Must be one of: ${DIMENSIONS.join(', ')}`,
                });
            }

            // Validate map type
            if (!MAP_TYPES.includes(mapType as MapType)) {
                return reply.code(400).send({
                    success: false,
                    error: `Invalid map type: ${mapType}. Must be one of: ${MAP_TYPES.join(', ')}`,
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

            // Build tile path (new structure: dimension/mapType/zoom/x/y.png)
            const tilePath = path.join(config.dataDir, 'tiles', dimension, mapType, z, x, `${y}.png`);

            // Check if tile exists
            if (!fs.existsSync(tilePath)) {
                // Return a placeholder or 404
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

    /**
     * DELETE /tiles - Clear all map tiles (auth required)
     */
    await app.register(async clearTilesApp => {
        registerAuth(clearTilesApp);

        clearTilesApp.delete('/tiles', async (request: FastifyRequest, reply: FastifyReply) => {
            const tileStorage = getTileStorageService();
            tileStorage.clearAllTiles();

            request.log.info('Cleared all map tiles');

            return reply.send({
                success: true,
                message: 'All tiles have been cleared',
            });
        });
    });
}

