# @minecraft-map/behavior-pack

Minecraft Behavior Pack that monitors world state and sends data to the map web server.

## Features

- Monitors block place/break events
- Tracks player positions
- Tracks entity positions
- Sends real-time updates to the map server via HTTP

## Installation

### For Development

1. Configure deployment environment:

    ```bash
    cp .env.example .env
    # Edit .env with your settings
    ```

2. Build the pack:

    ```bash
    pnpm build
    ```

3. Deploy to Minecraft:
    ```bash
    pnpm deploy
    ```
    Or build and deploy in one step:
    ```bash
    pnpm build:deploy
    ```

The deployment uses `@minecraft/core-build-tasks` to automatically copy files to your Minecraft `development_behavior_packs` folder based on your `.env` configuration.

### Required Experimental Features

This pack requires the following experimental features to be enabled in your world:

- **Beta APIs** - Required for `@minecraft/server-net` HTTP functionality

## Configuration

### Build Environment (.env)

Copy `.env.example` to `.env` and configure:

| Variable                 | Description                                                               |
| ------------------------ | ------------------------------------------------------------------------- |
| `PROJECT_NAME`           | Folder name in development_behavior_packs (default: `world-map-sync`)     |
| `MINECRAFT_PRODUCT`      | Target Minecraft version (`BedrockUWP`, `PreviewUWP`, `BedrockGDK`, etc.) |
| `CUSTOM_DEPLOYMENT_PATH` | Custom path when using `MINECRAFT_PRODUCT=Custom`                         |

### Runtime Configuration

The pack loads configuration from the `@minecraft/server-admin` module when running on Bedrock Dedicated Server (BDS). This allows you to configure the pack without modifying code.

#### Server Variables (variables.json)

Create a `variables.json` file in your BDS `config` directory:

```json
{
    "serverUrl": "http://your-map-server:3000",
    "playerUpdateInterval": 20,
    "timeSyncInterval": 1200,
    "logLevel": "warning",
    "sendPlayerStats": true
}
```

#### Server Secrets (secrets.json)

Create a `secrets.json` file in your BDS `config` directory for sensitive values:

```json
{
    "authToken": "your-secure-auth-token"
}
```

#### Configuration Options

| Setting                | Source    | Required | Description                                                    | Default   |
| ---------------------- | --------- | -------- | -------------------------------------------------------------- | --------- |
| `serverUrl`            | variables | **Yes**  | Base URL of the map server                                     | -         |
| `authToken`            | secrets   | **Yes**  | Authentication token for server communication                  | -         |
| `playerUpdateInterval` | variables | No       | Interval in ticks between player position updates (20 = 1 sec) | `20`      |
| `timeSyncInterval`     | variables | No       | Interval in ticks between world time syncs                     | `1200`    |
| `logLevel`             | variables | No       | Log level (debug, info, warning, error, none)                  | `warning` |
| `sendPlayerStats`      | variables | No       | Whether to send player stats (health, hunger, armor)           | `true`    |

> **Important:** The pack will fail to start if `serverUrl` or `authToken` are not configured. Make sure to set up these required values before starting BDS.

#### Quick Setup Script

The behavior pack includes a PowerShell utility script to quickly set up the configuration files and register the pack with all worlds. After deploying the pack to BDS, run:

```powershell
# From within the deployed behavior pack directory:
.\utilities\Setup-BdsConfig.ps1 -ServerUrl "http://myserver:3000" -AuthToken "my-secret-token"

# Overwrite existing files without prompting:
.\utilities\Setup-BdsConfig.ps1 -ServerUrl "http://myserver:3000" -AuthToken "my-secret-token" -Force
```

The script automatically:
- Detects the BDS root directory
- Creates the config files in the correct location (`config/<pack-uuid>/`)
- Registers the behavior pack in `world_behavior_packs.json` for all worlds in the BDS worlds directory

**Script Parameters:**

| Parameter               | Required | Description                                       | Default   |
| ----------------------- | -------- | ------------------------------------------------- | --------- |
| `-ServerUrl`            | **Yes**  | URL of the MineCarta map server                   | -         |
| `-AuthToken`            | **Yes**  | Authentication token for server communication    | -         |
| `-PlayerUpdateInterval` | No       | Interval in ticks between player position updates | `20`      |
| `-TimeSyncInterval`     | No       | Interval in ticks between world time syncs        | `1200`    |
| `-LogLevel`             | No       | Log level (debug, info, warning, error, none)     | `warning` |
| `-SendPlayerStats`      | No       | Whether to send player stats                      | `$true`   |
| `-Force`                | No       | Overwrite existing files without prompting        | `$false`  |

### Log Levels

The `logLevel` setting controls which messages are displayed in the console:

- **Debug** - Most verbose, includes detailed debugging information
- **Info** - General informational messages (initialization, events)
- **Warning** - Warning messages for potentially problematic situations
- **Error** - Error messages for failures and exceptions
- **None** - No logging at all

## API Dependencies

- `@minecraft/server` v1.16.0+
- `@minecraft/server-net` v1.0.0-beta

## Project Structure

