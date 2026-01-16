# GitHub Copilot Instructions

## Project Overview

This is a TypeScript project following modern best practices with comprehensive testing.

## Developer Best Practices

### README.md

If the project/directory you are working in contains a README.md file, ensure that any significant changes you make are reflected in the documentation. This includes updating usage instructions, adding new sections for features, and modifying existing content to stay accurate.

## Code Style & Conventions

### Formatting

- Use Prettier for code formatting. You can invoke formatting of the entire project with `pnpm format`.

### TypeScript Standards

- Use strict TypeScript configuration (`"strict": true`)
- Prefer `interface` over `type` for object shapes that can be extended
- Use `type` for unions, intersections, and mapped types
- Always explicitly type function parameters and return types
- Avoid `any` - use `unknown` when type is truly unknown
- Use `readonly` for immutable properties
- Prefer `const` assertions for literal types
- Prefer enum types instead of union of string literals when appropriate
- Don't use in-line imports, use top-level imports instead

### Naming Conventions

- **Files**: `kebab-case.ts` for modules, `PascalCase.ts` for classes/components
- **Interfaces**: `PascalCase` with descriptive names (no `I` prefix)
- **Types**: `PascalCase`
- **Classes**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE` for true constants, `camelCase` for const references
- **Enums**: `PascalCase` for enum name, `PascalCase` for members

### Code Organization

```
src/
├── index.ts              # Main entry point
├── types/                # Shared type definitions
│   └── index.ts
├── utils/                # Utility functions
│   └── index.ts
├── services/             # Business logic and external integrations
│   └── index.ts
├── models/               # Data models and entities
│   └── index.ts
└── __tests__/            # Test files (or colocated *.test.ts)
```

## Testing Requirements

### Test Structure

- Use Vitest as the test runner
- Colocate tests with source files (`*.test.ts`) or use `__tests__/` directories
- Follow the AAA pattern: Arrange, Act, Assert
- Use descriptive test names that explain the expected behavior

### Test Coverage

- Aim for 80%+ code coverage
- All public APIs must have tests
- Test edge cases and error conditions
- Include integration tests for critical paths

### Test Patterns

```typescript
describe('FunctionName', () => {
    describe('when [condition]', () => {
        it('should [expected behavior]', () => {
            // Arrange
            const input = createTestInput();

            // Act
            const result = functionName(input);

            // Assert
            expect(result).toEqual(expectedOutput);
        });
    });
});
```

### Mocking Guidelines

- Prefer dependency injection over mocking
- Use `vi.mock()` sparingly
- Create factory functions for test data
- Use `faker` or similar for generating test data

## Error Handling

- Use custom error classes extending `Error`
- Always include meaningful error messages
- Use Result types for expected failures (consider `neverthrow` or similar)
- Let unexpected errors bubble up with proper logging

```typescript
export class ValidationError extends Error {
    constructor(
        message: string,
        public readonly field: string,
        public readonly code: string
    ) {
        super(message);
        this.name = 'ValidationError';
    }
}
```

## Async/Await Patterns

- Always use `async/await` over raw Promises
- Handle errors with try/catch at appropriate boundaries
- Use `Promise.all()` for parallel operations
- Use `Promise.allSettled()` when partial failures are acceptable

## Import/Export Guidelines

- Use named exports over default exports
- Group imports: external, internal, types
- Use barrel files (`index.ts`) for public APIs
- Avoid circular dependencies

```typescript
// External imports
import { z } from 'zod';

// Internal imports
import { validateInput } from './utils';
import { UserService } from './services';

// Type imports
import type { User, Config } from './types';
```

## Documentation

- Use JSDoc for public APIs
- Include `@param`, `@returns`, and `@throws` tags
- Add `@example` for complex functions
- Keep comments up-to-date with code changes

````typescript
/**
 * Processes user data and returns a normalized user object.
 *
 * @param input - Raw user input data
 * @returns Normalized user object
 * @throws {ValidationError} When input fails validation
 *
 * @example
 * ```typescript
 * const user = processUser({ name: 'John', email: 'john@example.com' });
 * ```
 */
export function processUser(input: UserInput): User {
    // Implementation
}
````

## Configuration Files

### tsconfig.json Essentials

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,
        "outDir": "./dist",
        "rootDir": "./src"
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

## Dependencies

### Preferred Libraries

- **Validation**: `zod` for runtime type validation
- **Testing**: `vitest` or `jest` with `@types/jest`
- **Linting**: `eslint` with `@typescript-eslint/*`
- **Formatting**: `prettier`
- **HTTP**: `fetch` (native) or `axios`
- **Utilities**: Prefer native methods, then `lodash-es` if needed

### Package Management

- Use `pnpm` or `npm` with lockfile committed
- Pin exact versions for production dependencies
- Keep dependencies up-to-date with automated tools

## Git Commit Messages

Follow conventional commits:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `test:` adding or updating tests
- `refactor:` code changes that neither fix bugs nor add features
- `chore:` maintenance tasks

## Pull Request Guidelines

- Keep PRs focused and small
- Include tests for new functionality
- Update documentation as needed
- Ensure all CI checks pass

## Performance Considerations

- Avoid premature optimization
- Use `Map` and `Set` for frequent lookups
- Prefer iteration over array copying
- Consider lazy evaluation for expensive operations
- Profile before optimizing

## Security

- Never commit secrets or credentials
- Validate and sanitize all external input
- Use parameterized queries for database operations
- Keep dependencies updated for security patches
- Follow the principle of least privilege

## GitHub Pipelines/Workflows

### Scripts

- Use Powershell for cross-platform scripting in CI/CD pipelines
- Use external scripts, don't invoke in-line script from YAML
