import { handleGeneralCommands, TelegramMessage } from './commands/start';
import { handleGenCommand } from './commands/gen';
import { handleChkCommand } from './commands/chk';
import { handleFakeCommand } from './commands/fake';
import { sendTelegramMessage } from './utils/telegram';

export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  WEBHOOK_SECRET?: string; 
}

// Exported specifically as BotRouter to satisfy src/index.ts
export const BotRouter = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (env.WEBHOOK_SECRET && request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 403 });
    }

    try {
      const update = await request.json<any>();

      if (!update.message || !update.message.text) {
        return new Response('OK', { status: 200 }); 
      }

      const message: TelegramMessage = update.message;
      const text = message.text.trim();
      const chatId = message.chat.id;

      let responseText: string | null = null;

      // Command Routing
      responseText = await handleGeneralCommands(message, env);

      if (!responseText) {
        if (text.startsWith('/gen')) {
          responseText = await handleGenCommand(text);
        } else if (text.startsWith('/chk')) {
          responseText = await handleChkCommand(text, env); 
        } else if (text.startsWith('/fake')) {
          responseText = await handleFakeCommand(text);
        }
      }

      // Background Execution via ctx.waitUntil
      if (responseText) {
        ctx.waitUntil(
          sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, responseText)
            .catch(err => console.error("Telegram API Error:", err))
        );
      }

      return new Response('OK', { status: 200 });

    } catch (error) {
      console.error('Webhook processing error:', error);
      return new Response('OK', { status: 200 });
    }
  }
};

// Fallback default export
export default BotRouter;
