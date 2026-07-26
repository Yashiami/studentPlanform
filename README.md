# StudentPlatform

A self-hosted data management and analytics platform written in Go, with a vanilla JS/HTML frontend. It lets you import raw data files (CSV, XLSX, JSON), automatically turns them into Postgres tables, and then profile, chart, compare, and export that data as reports.

> Note: despite the "student" naming (module `studentPlatform`, repo `studentPlanform`), the backend is a generic tabular-data ingestion and reporting engine — any CSV/XLSX/JSON dataset can be imported and analyzed, not just student records.

## Features

- **File import** — upload `.csv`, `.xlsx`, or `.json` files; columns and types (`TEXT`, `INTEGER`, `NUMERIC`) are inferred automatically and a new Postgres table is created and populated.
- **Table management** — list imported tables, preview rows, delete tables, and detect duplicate rows.
- **Column profiling** — per-column statistics: null counts, unique values, min/max/avg, and top values.
- **Chart builder** — build charts from a table's data via the `/build` endpoint and the frontend Chart Builder page.
- **Table comparison** — compare two tables grouped by a shared column via the `/compare` endpoint.
- **Reports** — save, list, fetch, and delete generated reports (stored in a `_reports` table alongside their chart config and data).
- **Export to Word** — reports can be exported to `.docx` documents. Export is handled by a Node.js script (`scripts/generate_report.js`) using the `docx` npm package, invoked from the Go backend.
- **Web UI** — a single-page frontend (`frontend/index.html` + vanilla JS) served directly by the Go binary, with pages for import, chart building, analytics, and saved reports.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.25, `net/http` (no framework) |
| Database | PostgreSQL 15 via [`pgx`](https://github.com/jackc/pgx) |
| File parsing | [`excelize`](https://github.com/xuri/excelize) (XLSX), built-in `encoding/csv`/`encoding/json` |
| Report export | Node.js + [`docx`](https://www.npmjs.com/package/docx) npm package |
| Frontend | Static HTML/CSS/JS (no build step) |
| Containerization | Docker & Docker Compose |

## Project Structure

```
.
├── main.go                # Entry point: connects DB, starts HTTP server on :8080
├── routing/                # HTTP route definitions (router.go)
├── apiFunc/                # HTTP handlers (import, tables, charts, compare, export, reports)
├── helperFunc/             # Shared logic: SQL building, table management, validation, stats
├── models/                 # Request/response structs
├── database/               # Postgres connection + system table bootstrap
├── frontend/                # Static single-page web UI
└── scripts/                # Node.js script for DOCX report generation
```

## Prerequisites

- [Go](https://go.dev/) 1.25+
- [PostgreSQL](https://www.postgresql.org/) 15+ (or use the provided Docker Compose setup)
- [Node.js](https://nodejs.org/) + npm (required for the `.docx` export feature — the `docx` package is installed into `scripts/`)
- Docker & Docker Compose (optional, for containerized setup)

## Configuration

The app reads its configuration from environment variables (a `.env` file is supported via `godotenv`):

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_PASSWORD` | Yes | — | Postgres password. The app panics on startup if unset. |
| `DB_HOST` | No | `localhost` | Postgres host. |

The database name (`studentPlatform`) and user (`postgres`) are currently hardcoded in `database/connection.go`.

## Getting Started

### Option 1: Docker Compose (recommended)

```bash
git clone https://github.com/Yashiami/studentPlanform.git
cd studentPlanform

# create a .env file with your DB password
echo "DB_PASSWORD=your_password_here" > .env

docker compose up --build
```

The app will be available at `http://localhost:8080`, backed by a Postgres container on port `5432`.

### Option 2: Run locally

```bash
git clone https://github.com/Yashiami/studentPlanform.git
cd studentPlanform

# 1. Start a local Postgres instance and create a `studentPlatform` database

# 2. Install Node dependencies used for DOCX export
cd scripts && npm install docx && cd ..

# 3. Set environment variables
export DB_PASSWORD=your_password_here
export DB_HOST=localhost   # optional, defaults to localhost

# 4. Run the server
go run main.go
```

Then open `http://localhost:8080` in your browser.

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/read` | Upload and import a CSV/XLSX/JSON file into a new table |
| `POST` | `/build` | Build chart data from a table |
| `POST` | `/compare` | Compare two tables grouped by a column |
| `POST` | `/export` | Export a report to `.docx` |
| `GET` | `/tables` | List all imported tables |
| `GET` | `/tables/{name}/profile` | Column-level statistics for a table |
| `GET` | `/tables/{name}/preview` | Preview rows of a table |
| `GET` | `/tables/{name}/duplicates` | Detect duplicate rows in a table |
| `DELETE` | `/tables/{name}` | Delete a table |
| `GET` / `POST` | `/reports` | List / save reports |
| `GET` / `DELETE` | `/reports/{id}` | Fetch / delete a specific report |

All API routes support CORS (`Access-Control-Allow-Origin: *`).

## License

MIT License
