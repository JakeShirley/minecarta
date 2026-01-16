import { createApp } from './app.js';
import { getConfig } from './config/index.js';
import { getTileStorageService } from './tiles/index.js';

async function main(): Promise<void> {
    const config = getConfig();

    // Initialize tile storage directory structure
    const tileStorage = getTileStorageService();
    tileStorage.initialize();

    // Create and start the server
    const app = await createApp(config);

    try {
        await app.listen({ port: config.port, host: config.host });
        app.log.info(`Server listening on http://${config.host}:${config.port}`);
        app.log.info(`Auth token: ${config.authToken === 'dev-token' ? 'dev-token (default)' : '(custom)'}`);
        app.log.info(`Data directory: ${config.dataDir}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

main();

