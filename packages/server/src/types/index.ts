import type { FastifyInstance } from 'fastify';

/**
 * Server configuration options
 */
export interface ServerConfig {
  readonly port: number;
  readonly host: string;
  readonly authToken: string;
  readonly dataDir: string;
  readonly logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

/**
 * Fastify instance with typed decorations
 */
export type AppInstance = FastifyInstance;

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  readonly status: 'ok';
  readonly uptime: number;
  readonly timestamp: number;
}
