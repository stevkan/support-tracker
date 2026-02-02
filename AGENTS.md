# Support Tracker - Agent Guidelines

## Project Overview
Support Tracker is an Electron desktop app that queries GitHub, Stack Overflow, and Internal Stack Overflow for issues and creates Azure DevOps work items.

## Tech Stack
- **Frontend**: React 18 + Vite
- **Backend**: Fastify (runs in Electron main process)
- **Desktop**: Electron
- **Storage**: keytar (OS credentials), storaje-db (JSON)

## Directory Structure
- `src/main/` - Electron main process + Fastify backend
- `src/renderer/` - React SPA (Vite)
- `shared/domain/` - Reusable services with AbortController support
- `src/store/` - Storage modules (jsonStore, secretsStore, credentialService)

## Commands
- `npm run dev` - Start development (Electron + Vite)
- `npm run dev:renderer` - Start Vite dev server only
- `npm run build:renderer` - Build React app
- `npm run build:electron` - Package Electron app
- `npm start` - Run CLI version

## Build Verification
To verify builds on Windows, use semicolon chaining (PowerShell doesn't support &&):
```powershell
cd d:\work\support-tracker; npm run build:renderer
```

## Key Patterns
- Services accept `{ signal }` option for AbortController cancellation
- Settings stored in `src/store/db/settings.json`
- Secrets stored via keytar in OS credential manager
- Theme uses CSS custom properties with `data-theme` attribute

## API Endpoints (Fastify)
- `GET/PATCH /api/settings` - Settings CRUD
- `GET/PUT/DELETE /api/secrets/:key` - Secrets management
- `POST /api/queries` - Start query job
- `GET /api/queries/:jobId` - Get job status
- `POST /api/queries/:jobId/cancel` - Cancel job

## Testing
No test framework currently configured.
