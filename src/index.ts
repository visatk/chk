import { ExecutionContext } from '@cloudflare/workers-types';

// ==========================================
// ENVIRONMENT & TYPE DEFINITIONS
// ==========================================

export interface Env {
    DB: D1Database;
    TELEGRAM_BOT_TOKEN: string;
    APIRONE_ACCOUNT_ID: string;
    WEBHOOK_SECRET: string;
}

const SUPPORTED_CRYPTO = {
    'btc': 100000000,
    'ltc': 100000000,
    'trx': 1000000
} as const;

type CryptoCurrency = keyof typeof SUPPORTED_CRYPTO;

interface TelegramUser { id: number; first_name: string; username?: string; }
interface TelegramMessage { message_id: number; from: TelegramUser; chat: { id: number }; text?: string; }
interface TelegramCallbackQuery { id: string; from: TelegramUser; message?: TelegramMessage; data: string; }
interface TelegramUpdate { update_id: number; message?: TelegramMessage; callback_query?: TelegramCallbackQuery; }
interface ApironeCallback { invoice: string; status: string; [key: string]: unknown; }

// ==========================================
// WORKER ENTRY POINT
// ==========================================

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        try {
            // Telegram Webhook
            if (url.pathname === '/webhook/telegram' && request.method === 'POST') {
                const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
                if (env.WEBHOOK_SECRET && secretToken !== env.WEBHOOK_SECRET) {
                    return new Response('Unauthorized', { status: 403 });
                }
                
                // Process asynchronously to ensure 200 OK is returned immediately
                ctx.waitUntil(handleTelegramUpdate(request, env, ctx, url.origin));
                return new Response('OK', { status: 200 });
            }

            // Apirone Webhook
            if (url.pathname === '/webhook/apirone' && request.method === 'POST') {
                if (url.searchParams.get('secret') !== env.WEBHOOK_SECRET) {
                    return new Response('Unauthorized', { status: 403 });
                }
                ctx.waitUntil(handleApironeCallback(request, env));
                return new Response('*ok*', { status: 200, headers: { 'Content-Type': 'text/plain' } });
            }

            return new Response(JSON.stringify({ status: "online", version: "2.0 (SPA Mode)" }), { 
                status: 200, headers: { 'Content-Type': 'application/json' } 
            });

        } catch (error) {
            console.error('Edge Error:', error);
            return new Response('Internal Edge Error', { status: 500 });
        }
    }
} satisfies ExportedHandler<Env>;

// ==========================================
// TELEGRAM UX & ROUTING
// ==========================================

async function handleTelegramUpdate(request: Request, env: Env, ctx: ExecutionContext, baseUrl: string): Promise<void> {
    const update = (await request.json()) as TelegramUpdate;

    try {
        if (update.message) {
            await processMessage(update.message, env);
        } else if (update.callback_query) {
            await processCallbackQuery(update.callback_query, env, ctx, baseUrl);
        }
    } catch (error) {
        console.error('Update Error:', error);
    }
}

async function processMessage(message: TelegramMessage, env: Env): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text || '';
    const userId = message.from.id;

    await env.DB.prepare(
        `INSERT OR IGNORE INTO users (telegram_id, username, first_name) VALUES (?, ?, ?)`
    ).bind(userId, message.from.username || '', message.from.first_name || '').run();

    if (text.startsWith('/start')) {
        await renderMainMenu(chatId, null, env);
    }
}

