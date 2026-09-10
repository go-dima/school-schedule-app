# notify-signup-telegram

Posts a Telegram message with the new user's email whenever a row is inserted into `public.users`. Triggered by a Supabase **Database Webhook** (Dashboard → Integrations → Webhooks), not called directly by app code.

Auth model: the webhook call carries no user JWT, so the function is deployed with `--no-verify-jwt` and instead checks a shared `x-webhook-secret` header against the `WEBHOOK_SECRET` secret.

## Prerequisites

- Supabase CLI via `npx supabase` (no global install needed; this repo uses `npx supabase <command>` throughout)
- The project is already linked (`supabase/.temp/project-ref` → `ewfoyzovlbbkddvdyeah`); no `supabase link` needed unless re-linking to a different project

## 1. Fill in local secrets

Copy the template and fill in real values (this file is gitignored — never commit it):

```bash
cp supabase/.supabase.local.example supabase/.env.local
```

Edit `supabase/.env.local`:

| Key                  | Where it comes from                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | `@BotFather` on Telegram                                                                                                                            |
| `TELEGRAM_CHAT_ID`   | The chat/channel the bot should post to                                                                                                             |
| `WEBHOOK_SECRET`     | Self-generated — **not** a Telegram value. Run `openssl rand -hex 32`. Its only purpose is to prove a call actually came from the Database Webhook. |

## 2. Deploy the function

```bash
npx supabase functions deploy notify-signup-telegram --no-verify-jwt
```

## 3. Push secrets to the deployed function

```bash
npx supabase secrets set --env-file supabase/.env.local
```

## 4. Verify with a manual test call

```bash
WEBHOOK_SECRET=$(grep '^WEBHOOK_SECRET=' supabase/.env.local | cut -d= -f2-)

curl -i "https://ewfoyzovlbbkddvdyeah.supabase.co/functions/v1/notify-signup-telegram" \
  -H "x-webhook-secret: ${WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"type":"INSERT","table":"users","record":{"email":"test@example.com"}}'
```

Expect `HTTP/2 200` and a Telegram message: "New signup pending approval: test@example.com". A missing/wrong `x-webhook-secret` should return `401`.

## 5. Wire up the trigger (Database Webhook)

In the Supabase Dashboard:

1. Go to **Integrations** (this project doesn't show a standalone Database → Webhooks page — Database Webhooks live under Integrations) and enable/install **Webhooks**.
2. Create a new webhook:
   - Table: `public.users`
   - Event: `INSERT`
   - Type: Edge Function → `notify-signup-telegram`
   - HTTP header: `x-webhook-secret` = the `WEBHOOK_SECRET` value from `supabase/.env.local`

This is a Dashboard-managed resource — it isn't tracked in `migrations/` or `supabase/config.toml`. If this project is ever re-linked to a new Supabase project, this step must be redone by hand.

> An earlier SQL-based fallback (a `pg_net` trigger calling this function directly) was considered before the Integrations-based webhook was found, but was never applied and isn't part of the current setup — the Database Webhook above is the only trigger path in use.

## Redeploying after code changes

```bash
npx supabase functions deploy notify-signup-telegram --no-verify-jwt
```

Secrets persist across redeploys — only rerun step 3 if you're rotating a value.
