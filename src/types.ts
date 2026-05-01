import { Context } from "grammy";
import { DrizzleD1Database } from "drizzle-orm/d1";

export interface Env {
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  DB: D1Database;
}

export interface BotContext extends Context {
  env: Env;
  db: DrizzleD1Database;
  userRole?: 'user' | 'admin' | 'superadmin';
}