```
behavior-pack/
├── manifest.json             # Behavior pack manifest
├── pack_icon.png             # Pack icon (optional)
├── just.config.cts           # Build task configuration
├── .env                      # Local deployment settings (gitignored)
├── .env.example              # Example environment configuration
├── scripts/                  # Compiled JavaScript (build output)
│   └── index.js
├── utilities/                # Utility scripts for BDS setup
│   └── Setup-BdsConfig.ps1   # BDS configuration setup script
├── src/                      # TypeScript source
│   ├── index.ts              # Entry point
│   ├── blocks/               # Block scanning and color utilities
│   ├── chunk-queue/          # Chunk generation job queue
│   ├── commands/             # Custom commands
│   ├── config/               # Configuration
│   ├── events/               # World event listeners
│   ├── logging/              # Centralized logging
│   ├── network/              # HTTP client wrapper
│   ├── serializers/          # Data transformation
│   └── types/                # Type definitions
├── __tests__/                # Unit tests
└── __mocks__/                # Mock modules for testing
```

## Development

### Build

```bash
pnpm build
```

### Watch mode

```bash
pnpm build:watch
```

### Deploy to Minecraft

```bash
pnpm deploy
```

### Build and Deploy

```bash
pnpm build:deploy
```

### Clean build outputs

```bash
pnpm clean
```

### Clean deployed files from Minecraft

```bash
pnpm clean:deploy
```

### Run tests

```bash
pnpm test
```

## Events Monitored

| Event         | Description                    |
| ------------- | ------------------------------ |
| `blockPlace`  | When a player places a block   |
| `blockBreak`  | When a player breaks a block   |
| `playerJoin`  | When a player joins the world  |
| `playerLeave` | When a player leaves the world |
| `playerSpawn` | When a player spawns           |

## Commands

The behavior pack registers custom commands for map operations:

### `/mapsync:scan`

Queue a block range for tile generation.

```
/mapsync:scan <min> <max>
```

| Parameter | Type     | Description                |
| --------- | -------- | -------------------------- |
| `min`     | Location | Minimum corner coordinates |
| `max`     | Location | Maximum corner coordinates |

### `/mapsync:autogen`

Toggle automatic tile generation around the player. When enabled, the pack will periodically queue chunks within the specified radius around the player for generation.

```
/mapsync:autogen [radius] [interval]
```

| Parameter  | Type               | Description                                   |
| ---------- | ------------------ | --------------------------------------------- |
| `radius`   | Integer (optional) | Radius in blocks (16-256, default: 64)        |
| `interval` | Integer (optional) | Scan interval in seconds (1-300, default: 10) |

**Usage:**

- `/mapsync:autogen` - Toggle off or show status
- `/mapsync:autogen 64 10` - Enable with 64-block radius, scanning every 10 seconds
- `/mapsync:autogen 128 30` - Enable with 128-block radius, scanning every 30 seconds

### `/mapsync:queue`

Manage the chunk generation queue.

```
/mapsync:queue [action]
```

| Parameter | Type              | Description                                    |
| --------- | ----------------- | ---------------------------------------------- |
| `action`  | String (optional) | `clear` to clear queue, `resort` to re-sort it |

**Usage:**

- `/mapsync:queue` - Show queue statistics
- `/mapsync:queue clear` - Clear all pending jobs
- `/mapsync:queue resort` - Re-sort queue based on player positions

## Data Flow

```
Minecraft World Events
        │
        ▼
  Event Listeners (events/)
        │
        ▼
  Chunk Generation Queue (chunk-queue/)
        │
        ▼
  Data Serialization (serializers/)
        │
        ▼
  HTTP Client (network/)
        │
        ▼
  Map Web Server
```

## Chunk Generation Queue

All chunk generation work goes through a centralized job queue system that provides:

### Priority Levels

Jobs are processed in priority order:

| Priority    | Use Case                                |
| ----------- | --------------------------------------- |
| `Immediate` | Player interactions (block place/break) |
| `High`      | Player's current chunk                  |
| `Normal`    | Chunks near players, manual scans       |
| `Low`       | Background generation (auto-gen)        |

### Queue Re-sorting

The queue automatically re-sorts based on player positions:

- Jobs closer to players get higher priority within their level
- Jobs within 2 chunks of a player are upgraded to `High` priority
- Jobs within 5 chunks are upgraded to `Normal` priority
- Re-sorting happens on each player position update

### Deduplication

Duplicate chunk requests are automatically merged. If a chunk is already queued, subsequent requests only upgrade its priority if the new request has higher priority.

### Chunk Loading with Ticking Areas

For jobs with priority `High`, `Normal`, or `Low`, the queue processor creates a temporary **ticking area** to force-load the chunk before scanning. This ensures that chunks not currently loaded by players can still be scanned for map generation.

- `Immediate` priority jobs (player interactions) skip ticking areas since the chunk is already loaded
- Ticking areas are automatically cleaned up after each job completes
- One job is processed at a time to avoid exceeding ticking area limits

### Rate Limiting

The queue processor limits how many chunks are processed per game tick to avoid server lag, with configurable batch sizes for network requests.

## Automatic Chunk Generation

In addition to the manual `/mapsync:autogen` command, the behavior pack includes **automatic chunk generation** based on player movement:

1. **On each player position update** (every ~1 second by default), the pack checks if the player's current chunk exists on the map server
2. **The server checks** if a tile exists at zoom level 0 (where 1 chunk = 1 tile) for the chunk coordinates
3. **If the tile doesn't exist**, the chunk is added to the generation queue with `High` priority
4. **A cache** prevents repeated checks for the same chunk (1 minute TTL)
5. **The queue processor** handles the actual scanning and sending to the server

This ensures that as players explore the world, the map is automatically populated without requiring manual commands, while the queue system prevents overwhelming the game or server during heavy exploration.
