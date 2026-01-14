import type { FastifyInstance } from 'fastify';
import { getWebSocketService } from '../services/index.js';

/**
 * Register WebSocket routes for real-time updates
 *
 * Clients connect to /ws to receive events:
 * - player:join - A player joined the server
 * - player:leave - A player left the server
 * - player:update - Player positions updated
 * - tile:update - Map tiles were regenerated
 */
export async function registerWebSocketRoutes(app: FastifyInstance): Promise<void> {
    app.get('/ws', { websocket: true }, (socket, _request) => {
        const wsService = getWebSocketService();
        wsService.addClient(socket);

        app.log.info({ clients: wsService.getClientCount() }, 'WebSocket client connected');

        socket.on('close', () => {
            app.log.info({ clients: wsService.getClientCount() }, 'WebSocket client disconnected');
        });

        // Send a welcome message
        socket.send(
            JSON.stringify({
                type: 'connection:established',
                timestamp: Date.now(),
                message: 'Connected to Minecraft Map WebSocket',
            })
        );
    });
}
