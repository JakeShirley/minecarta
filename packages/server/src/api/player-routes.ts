import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Dimension } from '@minecraft-map/shared';
import { getPlayerStateService } from '../services/index.js';

interface DimensionQuery {
  dimension?: Dimension;
}

/**
 * Register player query routes (public, no auth required)
 */
export async function registerPlayerRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /players - Get all players or filter by dimension
   */
  app.get('/players', async (request: FastifyRequest<{ Querystring: DimensionQuery }>, reply: FastifyReply) => {
    const playerService = getPlayerStateService();
    const { dimension } = request.query;

    const players = dimension
      ? playerService.getPlayersByDimension(dimension)
      : playerService.getAllPlayers();

    return reply.send({
      success: true,
      data: {
        players,
        count: players.length,
      },
    });
  });

  /**
   * GET /players/:name - Get a specific player
   */
  app.get('/players/:name', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    const playerService = getPlayerStateService();
    const player = playerService.getPlayer(request.params.name);

    if (!player) {
      return reply.code(404).send({
        success: false,
        error: 'Player not found',
      });
    }

    return reply.send({
      success: true,
      data: player,
    });
  });
}
