# Stacked PRs

Multi-part features ship as a stack of small PRs into `main`, managed with the official `gh stack` extension. Each PR targets the layer below it. A long-lived feature branch gives no isolation here, because every environment shares one Supabase database.

## Building the stack

- Each layer is safe to deploy on its own: `main` deploys straight to production.
- Run the verify checks from `AGENTS.md` before pushing each layer.
- End each PR title with the layer, e.g. `Mobile Schedule: day view (3/4)`.
- Fill the template's TRACK section: layer N of M, the PR it depends on, the next layer.

## Merging a layer

Merge only after the human says "go" for that specific PR.

1. Squash the layer: `git reset --soft <branch below>`, then `git commit`.
2. `gh stack rebase --upstack`, then `gh stack push`.
3. `gh stack merge <PR#> --merge` (a merge commit, not a squash-merge).

## When the human merged lower layers

The human may squash-merge lower layers through GitHub. Run `gh stack sync` afterwards.

Gotcha: after layers merge, `gh stack rebase --upstack` from the new bottom branch picks the wrong base and replays commits already on `main`. Abort it and restack each layer by hand, then push:

```bash
git rebase --onto <new parent> <old parent tip> <branch>
gh stack push
```
