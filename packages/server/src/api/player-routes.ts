import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Dimension } from '@minecarta/shared';
import { getPlayerStateService, getSpawnStateService } from '../services/index.js';

interface DimensionQuery {
    dimension?: Dimension;
}

const MINECRAFT_HEAD_API = 'https://persona-secondary.franchise.minecraft-services.net/api/v1.0/profile/pfid';

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

        const players = dimension ? playerService.getPlayersByDimension(dimension) : playerService.getAllPlayers();

        return reply.send({
            success: true,
            data: {
                players,
                count: players.length,
            },
        });
    });

    /**
     * GET /players/head/:playfabId - Proxy player head texture to avoid CORS issues
     */
    app.get(
        '/players/head/:playfabId',
        async (request: FastifyRequest<{ Params: { playfabId: string } }>, reply: FastifyReply) => {
            const { playfabId } = request.params;

            try {
                const response = await fetch(`${MINECRAFT_HEAD_API}/${playfabId}/image/head`);

                if (!response.ok) {
                    return reply.code(response.status).send({
                        success: false,
                        error: 'Failed to fetch player head',
                    });
                }

                const contentType = response.headers.get('content-type') || 'image/png';
                const buffer = await response.arrayBuffer();

                return reply.type(contentType).send(Buffer.from(buffer));
            } catch (error) {
                request.log.error({ error, playfabId }, 'Failed to fetch player head');
                return reply.code(500).send({
                    success: false,
                    error: 'Failed to fetch player head',
                });
            }
        }
    );

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

    /**
     * GET /spawns - Get all spawn locations (world spawn and player spawns)
     */
    app.get('/spawns', async (request: FastifyRequest<{ Querystring: DimensionQuery }>, reply: FastifyReply) => {
        const spawnService = getSpawnStateService();
        const { dimension } = request.query;

        const worldSpawn = spawnService.getWorldSpawn();
        const playerSpawns = dimension
            ? spawnService.getPlayerSpawnsByDimension(dimension)
            : spawnService.getAllPlayerSpawns();

        return reply.send({
            success: true,
            data: {
                worldSpawn,
                playerSpawns,
                playerSpawnCount: playerSpawns.length,
            },
        });
    });
}

