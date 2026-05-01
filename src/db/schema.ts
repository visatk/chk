import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  telegramId: integer('telegram_id').primaryKey(),
  username: text('username'),
  firstName: text('first_name'),
  role: text('role', { enum: ['admin', 'user', 'banned'] }).default('user').notNull(),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  telegramId: integer('telegram_id').notNull(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  usdPrice: real('usd_price').notNull(),
  cryptoCurrency: text('crypto_currency').notNull(),
  cryptoAmount: integer('crypto_amount').notNull(),
  invoiceId: text('apirone_invoice_id').notNull(),
  paymentAddress: text('payment_address').notNull(),
  callbackSecret: text('callback_secret').notNull(),
  status: text('status', { enum: ['created', 'paid', 'partpaid', 'overpaid', 'completed', 'expired'] }).default('created').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  invoiceIdx: index('invoice_idx').on(table.invoiceId),
  userIdx: index('user_idx').on(table.telegramId),
}));
