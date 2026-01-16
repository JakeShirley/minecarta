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
 * - chat:message - A chat message was sent
 * - chat:history - Recent chat history (sent on connection)
 * - spawn:world - World spawn location updated
 * - spawn:player - Player spawn point updated
 * - spawn:state - All spawn locations (sent on connection)
 * - time:update - World time updated
 * - time:state - Current world time (sent on connection)
 * - weather:update - World weather updated
 * - weather:state - Current world weather (sent on connection)
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

        // Send chat history to the new client
        wsService.sendChatHistory(socket);

        // Send spawn state to the new client
        wsService.sendSpawnState(socket);

        // Send time state to the new client
        wsService.sendTimeState(socket);

        // Send weather state to the new client
        wsService.sendWeatherState(socket);
    });
}