async function processCallbackQuery(query: TelegramCallbackQuery, env: Env, ctx: ExecutionContext, baseUrl: string): Promise<void> {
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;
    const data = query.data;
    const userId = query.from.id;

    if (!chatId || !messageId) return;

    try {
        // --- NAVIGATION (SPA Edit Mode) ---
        if (data === 'menu_main') {
            await answerCallback(env.TELEGRAM_BOT_TOKEN, query.id);
            await renderMainMenu(chatId, messageId, env);
        }
        else if (data === 'menu_profile') {
            await answerCallback(env.TELEGRAM_BOT_TOKEN, query.id);
            await renderProfile(chatId, messageId, userId, env);
        }
        else if (data === 'menu_purchases') {
            await answerCallback(env.TELEGRAM_BOT_TOKEN, query.id);
            await renderPurchases(chatId, messageId, userId, env);
        }
        
        // --- TOP UP FLOW ---
        else if (data === 'menu_topup') {
            await answerCallback(env.TELEGRAM_BOT_TOKEN, query.id);
            await renderTopUpMenu(chatId, messageId, env);
        }
        else if (data.startsWith('topup_select_')) {
            await answerCallback(env.TELEGRAM_BOT_TOKEN, query.id);
            const amount = data.split('_')[2];
            await renderCryptoSelector(chatId, messageId, amount, env);
        }
        else if (data.startsWith('topup_gen_')) {
            // Show toast so user knows it's processing
            await answerCallback(env.TELEGRAM_BOT_TOKEN, query.id, "⏳ Generating secure payment gateway...", false);
            const parts = data.split('_');
            await processInvoiceGeneration(chatId, messageId, userId, parseFloat(parts[2]), parts[3] as CryptoCurrency, env, ctx, baseUrl);
        }

        // --- STORE FLOW ---
        else if (data === 'menu_products') {
            await answerCallback(env.TELEGRAM_BOT_TOKEN, query.id);
            await renderStoreCatalog(chatId, messageId, userId, env);
        }
        else if (data.startsWith('buy_item_')) {
            // DO NOT answer immediately, pass query.id to show success/failure alerts
            const productId = data.split('_')[2];
            await processPurchase(userId, chatId, messageId, query.id, productId, env);
        } else {
            // Fallback catch-all to stop loading spinner
            await answerCallback(env.TELEGRAM_BOT_TOKEN, query.id);
        }
    } catch (e) {
        console.error("Callback Route Error:", e);
        await answerCallback(env.TELEGRAM_BOT_TOKEN, query.id, "⚠️ An error occurred.", true);
    }
}

// ==========================================
// RENDERERS (UI COMPONENTS)
// ==========================================

async function renderMainMenu(chatId: number, messageId: number | null, env: Env): Promise<void> {
    const text = `🏛 <b>Welcome to the Premium Store</b>\n\nTop up your balance using Crypto and buy digital products instantly.`;
    const keyboard = {
        inline_keyboard: [
            [{ text: "🛍️ Browse Products", callback_data: "menu_products" }],
            [{ text: "👤 My Profile & Balance", callback_data: "menu_profile" }],
            [{ text: "📦 My Purchases", callback_data: "menu_purchases" }]
        ]
    };
    
    if (messageId) await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, text, keyboard);
    else await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, text, keyboard);
}

async function renderProfile(chatId: number, messageId: number, userId: number, env: Env): Promise<void> {
    const user = await env.DB.prepare(`SELECT balance_usd FROM users WHERE telegram_id = ?`).bind(userId).first<{ balance_usd: number }>();
    const text = `👤 <b>Your Profile</b>\n\nID: <code>${userId}</code>\n💰 <b>Balance:</b> $${(user?.balance_usd || 0).toFixed(2)}\n\n<i>To buy products, you need to top up your balance.</i>`;
    const keyboard = {
        inline_keyboard: [
            [{ text: "💳 Top Up Balance", callback_data: "menu_topup" }],
            [{ text: "🔙 Main Menu", callback_data: "menu_main" }]
        ]
    };
    await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, text, keyboard);
}

