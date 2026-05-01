import { Env, TelegramUpdate } from "./types";
import { BotRouter } from "./bot";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Secure Webhook Registration
    if (url.pathname === "/init-webhook") {
      const webhookUrl = `${url.origin}/webhook`;
      const tgUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${webhookUrl}&secret_token=${env.TELEGRAM_SECRET_TOKEN}`;
      
      const response = await fetch(tgUrl);
      return Response.json(await response.json());
    }

    // Main Webhook Receiver
    if (url.pathname === "/webhook" && request.method === "POST") {
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_SECRET_TOKEN) {
        return new Response("Unauthorized", { status: 403 });
      }

      try {
        const update = await request.json<TelegramUpdate>();
        ctx.waitUntil(BotRouter.handleUpdate(update, env));
        return new Response("OK");
      } catch (e) {
        return new Response("Error", { status: 400 });
      }
    }

    return new Response("Nexus Bot Runtime Active", { status: 200 });
  },
} satisfies ExportedHandler<Env>;
