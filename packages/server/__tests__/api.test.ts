import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../src/app.js';
import { resetConfig } from '../src/config/index.js';
import { getPlayerStateService, getEntityStateService } from '../src/services/index.js';
import type { ServerConfig } from '../src/types/index.js';

describe('API Integration', () => {
    let app: FastifyInstance;

    const testConfig: ServerConfig = {
        port: 3001,
        host: '127.0.0.1',
        authToken: 'test-token',
        dataDir: './test-data',
        logLevel: 'error',
    };

    beforeAll(async () => {
        app = await createApp(testConfig);
    });

    afterAll(async () => {
        await app.close();
        resetConfig();
    });

    afterEach(() => {
        // Clear state between tests
        getPlayerStateService().clear();
        getEntityStateService().clear();
    });

    describe('GET /health', () => {
        it('should return health status', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/health',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.status).toBe('ok');
            expect(body.uptime).toBeTypeOf('number');
            expect(body.timestamp).toBeTypeOf('number');
        });
    });

    describe('POST /api/v1/world/players', () => {
        it('should reject requests without auth token', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/world/players',
                payload: { players: [] },
            });

            expect(response.statusCode).toBe(401);
        });

        it('should accept requests with valid auth token', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/world/players',
                headers: {
                    'x-mc-auth-token': 'test-token',
                },
                payload: {
                    players: [
                        {
                            name: 'TestPlayer',
                            x: 100,
                            y: 64,
                            z: 200,
                            dimension: 'overworld',
                        },
                    ],
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.success).toBe(true);
            expect(body.data.updated).toBe(1);
        });

        it('should reject invalid payload', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/world/players',
                headers: {
                    'x-mc-auth-token': 'test-token',
                },
                payload: {
                    players: [{ invalid: 'data' }],
                },
            });

            expect(response.statusCode).toBe(400);
        });
    });

    describe('GET /api/v1/players', () => {
        it('should return players without auth', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/players',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data.players)).toBe(true);
        });
    });

    describe('POST /api/v1/world/blocks', () => {
        it('should accept block changes', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/world/blocks',
                headers: {
                    'x-mc-auth-token': 'test-token',
                },
                payload: {
                    blocks: [
                        {
                            dimension: 'overworld',
                            x: 100,
                            y: 64,
                            z: 200,
                            blockType: 'minecraft:stone',
                            previousType: 'minecraft:air',
                        },
                    ],
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.success).toBe(true);
        });
    });

    describe('GET /api/v1/world/state', () => {
        it('should return world state with auth', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/world/state',
                headers: {
                    'x-mc-auth-token': 'test-token',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.success).toBe(true);
            expect(body.data.players).toBeDefined();
            expect(body.data.entities).toBeDefined();
            expect(body.data.lastUpdated).toBeTypeOf('number');
        });
    });
});
