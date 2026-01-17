import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
    getPlayerStateService,
    getEntityStateService,
    getTileUpdateService,
    getWebSocketService,
    getSpawnStateService,
    getTimeStateService,
    getWeatherStateService,
} from '../services/index.js';
import { getTileStorageService } from '../tiles/tile-storage.js';
import { registerAuth } from './auth.js';
import {
    playersBatchUpdateSchema,
    playerJoinSchema,
    playerLeaveSchema,
    blocksBatchUpdateSchema,
    entitiesBatchUpdateSchema,
    chunksBatchUpdateSchema,
    chunkExistsQuerySchema,
    chatMessageSchema,
    worldSpawnSchema,
    playerSpawnSchema,
    worldTimeSchema,
    worldWeatherSchema,
    clientConnectSchema,
} from './schemas.js';
import { PROTOCOL_VERSION } from '@minecarta/shared';
import type { Dimension, ZoomLevel, Player } from '@minecarta/shared';

/**
 * Register world data ingestion routes
 *
 * These routes receive data from the Minecraft behavior pack
 */
export async function registerWorldRoutes(app: FastifyInstance): Promise<void> {
    // Apply authentication to all routes in this plugin
    registerAuth(app);

    /**
     * POST /world/connect - Client connection handshake with version check
     *
     * Called by the behavior pack on startup to verify protocol version compatibility.
     * If versions don't match, a warning is logged but the connection proceeds.
     */
    app.post('/world/connect', async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = clientConnectSchema.safeParse(request.body);

        if (!parseResult.success) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid request body',
                details: parseResult.error.issues,
            });
        }

        const { protocolVersion: behaviorPackVersion } = parseResult.data;
        const serverVersion = PROTOCOL_VERSION;
        const versionsMatch = behaviorPackVersion === serverVersion;

        if (!versionsMatch) {
            request.log.warn(
                { behaviorPackVersion, serverVersion },
                'Protocol version mismatch with connecting game server. Compatibility is not guaranteed.'
            );
        } else {
            request.log.info({ version: serverVersion }, 'Game server connected with matching protocol version');
        }

        return reply.send({
            success: true,
            data: {
                protocolVersion: serverVersion,
                compatible: versionsMatch,
            },
        });
    });

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
        const wsService = getWebSocketService();

        const updatedPlayers: Player[] = [];
        for (const player of players) {
            const updatedPlayer = playerService.updatePlayer(player);
            updatedPlayers.push(updatedPlayer);
        }

        // Emit player update event to WebSocket clients
        if (updatedPlayers.length > 0) {
            wsService.emitPlayerUpdate(updatedPlayers);
        }

        request.log.info({ count: players.length }, 'Updated player positions');

        return reply.send({
            success: true,
            data: { updated: players.length },
        });
    });

    /**
     * POST /world/player/join - Notify when a player joins
     */
    app.post('/world/player/join', async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = playerJoinSchema.safeParse(request.body);

        if (!parseResult.success) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid request body',
                details: parseResult.error.issues,
            });
        }

        const playerData = parseResult.data;
        const playerService = getPlayerStateService();
        const wsService = getWebSocketService();

        const player = playerService.updatePlayer(playerData);

        // Emit player join event to WebSocket clients
        wsService.emitPlayerJoin(player);

        request.log.info({ player: player.name }, 'Player joined');

        return reply.send({
            success: true,
            data: { player: player.name },
        });
    });

    /**
     * POST /world/player/leave - Notify when a player leaves
     */
    app.post('/world/player/leave', async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = playerLeaveSchema.safeParse(request.body);

        if (!parseResult.success) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid request body',
                details: parseResult.error.issues,
            });
        }

        const { name } = parseResult.data;
        const playerService = getPlayerStateService();
        const wsService = getWebSocketService();

        const removed = playerService.removePlayer(name);

        // Emit player leave event to WebSocket clients
        wsService.emitPlayerLeave(name);

        request.log.info({ player: name, removed }, 'Player left');

        return reply.send({
            success: true,
            data: { player: name, removed },
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
     * POST /world/chat - Receive chat messages
     */
    app.post('/world/chat', async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = chatMessageSchema.safeParse(request.body);

        if (!parseResult.success) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid request body',
                details: parseResult.error.issues,
            });
        }

        const chatMessage = parseResult.data;
        const wsService = getWebSocketService();

        // Emit chat message event to WebSocket clients
        wsService.emitChatMessage({
            playerName: chatMessage.playerName,
            message: chatMessage.message,
            dimension: chatMessage.dimension,
            timestamp: chatMessage.timestamp,
        });

        request.log.info({ player: chatMessage.playerName }, 'Received chat message');

        return reply.send({
            success: true,
            data: { received: true },
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

    /**
     * POST /world/spawn/world - Receive world spawn location
     */
    app.post('/world/spawn/world', async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = worldSpawnSchema.safeParse(request.body);

        if (!parseResult.success) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid request body',
                details: parseResult.error.issues,
            });
        }

        const spawnData = parseResult.data;
        const spawnService = getSpawnStateService();
        const wsService = getWebSocketService();

        const spawn = spawnService.updateWorldSpawn(spawnData);

        // Emit world spawn update to WebSocket clients
        wsService.emitWorldSpawnUpdate(spawn);

        request.log.info({ spawn }, 'Updated world spawn location');

        return reply.send({
            success: true,
            data: { spawn },
        });
    });

    /**
     * POST /world/spawn/player - Receive player spawn point (bed location)
     */
    app.post('/world/spawn/player', async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = playerSpawnSchema.safeParse(request.body);

        if (!parseResult.success) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid request body',
                details: parseResult.error.issues,
            });
        }

        const spawnData = parseResult.data;
        const spawnService = getSpawnStateService();
        const wsService = getWebSocketService();

        const spawn = spawnService.updatePlayerSpawn(spawnData);

        // Emit player spawn update to WebSocket clients
        wsService.emitPlayerSpawnUpdate(spawn);

        request.log.info({ player: spawnData.playerName }, 'Updated player spawn point');

        return reply.send({
            success: true,
            data: { spawn },
        });
    });

    /**
     * POST /world/time - Receive world time update
     *
     * The behavior pack sends time updates periodically (about once per minute)
     * or when time changes significantly (e.g., due to /time set command).
     */
    app.post('/world/time', async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = worldTimeSchema.safeParse(request.body);

        if (!parseResult.success) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid request body',
                details: parseResult.error.issues,
            });
        }

        const timeData = parseResult.data;
        const timeService = getTimeStateService();
        const wsService = getWebSocketService();

        const time = timeService.updateTime(timeData);

        // Emit time update to WebSocket clients
        wsService.emitTimeUpdate(time);

        request.log.debug({ timeOfDay: time.timeOfDay, day: time.day }, 'Updated world time');

        return reply.send({
            success: true,
            data: { time },
        });
    });

    /**
     * POST /world/weather - Receive world weather update
     *
     * The behavior pack sends weather updates when weather changes
     * (e.g., due to natural weather cycle or /weather command).
     */
    app.post('/world/weather', async (request: FastifyRequest, reply: FastifyReply) => {
        const parseResult = worldWeatherSchema.safeParse(request.body);

        if (!parseResult.success) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid request body',
                details: parseResult.error.issues,
            });
        }

        const weatherData = parseResult.data;
        const weatherService = getWeatherStateService();
        const wsService = getWebSocketService();

        const weather = weatherService.updateWeather(weatherData);

        // Emit weather update to WebSocket clients
        wsService.emitWeatherUpdate(weather);

        request.log.info({ weather: weather.weather }, 'Updated world weather');

        return reply.send({
            success: true,
            data: { weather },
        });
    });
}
