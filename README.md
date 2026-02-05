# Support Tracker

**Current Version**: [v2.8.2](https://github.com/stevkan/support-tracker/releases/tag/2.8.2)

An Electron desktop app (with CLI) that queries GitHub, Stack Overflow, and Internal Stack Overflow for issues and creates Azure DevOps work items.

## Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Fastify (Electron main process)
- **Desktop**: Electron
- **Storage**: keytar (OS credentials), storaje-db (JSON)

## Project Structure

```
src/
├── main/            # Electron main process + Fastify server
│   └── backend/     # API routes (queries, settings, secrets)
├── renderer/        # React SPA (Vite)
│   └── src/
│       ├── components/  # UI components (Results, SettingsModal, TopBar, etc.)
│       ├── pages/       # Landing page
│       ├── api/         # API client
│       └── state/       # State management
├── store/           # Storage (jsonStore, secretsStore, credentialService)
└── index.js         # CLI entry point
shared/
└── domain/
    └── services/    # DevOps, GitHub, StackOverflow, InternalStackOverflow
```

## Getting Started

```bash
npm install
```

### Desktop App (Electron)

```bash
npm run dev         # Development with hot reload
npm run package     # Build installer
```

### CLI

```bash
npm run cli                     # Run query
npm run cli set-username <user> # Set Azure DevOps username
npm run cli set-pat <pat>       # Set Azure DevOps PAT
npm run cli set-services --github --no-stackOverflow --no-internalStackOverflow
npm run cli set-use-test-data true
npm run cli set-verbosity true
```

> Query parameters (days to query, start hour) are configured via the desktop app UI. The CLI respects these settings.

## API Endpoints (Fastify)

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET/PATCH` | `/api/settings` | Settings CRUD |
| `GET/PUT/DELETE` | `/api/secrets/:key` | Secrets management |
| `POST` | `/api/queries` | Start query job |
| `GET` | `/api/queries/:jobId` | Get job status |
| `POST` | `/api/queries/:jobId/cancel` | Cancel job |

## Environment Variables

Configured via the desktop app Settings UI or `.env` file (for `npm run migrate:secrets`).

| Variable | Description |
| --- | --- |
| `AZURE_DEVOPS_ORG` | Azure DevOps Organization |
| `AZURE_DEVOPS_PROJECT` | Azure DevOps Project |
| `AZURE_DEVOPS_API_VERSION` | API Version (`6.1` or `7.1`) |
| `APPINSIGHTS_INSTRUMENTATION_KEY` | Application Insights key |
| `GITHUB_TOKEN` | GitHub Personal Access Token |
| `GITHUB_API_URL` | GitHub API URL |
| `STACK_OVERFLOW_ENTERPRISE_KEY` | Stack Overflow Enterprise key |

## Testing

```bash
npm test             # Run tests once
npm run test:watch   # Watch mode
npm run test:coverage # With coverage
```

Tests use **Vitest** and are located in `tests/`.

## License

[MIT](LICENSE)
