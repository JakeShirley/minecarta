import type { ChatMessage } from '@minecarta/shared';

/**
 * Default maximum number of messages to keep in history
 */
const DEFAULT_MAX_HISTORY = 20;

/**
 * Service for caching recent chat messages.
 *
 * This service maintains a circular buffer of recent chat messages
 * that can be sent to clients when they connect.
 */
export class ChatHistoryService {
    private readonly messages: ChatMessage[] = [];
    private readonly maxHistory: number;

    constructor(maxHistory: number = DEFAULT_MAX_HISTORY) {
        this.maxHistory = maxHistory;
    }

    /**
     * Add a message to the history
     */
    addMessage(message: ChatMessage): void {
        this.messages.push(message);

        // Trim to max history size
        if (this.messages.length > this.maxHistory) {
            this.messages.shift();
        }
    }

    /**
     * Get all messages in history (oldest first)
     */
    getMessages(): readonly ChatMessage[] {
        return [...this.messages];
    }

    /**
     * Get the number of messages in history
     */
    getMessageCount(): number {
        return this.messages.length;
    }

    /**
     * Clear all messages from history
     */
    clear(): void {
        this.messages.length = 0;
    }
}

// Singleton instance
let _chatHistoryService: ChatHistoryService | null = null;

/**
 * Get the singleton ChatHistoryService instance
 */
export function getChatHistoryService(): ChatHistoryService {
    if (!_chatHistoryService) {
        _chatHistoryService = new ChatHistoryService();
    }
    return _chatHistoryService;
}

