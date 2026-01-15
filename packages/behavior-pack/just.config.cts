// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { argv, series, task } from 'just-scripts';
import {
    bundleTask,
    cleanTask,
    cleanCollateralTask,
    copyTask,
    DEFAULT_CLEAN_DIRECTORIES,
    setupEnvironment,
    STANDARD_CLEAN_PATHS,
    vitestTask,
} from '@minecraft/core-build-tasks';
import path from 'path';

// Load environment variables from .env file
setupEnvironment(path.resolve(__dirname, '.env'));

// Bundle configuration
const bundleParams = {
    entryPoint: './src/index.ts',
    outfile: './scripts/index.js',
    external: ['@minecraft/server', '@minecraft/server-admin', '@minecraft/server-net'],
    sourcemap: 'inline',
};

// Deployment configuration
const copyParams = {
    copyToBehaviorPacks: ['./manifest.json'],
    copyToScripts: ['./scripts/index.js'],
};

// Clean
task('clean', cleanTask([...DEFAULT_CLEAN_DIRECTORIES, 'scripts']));
task('clean:deploy', cleanCollateralTask(STANDARD_CLEAN_PATHS));

// Build
task('bundle', bundleTask(bundleParams));
task('build', series('bundle'));

// Deploy - copies files to Minecraft development_behavior_packs
task('deploy', copyTask(copyParams));
task('build:deploy', series('build', 'deploy'));

// Watch - rebuilds on file changes (for development)
task('watch', bundleTask({ ...bundleParams }));

// Test
task('vitest', vitestTask({ test: argv().test, update: argv().update, run: true }));
task('test', series('vitest'));