async function renderPurchases(chatId: number, messageId: number, userId: number, env: Env): Promise<void> {
    const { results } = await env.DB.prepare(`
        SELECT p.title, d.payload, d.sold_at 
        FROM digital_assets d JOIN products p ON d.product_id = p.id 
        WHERE d.sold_to = ? ORDER BY d.sold_at DESC LIMIT 5
    `).bind(userId).all<{ title: string, payload: string, sold_at: string }>();

    let text = "📦 <b>Your Recent Purchases:</b>\n\n";
    if (!results || results.length === 0) {
        text = "📭 You haven't purchased anything yet.";
    } else {
        results.forEach(r => {
            text += `🔹 <b>${escapeHTML(r.title)}</b>\n🔑 <code>${escapeHTML(r.payload)}</code>\n🕒 <i>${new Date(r.sold_at).toLocaleDateString()}</i>\n\n`;
        });
    }

    await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, text, { inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_main" }]] });
}

async function renderTopUpMenu(chatId: number, messageId: number, env: Env): Promise<void> {
    const text = `💳 <b>Top Up Balance</b>\n\nSelect the amount you want to add to your account (USD):`;
    const keyboard = {
        inline_keyboard: [
            [{ text: "$10", callback_data: "topup_select_10" }, { text: "$25", callback_data: "topup_select_25" }],
            [{ text: "$50", callback_data: "topup_select_50" }, { text: "$100", callback_data: "topup_select_100" }],
            [{ text: "🔙 Back to Profile", callback_data: "menu_profile" }]
        ]
    };
    await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, text, keyboard);
}

async function renderCryptoSelector(chatId: number, messageId: number, amount: string, env: Env): Promise<void> {
    const text = `💎 You chose to top up <b>$${amount}</b>.\n\nSelect a cryptocurrency for payment:`;
    const keyboard = {
        inline_keyboard: [
            [{ text: "🟠 Bitcoin (BTC)", callback_data: `topup_gen_${amount}_btc` }],
            [{ text: "⚪ Litecoin (LTC)", callback_data: `topup_gen_${amount}_ltc` }],
            [{ text: "🔴 TRON (TRX)", callback_data: `topup_gen_${amount}_trx` }],
            [{ text: "🔙 Back", callback_data: "menu_topup" }]
        ]
    };
    await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, text, keyboard);
}

async function renderStoreCatalog(chatId: number, messageId: number, userId: number, env: Env): Promise<void> {
    const [{ results }, user] = await Promise.all([
        env.DB.prepare(`
            SELECT p.id, p.title, p.price_usd, p.description, COUNT(d.id) as stock
            FROM products p LEFT JOIN digital_assets d ON p.id = d.product_id AND d.is_sold = 0
            WHERE p.is_active = 1 GROUP BY p.id
        `).all<{ id: number, title: string, price_usd: number, description: string, stock: number }>(),
        env.DB.prepare(`SELECT balance_usd FROM users WHERE telegram_id = ?`).bind(userId).first<{ balance_usd: number }>()
    ]);

    const balance = user?.balance_usd || 0;
    
    if (!results || results.length === 0) {
        await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, `🛒 <b>Store Catalog</b>\n💰 Balance: <b>$${balance.toFixed(2)}</b>\n\n😔 Store is currently empty.`, { inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_main" }]] });
        return;
    }

    let text = `🛒 <b>Store Catalog</b>\n💰 Your Balance: <b>$${balance.toFixed(2)}</b>\n\n`;
    const keyboard: { inline_keyboard: any[][] } = { inline_keyboard: [] };

    results.forEach((p) => {
        text += `🔹 <b>${escapeHTML(p.title)}</b>\n💵 $${p.price_usd.toFixed(2)} | 📦 Stock: ${p.stock}\n<i>${escapeHTML(p.description || '')}</i>\n\n`;
        if (p.stock > 0) {
            keyboard.inline_keyboard.push([{ text: `💳 Buy: ${p.title} ($${p.price_usd})`, callback_data: `buy_item_${p.id}` }]);
        }
    });
    
    keyboard.inline_keyboard.push([{ text: "🔙 Main Menu", callback_data: "menu_main" }]);
    await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, text, keyboard);
}

// ==========================================
// BUSINESS LOGIC
// ==========================================

