# Tyler's Daily Discipline

A private daily-habits tracker with sobriety streak, 30-day challenges, journal, tasks, and long-term goals.

- **Stack:** Express 5 + Vite + React 18 + Tailwind + shadcn/ui + Drizzle ORM + Postgres
- **Design:** Cinzel (Roman inscriptional caps) + Inter + JetBrains Mono, platinum on charcoal
- **Auth:** none — single-user personal tool

## Features

- **Habits** — Ten daily habits (bool + numeric) with optimistic updates, sound feedback, per-day editor, and a date navigator
- **Sobriety** — dedicated hero card computing consecutive days sober from the `noAlcohol` habit, with milestones at 30 / 90 / 365 / 1000+ days
- **30-Day Challenge** — fixed-window challenge with a 30-cell grid, perfect-day counter, and current/best streak inside the window
- **Tasks** — Today / Backlog with priority
- **Journal** — daily wins / lessons / tomorrow / notes (upsert by date)
- **Goals** — categorized long-term goals with progress %
- **Analytics** — compound curve, 7-day bars, 90-day heatmap, 30-day habit rates

## Local Development

Requires Node 20+ and Postgres 14+.

```bash
# 1. Install
npm ci

# 2. Point at a Postgres instance
cp .env.example .env
# edit DATABASE_URL if not using the default

# 3. Start Postgres (choose one)
#   a) macOS via Homebrew:  brew services start postgresql@15
#   b) Ubuntu:              sudo service postgresql start
#   c) Docker:              docker run -d --name pg -p 5432:5432 \
#                             -e POSTGRES_USER=tyler -e POSTGRES_PASSWORD=tyler \
#                             -e POSTGRES_DB=tyler_tracker postgres:15

# 4. Run
npm run dev
```

The server bootstraps schema on startup (`CREATE TABLE IF NOT EXISTS ...`) — no separate migration step required for the initial install.

## Production Build

```bash
npm run build   # Vite build client + esbuild bundle server
npm run start   # NODE_ENV=production node dist/index.cjs
```

## Deploy to Railway

1. Create a new Railway project and add a **Postgres** plugin. Railway will auto-inject `DATABASE_URL`.
2. Connect this GitHub repo as the service.
3. Railway detects `nixpacks.toml` and builds automatically.
4. Optional environment variables:
   - `PORT` — set by Railway automatically, don't override
   - `DATABASE_SSL=true` — force SSL if your provider isn't auto-detected

The app listens on `PORT` and serves both the API and the static frontend on the same port.

## API Overview

| Method | Path | Body |
|---|---|---|
| GET | `/api/logs` | — |
| GET | `/api/logs/:date` | — |
| PATCH | `/api/logs/:date` | partial DailyLog |
| DELETE | `/api/logs/:date` | — |
| GET | `/api/tasks` | — |
| POST | `/api/tasks` | `{title, list, priority}` |
| PATCH | `/api/tasks/:id` | partial Task |
| DELETE | `/api/tasks/:id` | — |
| GET | `/api/journal` | — |
| GET | `/api/journal/:date` | — |
| PATCH | `/api/journal/:date` | partial Journal |
| GET | `/api/goals` | — |
| POST | `/api/goals` | InsertGoal |
| PATCH | `/api/goals/:id` | partial Goal |
| DELETE | `/api/goals/:id` | — |
| GET | `/api/challenges` | — |
| GET | `/api/challenges/active?today=YYYY-MM-DD` | — |
| POST | `/api/challenges` | `{name, startDate, endDate, durationDays, habitKeys}` |
| POST | `/api/reset` | **wipes everything** |

## License

MIT — personal project.
