import { Env } from "../types";

const API_BASE = "https://api.telegram.org/bot";

export async function sendMessage(env: Env, chatId: number, text: string, replyMarkup?: any): Promise<void> {
  await fetch(`${API_BASE}${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    }),
  });
}

export async function editMessage(env: Env, chatId: number, messageId: number, text: string, replyMarkup?: any): Promise<void> {
  await fetch(`${API_BASE}${env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    }),
  });
}

export async function answerCallback(env: Env, callbackQueryId: string, text?: string): Promise<void> {
  await fetch(`${API_BASE}${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: false
    }),
  });
}
