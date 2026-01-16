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
    WorldSpawn,
    PlayerSpawn,
    WorldSpawnUpdateEvent,
    PlayerSpawnUpdateEvent,
    SpawnsStateEvent,
    WorldTime,
    WorldTimeUpdateEvent,
    WorldTimeStateEvent,
    WorldWeather,
    WorldWeatherUpdateEvent,
    WorldWeatherStateEvent,
} from '@minecarta/shared';
import { WS_EVENTS } from '@minecarta/shared';
import { getChatHistoryService } from './chat-history.js';
import { getSpawnStateService } from './spawn-state.js';
import { getTimeStateService } from './time-state.js';
import { getWeatherStateService } from './weather-state.js';

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
     * Emit a world spawn update event
     */
    emitWorldSpawnUpdate(spawn: WorldSpawn): void {
        console.log(`[WebSocketService] Emitting spawn:world to ${this.clients.size} clients`);

        const event: WorldSpawnUpdateEvent = {
            type: WS_EVENTS.SPAWN_WORLD,
            timestamp: Date.now(),
            spawn,
        };
        this.broadcast(event);
    }

    /**
     * Emit a player spawn update event
     */
    emitPlayerSpawnUpdate(spawn: PlayerSpawn): void {
        console.log(`[WebSocketService] Emitting spawn:player for ${spawn.playerName} to ${this.clients.size} clients`);

        const event: PlayerSpawnUpdateEvent = {
            type: WS_EVENTS.SPAWN_PLAYER,
            timestamp: Date.now(),
            spawn,
        };
        this.broadcast(event);
    }

    /**
     * Send current spawn state to a specific client
     */
    sendSpawnState(socket: WebSocket): void {
        const spawnStateService = getSpawnStateService();
        const worldSpawn = spawnStateService.getWorldSpawn();
        const playerSpawns = spawnStateService.getAllPlayerSpawns();

        const event: SpawnsStateEvent = {
            type: WS_EVENTS.SPAWN_STATE,
            timestamp: Date.now(),
            worldSpawn,
            playerSpawns,
        };

        if (socket.readyState === 1) {
            socket.send(JSON.stringify(event));
            console.log(
                `[WebSocketService] Sent spawn state to client (world: ${worldSpawn ? 'yes' : 'no'}, players: ${playerSpawns.length})`
            );
        }
    }

    /**
     * Emit a world time update event
     */
    emitTimeUpdate(time: WorldTime): void {
        // Only log occasionally to avoid spam (time updates can be frequent for prediction)
        const event: WorldTimeUpdateEvent = {
            type: WS_EVENTS.TIME_UPDATE,
            timestamp: Date.now(),
            time,
        };
        this.broadcast(event);
    }

    /**
     * Send current time state to a specific client
     */
    sendTimeState(socket: WebSocket): void {
        const timeStateService = getTimeStateService();
        const time = timeStateService.getTime();

        const event: WorldTimeStateEvent = {
            type: WS_EVENTS.TIME_STATE,
            timestamp: Date.now(),
            time,
        };

        if (socket.readyState === 1) {
            socket.send(JSON.stringify(event));
            if (time) {
                console.log(
                    `[WebSocketService] Sent time state to client (day: ${time.day}, timeOfDay: ${time.timeOfDay})`
                );
            }
        }
    }

    /**
     * Emit a world weather update event
     */
    emitWeatherUpdate(weather: WorldWeather): void {
        console.log(`[WebSocketService] Emitting weather:update (${weather.weather}) to ${this.clients.size} clients`);

        const event: WorldWeatherUpdateEvent = {
            type: WS_EVENTS.WEATHER_UPDATE,
            timestamp: Date.now(),
            weather,
        };
        this.broadcast(event);
    }

    /**
     * Send current weather state to a specific client
     */
    sendWeatherState(socket: WebSocket): void {
        const weatherStateService = getWeatherStateService();
        const weather = weatherStateService.getWeather();

        const event: WorldWeatherStateEvent = {
            type: WS_EVENTS.WEATHER_STATE,
            timestamp: Date.now(),
            weather,
        };

        if (socket.readyState === 1) {
            socket.send(JSON.stringify(event));
            if (weather) {
                console.log(`[WebSocketService] Sent weather state to client (${weather.weather})`);
            }
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

