import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  telegramId: integer('telegram_id').primaryKey(),
  username: text('username'),
  firstName: text('first_name'),
  role: text('role', { enum: ['admin', 'user', 'banned'] }).default('user').notNull(),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Track purchase intent for analytics
export const orderIntents = sqliteTable('order_intents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  telegramId: integer('telegram_id').notNull(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  price: real('price').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});
