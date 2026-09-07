# Work Setup

One-time steps to get a fresh environment ready to work on this project. For feature/architecture docs see [README.md](README.md) and [DEVELOPMENT.md](DEVELOPMENT.md); this file is just the "get unblocked" checklist.

## 1. Install dependencies

```bash
npm install
```

## 2. Authenticate the Supabase and Vercel CLIs

This project uses the CLI-based [supabase](https://github.com/supabase/agent-skills) and [vercel](https://github.com/vercel-labs/agent-skills) agent skills rather than MCP servers. If they aren't installed globally yet:

```bash
npx skills add supabase/agent-skills
npx skills add vercel-labs/agent-skills
```

Then authenticate each CLI:

```bash
npx supabase login   # opens a browser — needs a real TTY, run this in your own terminal
npx vercel login      # device-code flow, also opens a browser
```

Verify:

```bash
npx supabase projects list
npx vercel whoami
```

## 3. Link the project

```bash
npx supabase link --project-ref ewfoyzovlbbkddvdyeah   # "school-schedule-app" project
npx vercel link --repo -y
```

The Supabase org also has two other, unrelated projects (`subscription-tracker`, and an older inactive `school-schedule`) — don't link those by mistake.

## 4. Local env vars (`.env.local`)

Needed for: `npm run dev`, `npm run build`, `npm run preview`, `npm run migrate` / `npm run migrate:status` (the migration script validates `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` on load, even just to check status), and any Vitest tests that exercise code reading `import.meta.env`.

Not needed for: Supabase-CLI-driven work (running migrations by hand in the SQL editor, `db diff`, advisors) or Vercel-CLI-driven work (deploys, env var management, log inspection) — those use the CLI auth/link from step 3.

Fastest way to populate it once linked (pulls real values from the Vercel project, matching production/preview config):

```bash
npx vercel env pull .env.local
```

## 5. Database migrations

Migrations live in [migrations/](migrations/), tracked in [migrations/migrations.json](migrations/migrations.json). Check status/instructions with:

```bash
npm run migrate:status
npm run migrate
```

(Requires `.env.local` — see step 4.)

## Known gaps (as of 2026-09-07)

- No CI configured (`.github/workflows` doesn't exist).
- No `.mcp.json` / MCP servers for Supabase or Vercel — CLI skills are used instead (see step 2).
