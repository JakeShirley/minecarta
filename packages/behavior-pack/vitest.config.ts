import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', '__tests__/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            exclude: ['node_modules', 'scripts', 'dist'],
        },
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
        teardownTimeout: 1000,
        watch: false,
    },
    resolve: {
        alias: {
            // Mock Minecraft modules for testing
            '@minecraft/server-admin': path.resolve(__dirname, '__mocks__/@minecraft/server-admin.ts'),
            '@minecraft/server': path.resolve(__dirname, '__mocks__/@minecraft/server.ts'),
            '@minecraft/server-net': path.resolve(__dirname, '__mocks__/@minecraft/server-net.ts'),
        },
    },
});
