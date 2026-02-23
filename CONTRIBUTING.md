# Contributing to TinyWebChat

Thank you for your interest in contributing to TinyWebChat! This document provides guidelines and instructions for contributing.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Code Style](#code-style)
5. [Testing](#testing)
6. [Documentation](#documentation)
7. [Pull Request Process](#pull-request-process)
8. [Release Process](#release-process)

## Code of Conduct

We are committed to providing a friendly, safe, and welcoming environment for all. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm or pnpm
- Git

### Setting Up Development Environment

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/tinywebchat.git
   cd tinywebchat
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/openclaw/tinywebchat.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Build the project**:
   ```bash
   npm run build
   ```

### Project Structure

```
tinywebchat/
├── src/                    # Source code
│   └── channels/plugins/webchat/
│       ├── index.ts       # Plugin entry point
│       ├── gateway.ts     # Gateway implementation
│       ├── http.ts        # HTTP handlers
│       ├── config.ts      # Configuration schema
│       ├── types.ts       # Type definitions
│       └── ui/            # UI components
├── dist/                  # Built files
├── test/                  # Tests
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── sdk/                   # Client SDKs
├── examples/              # Example configurations
└── docs/                  # Documentation
```

## Development Workflow

### Branch Strategy

- `main`: Stable, production-ready code
- `develop`: Integration branch for features
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Critical production fixes

### Creating a New Feature

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following code style guidelines

3. **Write tests** for your changes

4. **Update documentation** if needed

5. **Run tests** to ensure everything passes:
   ```bash
   npm test
   npm run test:integration
   ```

6. **Commit your changes** with descriptive commit messages:
   ```bash
   git commit -m "feat: add your feature description"
   ```

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(gateway): add session cleanup functionality
fix(http): handle malformed JSON requests
docs: update deployment guide with Docker examples
```

## Code Style

### TypeScript Guidelines

1. **Use strict TypeScript** with all strict options enabled
2. **Prefer interfaces over types** for public APIs
3. **Use explicit return types** for functions
4. **Avoid `any` type** - use `unknown` or proper types
5. **Use ES modules** (`import/export`)

### Code Formatting

We use ESLint and Prettier. Run before committing:
```bash
npm run lint
npm run lint:fix
```

### Naming Conventions

- **Variables/Functions**: `camelCase`
- **Classes/Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Private members**: prefix with `_` (optional in TypeScript)

### Error Handling

1. **Use typed errors**:
   ```typescript
   class WebchatError extends Error {
     constructor(
       public code: string,
       message: string,
       public details?: unknown
     ) {
       super(message);
     }
   }
   ```

2. **Never throw generic errors** - always use specific error types
3. **Handle errors at boundaries** (HTTP handlers, gateway methods)

## Testing

### Test Structure

- **Unit tests**: Test individual functions and classes
- **Integration tests**: Test component interactions
- **E2E tests**: Test complete workflows (when applicable)

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Generate coverage report
npm run test:coverage
```

### Writing Tests

1. **Test file naming**: `*.test.ts` or `*.spec.ts`
2. **Test organization**: Use `describe` blocks for grouping
3. **Mock external dependencies**: Use Vitest mocking
4. **Test edge cases**: Include error scenarios

**Example test:**
```typescript
describe('Gateway', () => {
  it('should create a new session', async () => {
    const session = await gateway.createSession();
    expect(session).toHaveProperty('id');
    expect(session).toHaveProperty('token');
  });
  
  it('should reject invalid token', async () => {
    const isValid = await gateway.validateToken('invalid', 'token');
    expect(isValid).toBe(false);
  });
});
```

## Documentation

### Documentation Types

1. **API Documentation**: JSDoc comments for public APIs
2. **User Documentation**: README, deployment guides
3. **Developer Documentation**: Contributing guide, architecture docs

### Writing Documentation

1. **Use Markdown** for all documentation
2. **Include code examples** where helpful
3. **Keep documentation up-to-date** with code changes
4. **Use relative links** for internal references

### JSDoc Format

```typescript
/**
 * Create a new webchat session
 * @param metadata - Optional session metadata
 * @returns Promise resolving to the created session
 * @throws {WebchatError} If session creation fails
 */
async function createSession(metadata?: Record<string, unknown>): Promise<WebchatSession> {
  // implementation
}
```

## Pull Request Process

### Before Submitting

1. **Ensure tests pass**:
   ```bash
   npm test
   npm run test:integration
   ```

2. **Update documentation** if needed
3. **Rebase on upstream** `develop` branch:
   ```bash
   git fetch upstream
   git rebase upstream/develop
   ```

4. **Squash commits** if needed:
   ```bash
   git rebase -i HEAD~3  # Interactive rebase for last 3 commits
   ```

### Creating a Pull Request

1. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create PR on GitHub**:
   - Target: `openclaw/tinywebchat:develop`
   - Fill out PR template
   - Link related issues

3. **PR Title**: Use conventional commit format
4. **PR Description**: Explain changes and motivation

### PR Review Process

1. **Automated checks** must pass:
   - Tests
   - Linting
   - Type checking

2. **Code review** by maintainers
3. **Address feedback** and update PR
4. **Merge approval** by at least one maintainer

### After Merge

1. **Delete feature branch** (optional)
2. **Sync your fork**:
   ```bash
   git checkout develop
   git pull upstream develop
   git push origin develop
   ```

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with release notes
3. **Create release branch**: `release/vX.Y.Z`
4. **Run final tests** and verification
5. **Merge to main** and tag release
6. **Publish to npm** (maintainers only)
7. **Update develop branch** with release changes

### Hotfix Releases

For critical production issues:

1. **Create hotfix branch** from `main`: `hotfix/issue-description`
2. **Fix the issue** with minimal changes
3. **Test thoroughly**
4. **Merge to main** and create patch release
5. **Merge back to develop**

## Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **Discussions**: For questions and community support
- **Documentation**: Check existing docs first

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes
- Project documentation (when appropriate)

Thank you for contributing to TinyWebChat! 🚀