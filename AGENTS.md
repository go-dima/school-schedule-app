# School Schedule App

Weekly class scheduling for an elementary school (grades 1–6). The UI is Hebrew and renders right-to-left. React + Vite + antd on the front, Supabase for data and auth, deployed on Vercel.

`main` deploys straight to production, and dev, preview and production share **one Supabase database**. Every merged PR and every applied migration reaches real users.

## Docs

- `CONTEXT.md`: the domain glossary (Time Slot, Class Slot, Group, Track, Locked Selection...). Name things with its terms.
- `docs/adr/`: decisions already made. Read the ADRs that touch the area you're changing, and say so explicitly when your change contradicts one.
- `docs/agents/`: the GitHub issue tracker and `gh` usage, triage labels, the domain-doc layout, and the stacked-PR procedure.
- `README.md`: the feature overview.

## Roles

Admin, Staff, Parent and Child. New signups wait for admin approval. One user can hold several roles. A user who is both staff and parent uses the Schedule page as a parent (ADR 0004).

## Workflow

- Do every change in its own worktree, a sibling of the main checkout: `git worktree add -b <branch> ../school-schedule-app-<branch> origin/main`. After the PR merges, remove the worktree and delete the branch.
- A multi-part feature ships as **stacked PRs** with `gh stack`, and each layer must be safe to deploy on its own. A single change ships as one PR. See `docs/agents/stacked-prs.md`.
- Merge a PR only after the human says **"go"** for that specific PR.
- Fill the PR body from `.github/pull_request_template.md`.
- Issues close when the PR that resolves them merges. Leave them open while the PR is open.

### Verify before pushing

Run `npx tsc --noEmit`, `npx vitest run` and `npm run lint`. Add `npm run build-storybook` when components or stories changed. Without a `.env.local`, set placeholder `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` so vitest can start.

Changes to logic in services, utils and controller hooks come with vitest tests next to the file (`*.test.ts`). A pure UI tweak doesn't need one.

## Database

- The agent writes migrations and the human applies them. Add `migrations/NNN_<name>.sql` plus its entry in `migrations/migrations.json`, write them at the **start** of the work, and tell the human the run order. Leave `npm run migrate` to the human.
- Put schema changes and one-off data backfills in separate numbered migrations. Each one must be safe to run against the shared database while the current production code is live.
- **Scope** (test/prod) filtering lives only in the low-level fetches in `src/services/api.ts`: `.in("scope", getAllowedScopes())`, or `p_scopes` for RPCs. Joins, page filters and sorting run on the already-filtered data and skip rows that were filtered out instead of throwing.

## Code

- Business logic lives in the service layer (`src/services/`), so it can move to a backend later. Components render and dispatch.
- **Resolved state** (ADR 0005, binding on all new work). Every decision that combines inputs (role, view state, platform) goes through a pure **resolver** with a matrix test, and components read its result instead of combining flags inline. **Permissions** say what the user may do, a page's **capabilities** say what the platform offers, and a control renders only when both allow it.
- **Reuse first.** Before building UI, grep for an existing component and existing i18n keys that do the job. If one almost fits, extend it with a small backward-compatible change.
- **Unify only if they change together.** Before merging similar code into one shared piece, ask: will these places always behave the same and change together? If yes, share. If no, keep them separate. Schedule print and schedule display are deliberately separate. State the answer when you propose the refactor.
- New user-facing strings get a key in `src/locales/he.json`, reusing an existing key where one fits. Leave existing hardcoded Hebrew alone unless your change already touches it. Hebrew that is matched against stored data, such as time slot names in `src/utils/timeSlots.ts`, stays literal.

### Page folders (desktop + mobile)

A page with both a desktop and a mobile view (UI Mode, see ADR 0001) gets its own folder, `src/pages/<pageName>/`, holding:

- the desktop page and the mobile page (`<Page>.tsx`, `Mobile<Page>.tsx`);
- the page's controller hook (`use<Page>Controller.ts`, with its tests): the state and actions both views render from, so no logic is duplicated between them;
- the page's capabilities (`<page>Capabilities.ts`, with its tests): one object per platform saying which controls that view offers (ADR 0005);
- components used only by that page.

Shared components stay in `src/components/` and app-wide hooks in `src/hooks/`. A family of shared components built on one model and one stylesheet gets a subfolder there, e.g. `src/components/lessonCard/`. Pages with a single view stay flat in `src/pages/`. Examples: `src/pages/pendingApprovals/`, `src/pages/schedule/`.

## UI and RTL

- The app renders RTL (antd `ConfigProvider direction="rtl"`), so the source order of tabs, `Space` groups, segmented controls and toolbar buttons is **mirrored** on screen: the first item renders rightmost. `FiltersBar` is the exception: its groups render first child leftmost (ADR 0003).
- When you add or reorder any of these, state the intended right-to-left order and check the **rendered** order in the browser. If you didn't check it visually, say so. Put a short comment beside ordered arrays saying which end the first item lands on.
- A search over a closed list (students, staff, teachers, a roster) shows a dropdown of matching suggestions.
- A Select or AutoComplete gets one clear control: its own `allowClear`.
