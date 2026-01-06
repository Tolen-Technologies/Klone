# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies (use ci for exact versions)
npm ci

# Build packages (must be done in order for first-time setup)
npm run build:data-provider
npm run build:data-schemas
npm run build:api
npm run build:client-package

# Or build all frontend packages at once
npm run frontend

# Development servers (run in separate terminals)
npm run backend:dev          # Backend at localhost:3080
npm run frontend:dev         # Client at localhost:3090 (proxies to 3080)

# Production
npm run backend              # NODE_ENV=production
npm run build:client         # Build client for production
```

## Docker Development

```bash
# Development mode with live-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# This setup:
# - API runs with nodemon at localhost:3080
# - Client runs with Vite dev server at localhost:5173
# - CRM backend (FastAPI) at localhost:8001
# - MongoDB at mongodb://mongodb:27017/LibreChat
# - Source code is bind-mounted for hot-reload
```

## Testing

```bash
# Unit tests
npm run test:api             # Backend tests
npm run test:client          # Client tests
npm run test:packages:api    # API package tests
npm run test:packages:data-provider
npm run test:packages:data-schemas

# E2E tests (requires MongoDB, built client)
npm run e2e                  # Playwright tests
npm run e2e:headed           # With visible browser
npm run e2e:debug            # Debug mode

# Linting
npm run lint                 # Check for issues
npm run lint:fix             # Auto-fix issues
npm run format               # Prettier formatting
```

## Mandatory Development Practices

- **MUST** use `code-simplifier` agent immediately after implementing any feature, fix, or code change
- **MUST** rebuild shared packages after modifying them (`npm run build:data-schemas`, etc.)
- **MUST** run `npm run lint:fix` before committing code
- **MUST** follow the database entity pattern in `packages/data-schemas/README.md` when adding new entities

## Architecture Overview

### Monorepo Structure

LibreChat uses npm workspaces with these key packages:

- **`api/`** - Express.js backend server (JavaScript)
- **`client/`** - React frontend with Vite (TypeScript)
- **`packages/data-provider/`** - Shared API client, React Query hooks, types
- **`packages/data-schemas/`** - Mongoose schemas, models, methods (TypeScript)
- **`packages/api/`** - MCP services, utilities (TypeScript)
- **`packages/client/`** - Reusable React component library
- **`crm-backend/`** - FastAPI backend for CRM SQL engine (Python, separate service)

Package dependencies flow: `data-schemas` → `data-provider` → `api/client`

**IMPORTANT**: When modifying shared packages (`data-provider`, `data-schemas`, `api`, `client`), you must rebuild them before changes take effect:
```bash
npm run build:data-schemas   # If you modified data-schemas
npm run build:data-provider  # If you modified data-provider
npm run build:api            # If you modified api package
npm run build:client-package # If you modified client package
```

### Frontend-Backend Communication

1. **HTTP Client**: Axios-based with automatic 401 token refresh (`packages/data-provider/src/request.ts`)
   - Token refresh handled via interceptor with retry queue
   - `dispatchTokenUpdatedEvent()` notifies app of new tokens

2. **Streaming**: Server-Sent Events via `sse.js` for LLM responses (`client/src/hooks/SSE/useSSE.ts`)
   - Used for real-time AI message streaming
   - Handles conversation updates, title generation, and run states

3. **State Management**:
   - **Jotai atoms** (`client/src/store/`) - Global UI state (agents, endpoints, settings, etc.)
   - **React Context** - Feature-scoped state
   - **TanStack React Query** - Server state caching and mutations via `data-provider`

### Key Backend Entry Points

- **Server**: `api/server/index.js` - Express setup, middleware, routes, startup checks
- **Routes**: `api/server/routes/` - API endpoints (auth, convos, messages, agents, files, etc.)
- **Middleware**: `api/server/middleware/` - Auth, validation, config, image validation
- **Database**: `api/models/` - Mongoose model operations (uses factories from `data-schemas`)
- **Services**: `api/server/services/` - Business logic (Config, Endpoints, Files, MCP, Permissions, etc.)

### Configuration

- **`.env`** - Environment variables (API keys, database, auth, feature flags)
  - MongoDB connection: `MONGO_URI`
  - Server config: `HOST`, `PORT`, `DOMAIN_CLIENT`, `DOMAIN_SERVER`
  - Feature toggles: `ALLOW_SOCIAL_LOGIN`, etc.

- **`librechat.yaml`** - Application config (endpoints, interface, features)
  - Custom AI endpoints configuration
  - Model settings and parameters
  - Interface permissions

- **Config loading**: `api/server/services/Config/loadConfigModels.js` and `loadYaml.js`

### Database Patterns (packages/data-schemas)

Uses factory pattern for models and methods:
```typescript
// Creating a new entity requires:
// 1. Type definition in src/types/
// 2. Schema in src/schema/
// 3. Model factory in src/models/
// 4. Methods in src/methods/
// 5. Export in respective index.ts files
```

See `packages/data-schemas/README.md` for detailed patterns.

### Endpoint System

AI providers are configured in `librechat.yaml` under `endpoints`. Each endpoint type (openAI, anthropic, google, custom, etc.) has:
- Configuration builder in `api/server/services/Endpoints/`
- Client implementation extending base patterns
- Frontend handler for streaming responses

**Custom Endpoints** allow integration with any OpenAI-compatible API:
```yaml
endpoints:
  custom:
    - name: 'provider-name'
      apiKey: '${API_KEY}'
      baseURL: 'https://api.example.com/v1/'
      models:
        default: ['model-1', 'model-2']
