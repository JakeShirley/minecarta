import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPlayerStateService, getEntityStateService, getTileUpdateService } from '../services/index.js';
import { getTileStorageService } from '../tiles/tile-storage.js';
import { registerAuth } from './auth.js';
import {
  playersBatchUpdateSchema,
  blocksBatchUpdateSchema,
  entitiesBatchUpdateSchema,
  chunksBatchUpdateSchema,
  chunkExistsQuerySchema,
} from './schemas.js';
import type { Dimension, ZoomLevel } from '@minecraft-map/shared';

/**
 * Register world data ingestion routes
 *
 * These routes receive data from the Minecraft behavior pack
 */
export async function registerWorldRoutes(app: FastifyInstance): Promise<void> {
  // Apply authentication to all routes in this plugin
  registerAuth(app);

  /**
   * POST /world/players - Receive player positions
   */
  app.post('/world/players', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = playersBatchUpdateSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
    }

    const { players } = parseResult.data;
    const playerService = getPlayerStateService();

    for (const player of players) {
      playerService.updatePlayer(player);
    }

    request.log.info({ count: players.length }, 'Updated player positions');

    return reply.send({
      success: true,
      data: { updated: players.length },
    });
  });

  /**
   * POST /world/blocks - Receive block changes
   */
  app.post('/world/blocks', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = blocksBatchUpdateSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
    }

    const { blocks } = parseResult.data;
    const tileUpdateService = getTileUpdateService();

    // Process block updates asynchronously to not block the response
    tileUpdateService.processBlockUpdates(blocks).catch(err => {
      request.log.error({ err }, 'Error processing block updates');
    });

    request.log.info({ count: blocks.length }, 'Received block changes');

    return reply.send({
      success: true,
      data: { received: blocks.length },
    });
  });

  /**
   * POST /world/entities - Receive entity updates
   */
  app.post('/world/entities', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = entitiesBatchUpdateSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
    }

    const { entities } = parseResult.data;
    const entityService = getEntityStateService();

    entityService.updateEntities(entities);

    request.log.info({ count: entities.length }, 'Updated entity positions');

    return reply.send({
      success: true,
      data: { updated: entities.length },
    });
  });

  /**
   * POST /world/chunks - Receive chunk data
   */
  app.post('/world/chunks', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = chunksBatchUpdateSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
    }

    const { chunks } = parseResult.data;
    const tileUpdateService = getTileUpdateService();

    // Process chunk updates asynchronously
    tileUpdateService.processChunks(chunks).catch(err => {
      request.log.error({ err }, 'Error processing chunk updates');
    });

    request.log.info({ count: chunks.length }, 'Received chunk data');

    return reply.send({
      success: true,
      data: { received: chunks.length },
    });
  });

  /**
   * GET /world/state - Get current world state
   */
  app.get('/world/state', async (_request: FastifyRequest, reply: FastifyReply) => {
    const playerService = getPlayerStateService();
    const entityService = getEntityStateService();

    return reply.send({
      success: true,
      data: {
        players: playerService.getAllPlayers(),
        entities: entityService.getAllEntities(),
        lastUpdated: Date.now(),
      },
    });
  });

  /**
   * GET /world/chunk/exists - Check if a chunk tile exists at the lowest zoom level (z0)
   *
   * Used by the behavior pack to determine if it should send chunk data
   */
  app.get('/world/chunk/exists', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = chunkExistsQuerySchema.safeParse(request.query);

    if (!parseResult.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid query parameters',
        details: parseResult.error.issues,
      });
    }

    const { dimension, chunkX, chunkZ } = parseResult.data;
    const tileStorage = getTileStorageService();

    // Check if the tile exists at zoom level 0 (1 chunk = 1 tile)
    // At z0, chunk coordinates map directly to tile coordinates
    const exists = tileStorage.tileExists(dimension as Dimension, 0 as ZoomLevel, chunkX, chunkZ);

    request.log.debug({ dimension, chunkX, chunkZ, exists }, 'Chunk existence check');

    return reply.send({
      success: true,
      data: {
        exists,
        dimension,
        chunkX,
        chunkZ,
      },
    });
  });
}