async function processInvoiceGeneration(chatId: number, messageId: number, userId: number, amountUsd: number, cryptoCurrency: CryptoCurrency, env: Env, ctx: ExecutionContext, baseUrl: string): Promise<void> {
    try {
        const rateUsd = await getCachedCryptoRate(cryptoCurrency, ctx);
        if (!rateUsd) throw new Error("Could not fetch exchange rates.");

        const cryptoAmount = amountUsd / rateUsd;
        const minorUnits = Math.floor(cryptoAmount * SUPPORTED_CRYPTO[cryptoCurrency]);

        const invoiceReqBody = {
            amount: minorUnits,
            currency: cryptoCurrency,
            lifetime: 3600,
            "callback-url": `${baseUrl}/webhook/apirone?secret=${env.WEBHOOK_SECRET}`,
            "user-data": { title: `Account Top-Up ($${amountUsd})`, merchant: "Premium Store", price: `$${amountUsd.toFixed(2)}` }
        };

        const apironeRes = await fetch(`https://apirone.com/api/v2/accounts/${env.APIRONE_ACCOUNT_ID}/invoices`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invoiceReqBody)
        });

        const invoiceData = await apironeRes.json() as any;
        if (!invoiceData.invoice) throw new Error("Apirone API Error");

        await env.DB.prepare(`
            INSERT INTO invoices (invoice_id, telegram_id, usd_amount, crypto_currency, invoice_url) 
            VALUES (?, ?, ?, ?, ?)
        `).bind(invoiceData.invoice, userId, amountUsd, cryptoCurrency, invoiceData["invoice-url"]).run();

        const text = `🧾 <b>Top-Up Invoice Created</b>\n\n💵 Amount: $${amountUsd.toFixed(2)}\n🪙 Pay With: ${cryptoCurrency.toUpperCase()}\n\n<i>Please pay using the secure link below. Your balance will update automatically upon network confirmation.</i>`;
        const keyboard = {
            inline_keyboard: [
                [{ text: "🔗 Pay Securely via Apirone", url: invoiceData["invoice-url"] }],
                [{ text: "🔙 Cancel & Return", callback_data: "menu_profile" }]
            ]
        };
        await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, text, keyboard);
    } catch (e) {
        await editTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, messageId, `❌ Error creating invoice. The payment gateway is temporarily unavailable.`, { inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_topup" }]]});
    }
}

async function processPurchase(userId: number, chatId: number, messageId: number, callbackId: string, productId: string, env: Env): Promise<void> {
    const product = await env.DB.prepare('SELECT title, price_usd FROM products WHERE id = ?').bind(productId).first<{ title: string, price_usd: number }>();
    if (!product) return answerCallback(env.TELEGRAM_BOT_TOKEN, callbackId, "❌ Product not found.", true);

    const deduction = await env.DB.prepare(`
        UPDATE users SET balance_usd = balance_usd - ? 
        WHERE telegram_id = ? AND balance_usd >= ? RETURNING balance_usd
    `).bind(product.price_usd, userId, product.price_usd).first<{ balance_usd: number }>();

    if (!deduction) return answerCallback(env.TELEGRAM_BOT_TOKEN, callbackId, `❌ Insufficient Balance! This costs $${product.price_usd.toFixed(2)}.`, true);

    const asset = await env.DB.prepare(`
        UPDATE digital_assets SET is_sold = 1, sold_to = ?, sold_at = CURRENT_TIMESTAMP 
        WHERE id = (SELECT id FROM digital_assets WHERE product_id = ? AND is_sold = 0 LIMIT 1) 
        RETURNING payload
    `).bind(userId, productId).first<{ payload: string }>();

    if (!asset) {
        await env.DB.prepare(`UPDATE users SET balance_usd = balance_usd + ? WHERE telegram_id = ?`).bind(product.price_usd, userId).run();
        await answerCallback(env.TELEGRAM_BOT_TOKEN, callbackId, `⚠️ Out of Stock! Your $${product.price_usd.toFixed(2)} was instantly refunded.`, true);
        return renderStoreCatalog(chatId, messageId, userId, env);
    }

    // Acknowledge callback with success toast
    await answerCallback(env.TELEGRAM_BOT_TOKEN, callbackId, "✅ Purchase Successful!", false);

    // Refresh the Store Window behind the scenes (Updates balance and stock instantly)
    await renderStoreCatalog(chatId, messageId, userId, env);

    // Send a NEW message containing the secret product data so it stays in chat history
    const deliveryText = `🎉 <b>Purchase Successful!</b>\n\nYou bought: <b>${escapeHTML(product.title)}</b>\nRemaining Balance: $${deduction.balance_usd.toFixed(2)}\n\nHere is your product:\n\n<code>${escapeHTML(asset.payload)}</code>\n\nThank you!`;
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, deliveryText);
}