```

### CRM Backend Integration

This fork includes a custom CRM backend (`crm-backend/`) that provides a SQL query engine:
- **Tech Stack**: FastAPI (Python), LlamaIndex, MySQL
- **Purpose**: Natural language to SQL conversion for CRM database queries
- **Database**: `clonecrm` schema with customer, invoice, product data
- **Endpoint**: Exposed as custom endpoint in `librechat.yaml` at `http://crm-backend:8000/v1`
- **Main Engine**: `crm-backend/src/engine.py` - Text-to-SQL with LlamaIndex

Key tables: `customer`, `invoice`, `invoice_tk` (tickets), `invoice_ht` (hotels), `invoice_tr` (tours), `product`, `lead`

## Conventions

### Git Workflow

- Branch naming: slash-based (e.g., `new/feature/x`, `fix/bug/y`)
- Commits: semantic format (`feat:`, `fix:`, `docs:`, `refactor:`)
- Squash commits before PR when possible

### Code Style

- **JS/TS files**: camelCase, React components PascalCase
- **Import order**: npm packages (longest to shortest) → types → local imports
- ESLint enforces import ordering via `npm run lint:fix`

### TypeScript Notes

- Frontend is TypeScript, backend remains JavaScript
- Shared packages (`data-provider`, `data-schemas`, `api`, `client`) are TypeScript
- Build packages before running if you modify them

## Common Tasks

### Adding a New API Route

1. Create route file in `api/server/routes/`
2. Mount in `api/server/routes/index.js`
3. Add React Query hooks in `packages/data-provider/` if needed
4. Rebuild data-provider: `npm run build:data-provider`

### Adding a Database Entity

Follow the pattern in `packages/data-schemas/README.md`:
1. Type in `src/types/` (define base type + Document interface)
2. Schema in `src/schema/` (Mongoose schema)
3. Model factory in `src/models/` (singleton model creation)
4. Methods in `src/methods/` (CRUD operations)
5. Update index files
6. Rebuild: `npm run build:data-schemas`

### Adding a Custom AI Endpoint

Configure in `librechat.yaml` under `endpoints.custom`:
```yaml
endpoints:
  custom:
    - name: 'provider-name'
      apiKey: '${API_KEY}'
      baseURL: 'https://api.example.com/v1/'
      models:
        default: ['model-1', 'model-2']
      titleConvo: true
      dropParams: ['stop', 'frequency_penalty']
```

### Working with State

- **Global UI state**: Add to `client/src/store/` as Jotai atoms
- **Server state**: Use React Query via `packages/data-provider/`
- **Feature state**: Use React Context within feature components

### File Organization

- **Components**: `client/src/components/` - Organized by feature area
- **Hooks**: `client/src/hooks/` - Reusable React hooks
- **Utils**: `client/src/utils/` - Utility functions
- **Data provider**: `packages/data-provider/src/` - API calls and hooks
  - `api-endpoints.ts` - Endpoint URL constants
  - `request.ts` - HTTP client with interceptors
  - React Query hooks organized by resource

## Key Architectural Decisions

1. **Monorepo with workspaces** - Shared code via npm packages, not path imports
2. **Factory pattern for DB** - Models/methods created dynamically with mongoose instance
3. **Token refresh strategy** - Automatic retry queue prevents race conditions
4. **SSE for streaming** - Real-time AI responses without WebSockets
5. **Jotai for client state** - Atomic state management with minimal boilerplate
6. **TypeScript gradual migration** - Shared packages in TS, backend stays JS for now
