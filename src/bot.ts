import { Bot } from "grammy";
import { BotContext } from "./types";
import { users } from "./db/schema";
import { requireAdmin } from "./middleware/admin";

export function createBot(token: string) {
  const bot = new Bot<BotContext>(token);

  // --- Global Middleware ---
  // Automatically register new users in D1
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      const now = new Date();
      try {
        await ctx.db.insert(users).values({
          telegramId: ctx.from.id,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          role: 'user',
          createdAt: now,
        }).onConflictDoNothing({ target: users.telegramId });
      } catch (error) {
        console.error("Failed to sync user state:", error);
      }
    }
    await next();
  });

  // --- Public Commands ---
  bot.command("start", async (ctx) => {
    const welcomeMessage = `
🚀 **Welcome to the Edge-Native Platform**

Your secure session has been established. Use the menu below to navigate your vault and access services.

*Powered by the elite community at @drkingbd.*
    `;
    await ctx.reply(welcomeMessage, { parse_mode: "Markdown" });
  });

  bot.command("ping", async (ctx) => {
    const start = Date.now();
    const msg = await ctx.reply("Pinging Edge servers...");
    const latency = Date.now() - start;
    await ctx.api.editMessageText(ctx.chat.id, msg.message_id, `⚡️ Edge Latency: ${latency}ms`);
  });

  // --- Admin Protected Commands ---
  const adminFeature = bot.filter((ctx) => ctx.hasCommand("stats") || ctx.hasCommand("broadcast"));
  adminFeature.use(requireAdmin);

  bot.command("stats", async (ctx) => {
    // Requires Drizzle sql helper in a real app to count, simplified here
    const allUsers = await ctx.db.select().from(users);
    const adminCount = allUsers.filter(u => u.role === 'admin' || u.role === 'superadmin').length;
    
    await ctx.reply(`📊 **System Analytics**\n\nTotal Users: ${allUsers.length}\nAdmins: ${adminCount}\nStatus: Operational`, { parse_mode: "Markdown" });
  });

  return bot;
}
