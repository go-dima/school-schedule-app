// Notifies a Telegram chat when a new row is inserted into public.users.
// Invoked by a Supabase Database Webhook (Database > Webhooks), not by app clients.

interface DatabaseWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: { email?: string } | null;
  old_record: unknown;
}

Deno.serve(async (req: Request) => {
  const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
  const providedSecret = req.headers.get("x-webhook-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await req.json()) as DatabaseWebhookPayload;
  const email = payload.record?.email;

  if (!email) {
    return new Response("Missing record.email", { status: 400 });
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!botToken || !chatId) {
    console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID secret");
    return new Response("Server misconfigured", { status: 500 });
  }

  const telegramResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `New signup pending approval: ${email}`,
      }),
    }
  );

  if (!telegramResponse.ok) {
    console.error("Telegram API error", await telegramResponse.text());
    return new Response("Failed to notify Telegram", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
