import type { WebSocket } from '@fastify/websocket';
import type {
    WebSocketEvent,
    PlayerJoinEvent,
    PlayerLeaveEvent,
    PlayerUpdateEvent,
    TileUpdateEvent,
    TileCoordinates,
    Player,
    ChatMessage,
    ChatMessageEvent,
    ChatHistoryEvent,
} from '@minecraft-map/shared';
import { WS_EVENTS } from '@minecraft-map/shared';
import { getChatHistoryService } from './chat-history.js';

/**
 * WebSocket service for managing real-time client connections and broadcasting events.
 *
 * This service maintains a set of connected WebSocket clients and provides
 * methods to broadcast various game events (player updates, tile changes, etc.)
 * to all connected clients.
 */
export class WebSocketService {
    private readonly clients: Set<WebSocket> = new Set();

    /**
     * Add a new WebSocket client connection
     */
    addClient(socket: WebSocket): void {
        this.clients.add(socket);

        socket.on('close', () => {
            this.clients.delete(socket);
        });

        socket.on('error', () => {
            this.clients.delete(socket);
        });
    }

    /**
     * Get the number of connected clients
     */
    getClientCount(): number {
        return this.clients.size;
    }

    /**
     * Broadcast an event to all connected clients
     */
    broadcast(event: WebSocketEvent): void {
        const message = JSON.stringify(event);

        for (const client of this.clients) {
            if (client.readyState === 1) {
                // WebSocket.OPEN
                client.send(message);
            }
        }
    }

    /**
     * Emit a player join event
     */
    emitPlayerJoin(player: Player): void {
        const event: PlayerJoinEvent = {
            type: WS_EVENTS.PLAYER_JOIN,
            timestamp: Date.now(),
            player,
        };
        this.broadcast(event);
    }

    /**
     * Emit a player leave event
     */
    emitPlayerLeave(playerName: string): void {
        const event: PlayerLeaveEvent = {
            type: WS_EVENTS.PLAYER_LEAVE,
            timestamp: Date.now(),
            playerName,
        };
        this.broadcast(event);
    }

    /**
     * Emit a player update event (position changes)
     */
    emitPlayerUpdate(players: Player[]): void {
        const event: PlayerUpdateEvent = {
            type: WS_EVENTS.PLAYER_UPDATE,
            timestamp: Date.now(),
            players,
        };
        this.broadcast(event);
    }

    /**
     * Emit a tile update event (tiles have been regenerated)
     */
    emitTileUpdate(tiles: TileCoordinates[]): void {
        if (tiles.length === 0) return;

        console.log(
            `[WebSocketService] Emitting tile:update for ${tiles.length} tiles to ${this.clients.size} clients:`,
            tiles.map(t => `${t.dimension}:z${t.zoom}:(${t.x},${t.z})`).join(', ')
        );

        const event: TileUpdateEvent = {
            type: WS_EVENTS.TILE_UPDATE,
            timestamp: Date.now(),
            tiles,
        };
        this.broadcast(event);
    }

    /**
     * Emit a chat message event
     */
    emitChatMessage(chat: ChatMessage): void {
        console.log(`[WebSocketService] Emitting chat:message from ${chat.playerName} to ${this.clients.size} clients`);

        // Add to chat history
        const chatHistoryService = getChatHistoryService();
        chatHistoryService.addMessage(chat);

        const event: ChatMessageEvent = {
            type: WS_EVENTS.CHAT_MESSAGE,
            timestamp: Date.now(),
            chat,
        };
        this.broadcast(event);
    }

    /**
     * Send chat history to a specific client
     */
    sendChatHistory(socket: WebSocket): void {
        const chatHistoryService = getChatHistoryService();
        const messages = chatHistoryService.getMessages();

        if (messages.length === 0) {
            return;
        }

        const event: ChatHistoryEvent = {
            type: WS_EVENTS.CHAT_HISTORY,
            timestamp: Date.now(),
            messages,
        };

        if (socket.readyState === 1) {
            socket.send(JSON.stringify(event));
            console.log(`[WebSocketService] Sent ${messages.length} chat history messages to client`);
        }
    }

    /**
     * Close all client connections
     */
    closeAll(): void {
        for (const client of this.clients) {
            client.close();
        }
        this.clients.clear();
    }
}

// Singleton instance
let _webSocketService: WebSocketService | null = null;

export function getWebSocketService(): WebSocketService {
    if (!_webSocketService) {
        _webSocketService = new WebSocketService();
    }
    return _webSocketService;
}
