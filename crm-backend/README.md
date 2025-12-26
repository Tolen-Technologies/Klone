# CRM Backend

OpenAI-compatible API backend for CRM database queries using LlamaIndex NLSQLTableQueryEngine.

## Features

- **Natural Language to SQL**: Convert natural language questions to SQL queries
- **OpenAI-compatible API**: Works as a drop-in replacement for OpenAI chat completions
- **Streaming Support**: Server-Sent Events (SSE) for real-time response streaming
- **Segment Generation**: Generate customer segments from natural language descriptions
- **Indonesian Language**: Responses are generated in Indonesian

## Quick Start

### Prerequisites

- Python 3.11+
- [uv](https://github.com/astral-sh/uv) package manager
- MySQL database with CRM data
- OpenAI API key

### Local Development

```bash
# Navigate to crm-backend directory
cd crm-backend

# Copy environment file and configure
cp .env.example .env
# Edit .env with your database and OpenAI credentials

# Sync dependencies (creates .venv automatically)
uv sync

# Run the server
uv run uvicorn src.main:app --reload --port 8000
```

### Docker

```bash
# Build and run
docker compose up --build

# Or run in background
docker compose up -d --build
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CRM_DB_HOST` | MySQL host | `localhost` |
| `CRM_DB_PORT` | MySQL port | `3306` |
| `CRM_DB_USER` | MySQL user | `root` |
| `CRM_DB_PASSWORD` | MySQL password | - |
| `CRM_DB_DATABASE` | Database name | `clonecrm` |
| `CRM_DB_TABLES` | Comma-separated table list | `branch,customer,...` |
| `CRM_OPENAI_API_KEY` | OpenAI API key | - |
| `CRM_OPENAI_MODEL` | OpenAI model | `gpt-4o-mini` |
| `CRM_HOST` | Server host | `0.0.0.0` |
| `CRM_PORT` | Server port | `8000` |
| `CRM_DEBUG` | Debug mode | `false` |

## API Endpoints

### OpenAI-Compatible

#### POST `/v1/chat/completions`

Chat completions endpoint compatible with OpenAI API.

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "crm-sql-engine",
    "messages": [
      {"role": "user", "content": "Tampilkan 5 customer teratas"}
    ],
    "stream": false
  }'
```

#### GET `/v1/models`

List available models.

### Segment Endpoints

#### POST `/api/segments/generate`

Generate a customer segment SQL from natural language.

```bash
curl -X POST http://localhost:8000/api/segments/generate \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Customer yang belum transaksi dalam 6 bulan terakhir"
  }'
```

#### POST `/api/segments/execute`

Execute a segment SQL query.

```bash
curl -X POST http://localhost:8000/api/segments/execute \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT custid, custname, email FROM customer WHERE status = '\''ACTIVE'\''"
  }'
```

### Health Check

#### GET `/health`

Check service and database health.

## LibreChat Integration

Add this to your `librechat.yaml`:

```yaml
endpoints:
  custom:
    - name: 'CRM Query Engine'
      apiKey: 'not-required'  # Auth is trusted
      baseURL: 'http://crm-backend:8000/v1'  # Docker network
      # Or for local: baseURL: 'http://localhost:8000/v1'
      models:
        default: ['crm-sql-engine']
        fetch: true
      titleConvo: true
      titleModel: 'crm-sql-engine'
      modelDisplayLabel: 'CRM Query'
      dropParams: ['stop', 'frequency_penalty', 'presence_penalty', 'top_p']
```

## Architecture

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Browser   │────▶│  LibreChat (Express) │────▶│  CRM Backend        │
│             │◀────│  Port 3080           │◀────│  Port 8000          │
└─────────────┘     └──────────────────────┘     │                     │
                                                  │  ┌───────────────┐ │
                                                  │  │ LlamaIndex    │ │
                                                  │  │ NLSQLTable    │ │
                                                  │  │ QueryEngine   │ │
                                                  │  └───────┬───────┘ │
                                                  │          │         │
                                                  │  ┌───────▼───────┐ │
                                                  │  │    MySQL      │ │
                                                  │  │   (clonecrm)  │ │
                                                  │  └───────────────┘ │
                                                  └─────────────────────┘
```

## Development

### Running Tests

```bash
uv sync --dev
uv run pytest
```

### Code Structure

```
crm-backend/
├── src/
│   ├── __init__.py
│   ├── main.py      # FastAPI application
│   ├── engine.py    # LlamaIndex query engine
│   ├── config.py    # Configuration settings
│   └── prompts.py   # SQL generation prompts
├── pyproject.toml   # Project dependencies
├── Dockerfile
├── docker-compose.yml
└── .env.example
```
