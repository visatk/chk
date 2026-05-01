import { Hono } from 'hono';
import { webhookCallback } from 'grammy';
import { drizzle } from 'drizzle-orm/d1';
import { createBot } from './bot';
import { Env, BotContext } from './types';

const app = new Hono<{ Bindings: Env }>();

// Health Check
app.get('/', (c) => c.text('Edge-Native Bot Server is running.'));

// Webhook Initialization Endpoint (Run once after deployment)
app.get('/setup', async (c) => {
  const bot = createBot(c.env.BOT_TOKEN);
  const url = new URL(c.req.url);
  const webhookUrl = `${url.protocol}//${url.host}/webhook`;
  
  // Set webhook with a secret token for high security
  await bot.api.setWebhook(webhookUrl, { secret_token: c.env.WEBHOOK_SECRET });
  
  return c.json({ success: true, webhookUrl, status: "Secure webhook configured." });
});

// Primary Webhook Receiver
app.post('/webhook', async (c) => {
  // Validate incoming request secret
  const secretToken = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  if (secretToken !== c.env.WEBHOOK_SECRET) {
    return c.json({ error: "Unauthorized access" }, 401);
  }

  const bot = createBot(c.env.BOT_TOKEN);
  
  // Inject Edge context into Grammy
  bot.use(async (ctx: BotContext, next) => {
    ctx.env = c.env;
    ctx.db = drizzle(c.env.DB);
    await next();
  });

  // Delegate request to Grammy's webhook handler
  const handleUpdate = webhookCallback(bot, 'hono');
  return handleUpdate(c);
});

export default app;
