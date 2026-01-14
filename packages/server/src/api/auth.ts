import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AUTH_HEADER } from '@minecraft-map/shared';
import { getConfig } from '../config/index.js';

/**
 * Authentication hook for protected routes
 */
export async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const config = getConfig();
    const token = request.headers[AUTH_HEADER];

    if (!token || token !== config.authToken) {
        reply.code(401).send({
            success: false,
            error: 'Unauthorized: Invalid or missing auth token',
        });
    }
}

/**
 * Register authentication hook on a Fastify instance
 */
export function registerAuth(app: FastifyInstance): void {
    app.addHook('preHandler', authHook);
}