async function handleApironeCallback(request: Request, env: Env): Promise<void> {
    let update: ApironeCallback;
    try { update = await request.clone().json() as ApironeCallback; } catch (e) { return; }

    const { invoice: invoiceId, status } = update;
    if (!invoiceId || !status) return;

    const invoice = await env.DB.prepare(`
        UPDATE invoices SET status = ? WHERE invoice_id = ? AND status NOT IN ('paid', 'completed') RETURNING telegram_id, usd_amount
    `).bind(status, invoiceId).first<{ telegram_id: number, usd_amount: number }>();

    if (invoice && (status === 'paid' || status === 'completed')) {
        await env.DB.prepare(`UPDATE users SET balance_usd = balance_usd + ? WHERE telegram_id = ?`).bind(invoice.usd_amount, invoice.telegram_id).run();
        const text = `💰 <b>Top-Up Successful!</b>\n\n$${invoice.usd_amount.toFixed(2)} has been added to your account balance.`;
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, invoice.telegram_id, text, { inline_keyboard: [[{ text: "🛍️ Browse Store", callback_data: "menu_products" }]] });
    } else if (status !== 'paid' && status !== 'completed') {
         await env.DB.prepare(`UPDATE invoices SET status = ? WHERE invoice_id = ?`).bind(status, invoiceId).run();
    }
}

// ==========================================
// TELEGRAM CORE UTILITIES
// ==========================================

async function getCachedCryptoRate(cryptoCurrency: string, ctx: ExecutionContext): Promise<number | null> {
    const cacheUrl = new URL(`https://apirone.com/api/v2/ticker?currency=${cryptoCurrency}&fiat=usd`);
    const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
    const cache = caches.default;
    
    let response = await cache.match(cacheKey);
    if (!response) {
        response = await fetch(cacheUrl);
        if (response.ok) {
            const clonedResponse = new Response(response.clone().body, response);
            clonedResponse.headers.append('Cache-Control', 's-maxage=300'); // Cache for 5m
            ctx.waitUntil(cache.put(cacheKey, clonedResponse));
        } else return null;
    }
    const data = await response.json() as any;
    return data[cryptoCurrency]?.usd || null;
}

async function sendTelegramMessage(token: string, chatId: number, text: string, replyMarkup: any = null): Promise<void> {
    const payload: any = { chat_id: chatId, text: text, parse_mode: 'HTML' };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(e => console.error(e));
}

async function editTelegramMessage(token: string, chatId: number, messageId: number, text: string, replyMarkup: any = null): Promise<void> {
    const payload: any = { chat_id: chatId, message_id: messageId, text: text, parse_mode: 'HTML' };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(e => console.error(e));
}

async function answerCallback(token: string, callbackQueryId: string, text?: string, showAlert: boolean = false): Promise<void> {
    const payload: any = { callback_query_id: callbackQueryId };
    if (text) { payload.text = text; payload.show_alert = showAlert; }
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(e => console.error(e));
}

function escapeHTML(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
