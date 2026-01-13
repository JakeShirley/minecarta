/**
 * HTTP client wrapper for communicating with the map server
 */

import { http, HttpRequest, HttpRequestMethod, HttpHeader } from '@minecraft/server-net';
import { config, getApiUrl } from '../config';
import { AUTH_HEADER } from '@minecraft-map/shared';
import type { ApiResponse } from '../types';

/**
 * Queue of pending requests to handle rate limiting
 */
const requestQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = false;

/**
 * Process the request queue sequentially
 */
async function processQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (request) {
      try {
        await request();
      } catch (error) {
        logError('Queue processing error', error);
      }
    }
  }

  isProcessingQueue = false;
}

/**
 * Log debug messages if debug mode is enabled
 */
function logDebug(message: string, data?: unknown): void {
  if (config.debug) {
    console.log(`[MapSync] ${message}`, data ? JSON.stringify(data) : '');
  }
}

/**
 * Log error messages
 */
function logError(message: string, error?: unknown): void {
  console.error(`[MapSync Error] ${message}`, error);
}

/**
 * Create HTTP headers for API requests
 */
function createHeaders(): HttpHeader[] {
  return [
    new HttpHeader('Content-Type', 'application/json'),
    new HttpHeader(AUTH_HEADER, config.authToken),
  ];
}

/**
 * Send a POST request to the map server
 *
 * @param endpoint - API endpoint path
 * @param data - Data to send in the request body
 * @returns Promise resolving to the API response
 */
export async function postToServer<T>(
  endpoint: string,
  data: T
): Promise<ApiResponse> {
  const url = getApiUrl(endpoint);
  const body = JSON.stringify(data);

  logDebug(`POST ${endpoint}`, { dataSize: body.length });

  try {
    const request = new HttpRequest(url);
    request.method = HttpRequestMethod.Post;
    request.body = body;
    request.headers = createHeaders();

    const response = await http.request(request);

    if (response.status >= 200 && response.status < 300) {
      logDebug(`Response ${response.status} from ${endpoint}`);
      return { success: true };
    } else {
      logError(`HTTP ${response.status} from ${endpoint}`, response.body);
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.body}`,
      };
    }
  } catch (error) {
    logError(`Request failed: ${endpoint}`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Queue a POST request to be sent asynchronously
 * This helps prevent overwhelming the server with requests
 *
 * @param endpoint - API endpoint path
 * @param data - Data to send in the request body
 */
export function queuePost<T>(endpoint: string, data: T): void {
  requestQueue.push(async () => {
    await postToServer(endpoint, data);
  });
  processQueue();
}

/**
 * Send block changes to the server
 *
 * @param changes - Array of block changes to send
 */
export async function sendBlockChanges(
  changes: import('../types').BlockChange[]
): Promise<ApiResponse> {
  return postToServer('/api/v1/world/blocks', { changes });
}

/**
 * Send player positions to the server
 *
 * @param players - Array of player data to send
 */
export async function sendPlayerPositions(
  players: import('../types').Player[]
): Promise<ApiResponse> {
  return postToServer('/api/v1/players', { players });
}

/**
 * Send entity updates to the server
 *
 * @param entities - Array of entity data to send
 */
export async function sendEntityUpdates(
  entities: import('../types').Entity[]
): Promise<ApiResponse> {
  return postToServer('/api/v1/world/entities', { entities });
}

/**
 * Test connection to the map server
 *
 * @returns Promise resolving to true if server is reachable
 */
export async function testConnection(): Promise<boolean> {
  try {
    const url = getApiUrl('/api/v1/world/state');
    const request = new HttpRequest(url);
    request.method = HttpRequestMethod.Get;
    request.headers = createHeaders();

    const response = await http.request(request);
    const isConnected = response.status >= 200 && response.status < 300;

    logDebug(`Connection test: ${isConnected ? 'SUCCESS' : 'FAILED'}`, {
      status: response.status,
    });

    return isConnected;
  } catch (error) {
    logError('Connection test failed', error);
    return false;
  }
}
