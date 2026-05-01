import { Env } from "../types";
import { sendMessage, editMessage } from "../utils/telegram";

const DASHBOARD_TEXT = `⚡️ <b>Nexus Infrastructure Hub</b> ⚡️
———————————————
Welcome to the premium suite. Select a tool below to view its usage instructions, or type a command directly.

<i>System Status:</i> 🟢 <b>Online</b>
<i>Latency:</i> ⚡️ 12ms`;

const DASHBOARD_MENU = {
  inline_keyboard: [
    [{ text: "💳 CC Generator", callback_data: "menu_gen" }, { text: "📍 Fake Address", callback_data: "menu_fake" }],
    [{ text: "🔍 Auth Check", callback_data: "menu_chk" }, { text: "🛡 VBV Lookup", callback_data: "menu_vbv" }],
    [{ text: "👨‍💻 Developer API", url: "https://developers.cloudflare.com" }]
  ]
};

export async function handleStart(chatId: number, env: Env): Promise<void> {
  await sendMessage(env, chatId, DASHBOARD_TEXT, DASHBOARD_MENU);
}

// Handles the button clicks to update the dashboard dynamically
export async function handleMenuCallback(action: string, chatId: number, messageId: number, env: Env): Promise<void> {
  let text = "";
  
  switch(action) {
    case "menu_gen":
      text = `💳 <b>CC Generator Tool</b>\n———————————————\nGenerates test PANs based on BIN using the Luhn algorithm.\n\n<b>Usage:</b>\n<code>/gen 515462</code>`;
      break;
    case "menu_fake":
      text = `📍 <b>Fake Address Generator</b>\n———————————————\nGenerates localized realistic identities.\n\n<b>Usage:</b>\n<code>/fake us</code> (United States)\n<code>/fake uk</code> (United Kingdom)`;
      break;
    case "menu_chk":
      text = `🔍 <b>Auth Checker (Mock)</b>\n———————————————\nSimulates a gateway authorization.\n\n<b>Usage:</b>\n<code>/chk 515462...|12|25|123</code>`;
      break;
    case "menu_vbv":
      text = `🛡 <b>VBV Lookup (Mock)</b>\n———————————————\nChecks 3D Secure / VBV status.\n\n<b>Usage:</b>\n<code>/vbv 515462...|12|25|123</code>`;
      break;
  }

  const backMarkup = {
    inline_keyboard: [[{ text: "🔙 Back to Dashboard", callback_data: "menu_main" }]]
  };

  await editMessage(env, chatId, messageId, text, backMarkup);
}

export async function restoreDashboard(chatId: number, messageId: number, env: Env): Promise<void> {
  await editMessage(env, chatId, messageId, DASHBOARD_TEXT, DASHBOARD_MENU);
}
