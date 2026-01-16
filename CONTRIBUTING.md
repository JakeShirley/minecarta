# Contributing to MineCarta

Thank you for your interest in contributing to this project! This guide will help you set up your development environment and understand our contribution workflow.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Building the Project](#building-the-project)
- [Running Tests](#running-tests)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0 (package manager)
- **Git**

### Installing pnpm

If you don't have pnpm installed, you can install it globally:

```bash
npm install -g pnpm
```

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/JakeShirley/map.git
cd map
```

### 2. Install Dependencies

Install all dependencies for all packages in the monorepo:

```bash
pnpm install
```

This will install dependencies for:

- Root workspace
- `@minecarta/shared` - Shared types and constants
- `@minecarta/behavior-pack` - Minecraft behavior pack
- `@minecarta/server` - Web server

### 3. Build All Packages

Build the entire project:

```bash
pnpm build
```

Or build individual packages:

```bash
# Build only the behavior pack
pnpm build:pack

# Build only the server
pnpm --filter @minecraft-map/server build
```

## Building the Project

### Full Build

```bash
pnpm build
```

This runs the build script for all packages in the workspace.

### Package-Specific Builds

| Command                                     | Description                       |
| ------------------------------------------- | --------------------------------- |
| `pnpm build`                                | Build all packages                |
| `pnpm build:pack`                           | Build the behavior pack only      |
| `pnpm build:pack:watch`                     | Build behavior pack in watch mode |
| `pnpm --filter @minecraft-map/server build` | Build the server only             |

### Watch Mode

For active development, you can run builds in watch mode:

```bash
# Behavior pack watch mode
pnpm build:pack:watch

# Server development mode (with hot reload)
pnpm dev:server
```

## Running Tests

### Run All Tests

```bash
pnpm test
```

### Package-Specific Tests

```bash
# Test behavior pack
pnpm test:pack

# Test server
pnpm --filter @minecraft-map/server test

# Watch mode for tests
pnpm --filter @minecraft-map/server test:watch
pnpm --filter @minecraft-map/behavior-pack test:watch
```

## Development Workflow

### Starting the Development Server

To run the map server in development mode with hot reload:

```bash
pnpm dev
```

The server will start at `http://localhost:3000` by default.

### Deploying the Behavior Pack

After building the behavior pack, deploy it to your Minecraft development folder:

```bash
# Build and deploy in one command
pnpm pack:build-deploy

# Or deploy only (if already built)
pnpm pack:deploy
```

The deploy script will copy the pack to:

- **Windows**: `%APPDATA%\Minecraft\development_behavior_packs\world-map-sync`
- **macOS**: `~/Library/Application Support/minecraft/development_behavior_packs/world-map-sync`

### Enabling the Behavior Pack in Minecraft

1. Open Minecraft Bedrock Edition
2. Create or edit a world
3. Go to **Behavior Packs** in world settings
4. Enable the **World Map Sync** pack
5. Enable **Beta APIs** experimental feature (required for HTTP functionality)

## Project Structure

```
map/
├── packages/
│   ├── behavior-pack/    # Minecraft Behavior Pack (TypeScript)
│   │   ├── src/          # Source code
│   │   ├── scripts/      # Compiled output (generated)
│   │   ├── __tests__/    # Unit tests
│   │   └── manifest.json # Pack manifest
│   │
│   ├── server/           # Web Server (Fastify)
│   │   ├── src/          # Source code
│   │   ├── public/       # Static files
│   │   ├── __tests__/    # Unit tests
│   │   └── dist/         # Compiled output (generated)
│   │
│   └── shared/           # Shared types & utilities
│       └── src/          # Source code
│
├── package.json          # Root workspace config
├── pnpm-workspace.yaml   # pnpm workspace definition
└── tsconfig.base.json    # Base TypeScript config
```

## Code Style

This project follows the conventions defined in [.github/copilot-instructions.md](.github/copilot-instructions.md). Key points:

### TypeScript Standards

- Use strict TypeScript configuration
- Prefer `interface` over `type` for object shapes
- Always explicitly type function parameters and return types
- Avoid `any` - use `unknown` when type is truly unknown

### Naming Conventions

- **Files**: `kebab-case.ts` for modules
- **Interfaces/Types/Classes**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`

### Testing

- Use Vitest as the test runner
- Follow AAA pattern: Arrange, Act, Assert
- Aim for 80%+ code coverage
- Colocate tests with source files or use `__tests__/` directories

## Submitting Changes

### Git Commit Messages

Follow conventional commits:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `test:` adding or updating tests
- `refactor:` code changes that neither fix bugs nor add features
- `chore:` maintenance tasks

Example:

```
feat: add player position tracking to behavior pack
```

### Pull Request Process

1. **Fork** the repository and create your branch from `main`
2. **Install** dependencies: `pnpm install`
3. **Make** your changes
4. **Test** your changes: `pnpm test`
5. **Build** to verify compilation: `pnpm build`
6. **Commit** with a descriptive message following conventional commits
7. **Push** to your fork and open a Pull Request

### PR Guidelines

- Keep PRs focused and small
- Include tests for new functionality
- Update documentation as needed
- Ensure all CI checks pass

## Environment Variables

When running the server, you can configure it with these environment variables:

| Variable     | Default     | Description                |
| ------------ | ----------- | -------------------------- |
| `PORT`       | `3000`      | Server port                |
| `HOST`       | `0.0.0.0`   | Server host                |
| `AUTH_TOKEN` | `dev-token` | Authentication token       |
| `DATA_DIR`   | `./data`    | Directory for tile storage |
| `LOG_LEVEL`  | `info`      | Log level                  |

## Troubleshooting

### pnpm not found

Make sure pnpm is installed globally:

```bash
npm install -g pnpm
```

### Build errors

Try cleaning and rebuilding:

```bash
pnpm clean
pnpm install
pnpm build
```

### Behavior pack not appearing in Minecraft

1. Ensure the pack is in the correct development folder
2. Check that `manifest.json` is valid
3. Verify Beta APIs experimental feature is enabled in your world

## Questions?

If you have questions or need help, please open an issue on GitHub.
