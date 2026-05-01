import { Env } from "../types";
import { sendMessage } from "../utils/telegram";

// Supported nationalities by randomuser.me API
const supportedNats = [
  'au', 'br', 'ca', 'ch', 'de', 'dk', 'es', 'fi', 'fr', 'gb', 
  'ie', 'in', 'ir', 'mx', 'nl', 'no', 'nz', 'rs', 'tr', 'ua', 'us'
];

// Map inputs to emoji flags for the UI
const flagMap: Record<string, string> = {
  us: '🇺🇸', uk: '🇬🇧', gb: '🇬🇧', ca: '🇨🇦', au: '🇦🇺', 
  de: '🇩🇪', fr: '🇫🇷', it: '🇮🇹', es: '🇪🇸', mx: '🇲🇽',
  br: '🇧🇷', ru: '🇷🇺', jp: '🇯🇵', cn: '🇨🇳', in: '🇮🇳', 
  bd: '🇧🇩', za: '🇿🇦', ng: '🇳🇬', nl: '🇳🇱', se: '🇸🇪',
  ch: '🇨🇭', dk: '🇩🇰', fi: '🇫🇮', ie: '🇮🇪', ir: '🇮🇷',
  no: '🇳🇴', nz: '🇳🇿', rs: '🇷🇸', tr: '🇹🇷', ua: '🇺🇦'
};

export async function handleFake(args: string[], chatId: number, env: Env): Promise<void> {
  // Default to US if no argument is provided
  let inputCode = (args[0] || "us").toLowerCase();
  
  // Normalize 'uk' to 'gb' as randomuser.me uses 'gb'
  if (inputCode === 'uk') inputCode = 'gb';

  // Check if nationality is supported, otherwise fallback to 'us'
  const nat = supportedNats.includes(inputCode) ? inputCode : 'us';
  const flag = flagMap[inputCode] || flagMap[nat] || '🏳️';

  try {
    // Fetch data from randomuser.me using Cloudflare's native fetch
    const response = await fetch(`https://randomuser.me/api/?nat=${nat}`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Nexus-Infrastructure-Bot/2.0"
      }
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json<{ results: any[] }>();
    const user = data.results[0];

    // Extract and format variables
    const name = `${user.name.first} ${user.name.last}`;
    const gender = user.gender.charAt(0).toUpperCase() + user.gender.slice(1);
    const street = `${user.location.street.number} ${user.location.street.name}`;
    const city = user.location.city;
    const state = user.location.state;
    // Ensure zip is treated as a string to avoid numeric truncation
    const zip = String(user.location.postcode);
    const country = user.location.country;
    const phone = user.phone;

    // Exact match to the requested UI, with <code> tags added to values for tap-to-copy
    const output = `📍 <b>Address For ${flag} ${country}</b>
———————————————
• <b>Name</b> : <code>${name}</code>
• <b>Gender</b> : ${gender}
• <b>Street Address</b> : <code>${street}</code>
• <b>City/Town/Village</b> : <code>${city}</code>
• <b>State</b> : <code>${state}</code>
• <b>Postal Code</b> : <code>${zip}</code>
• <b>Country</b> : ${country}
• <b>Phone</b> : <code>${phone}</code>
———————————————`;

    // Add the regenerate button 
    const markup = {
      inline_keyboard: [
        [{ text: `🔄 Regenerate ${inputCode.toUpperCase()}`, callback_data: `fake_${inputCode}` }]
      ]
    };

    await sendMessage(env, chatId, output, markup);

  } catch (error) {
    console.error("RandomUser API Error:", error);
    await sendMessage(env, chatId, "❌ <b>Error:</b> Could not generate data for this region. Please try again.");
  }
}
