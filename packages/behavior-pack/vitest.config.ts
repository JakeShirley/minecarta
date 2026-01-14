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
});
