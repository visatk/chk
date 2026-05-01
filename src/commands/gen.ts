import { Env } from "../types";
import { sendMessage } from "../utils/telegram";

// Typings based on the binlist.io API specification
interface BinLookupResponse {
  number?: {
    iin?: string;
    length?: number;
    luhn?: boolean;
  };
  scheme?: string;
  type?: string;
  category?: string;
  country?: {
    alpha2?: string;
    alpha3?: string;
    name?: string;
    emoji?: string;
  };
  bank?: {
    name?: string;
    phone?: string;
    url?: string;
  };
  success?: boolean;
}

/**
 * Advanced Luhn Algorithm Generator
 * Dynamically adjusts to the required card length (e.g., 15 for AMEX, 16 for Visa/MC)
 */
function generateLuhn(bin: string, targetLength: number = 16): string {
  let cc = bin;
  // Generate random digits up to the penultimate position
  while (cc.length < targetLength - 1) {
    cc += Math.floor(Math.random() * 10).toString();
  }
  
  let sum = 0;
  let toggle = true; // Toggle for doubling every second digit from the right
  
  for (let i = cc.length - 1; i >= 0; i--) {
    let digit = parseInt(cc.charAt(i), 10);
    if (toggle) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    toggle = !toggle;
  }
  
  // Calculate the checksum digit
  const checkDigit = (10 - (sum % 10)) % 10;
  return cc + checkDigit;
}

/**
 * Fetches BIN metadata from binlist.io using Cloudflare's native fetch
 */
async function fetchBinData(bin: string): Promise<BinLookupResponse | null> {
  try {
    const response = await fetch(`https://binlist.io/lookup/${bin}/`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "Nexus-Infrastructure-Bot/2.0" // Always provide a UA for public APIs
      }
    });

    if (!response.ok) {
      return null;
    }

    return await response.json<BinLookupResponse>();
  } catch (error) {
    console.error("BIN Lookup Failed:", error);
    return null;
  }
}

export async function handleGen(args: string[], chatId: number, env: Env): Promise<void> {
  if (!args[0]) {
    await sendMessage(env, chatId, "❌ <b>Error:</b> Please provide a valid BIN.\n<i>Example:</i> <code>/gen 601120</code>");
    return;
  }

  const start = Date.now();
  const input = args[0].replace(/[^0-9]/g, ''); // Sanitize input to numbers only
  
  if (input.length < 6) {
    await sendMessage(env, chatId, "❌ <b>Error:</b> BIN must be at least 6 digits.");
    return;
  }

  // Use the first 6 digits for the API lookup
  const lookupBin = input.substring(0, 6);
  const amount = 10; // Default generation amount

  // Fetch real data from the API
  const binData = await fetchBinData(lookupBin);

  // Extract variables with safe fallbacks if the API fails or returns partial data
  const cardLength = binData?.number?.length || 16;
  const scheme = (binData?.scheme || "UNKNOWN").toUpperCase();
  const type = (binData?.type || "UNKNOWN").toUpperCase();
  const bankName = (binData?.bank?.name || "UNKNOWN BANK").toUpperCase();
  const countryName = binData?.country?.name || "Unknown Country";
  const countryEmoji = binData?.country?.emoji || "🏳️";

  let cards = "";
  for (let i = 0; i < amount; i++) {
    // Pass the dynamic card length from the API into the Luhn generator
    const cc = generateLuhn(input, cardLength);
    const mm = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    // Generate an expiry year between current year (e.g., 2026) + 1 to + 6 years
    const yy = String(new Date().getFullYear() + Math.floor(Math.random() * 6) + 1);
    const cvvLength = scheme === "AMEX" ? 4 : 3;
    const cvv = String(Math.floor(Math.random() * (cvvLength === 4 ? 9000 : 900)) + (cvvLength === 4 ? 1000 : 100));
    
    cards += `${cc}|${mm}|${yy}|${cvv}\n`;
  }
  
  const timeTaken = ((Date.now() - start) / 1000).toFixed(3);
  
  // High-fidelity UI format
  const output = `| <b>Amount</b> - ⚡️ ${amount} |
| <b>BIN</b> - ⚡️ ${lookupBin} | <b>Time</b> - ⚡️ ${timeTaken}s ⏱
|————————————|
| <b>Input</b> - ⚡️ ${input} |

<code>${cards}</code>
| <b>Info:</b> ${scheme} - ${type}
| <b>Bank:</b> ${bankName}
| <b>Country:</b> ${countryName} ${countryEmoji}`;

  // Add the interactive Regenerate button matching the V2 router
  const markup = {
    inline_keyboard: [[{ text: "🔄 Regenerate", callback_data: `regen_${input}` }]]
  };

  await sendMessage(env, chatId, output, markup);
}
