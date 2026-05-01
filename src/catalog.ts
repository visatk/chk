export interface Product {
  id: string;
  name: string;
  price: number;
  bulkPrice?: number;
  warranty: string;
  notes?: string;
}

export const CATEGORIES = {
  ai: {
    title: "🤖 AI & LLMs",
    products: [
      { id: "grok_y", name: "🥇 Super Grok Yearly", price: 45.0, warranty: "Full Warranty" },
      { id: "grok_30", name: "🥈 Super Grok 30 Days", price: 4.5, warranty: "Full Warranty" },
      { id: "gem_18m", name: "➡️ Gemini Pro 18 Months", price: 6.0, warranty: "No CC Needed for Activation" },
      { id: "gem_12m_pv", name: "🔈 Gemini Pro 12M Pixel Ver.", price: 1.0, warranty: "Pixel Verification" },
      { id: "gem_12m_pvp", name: "☄️ Gemini Pro 12M Pixel Ver.+Payout", price: 1.8, warranty: "Pixel Verification + Payout" },
      { id: "gem_12m_rdm", name: "🎙 Gemini Pro 12M Readymade", price: 2.5, warranty: "Complete Readymade Account" },
      { id: "eleven_c", name: "😍 Eleven Labs Account (Creator)", price: 5.5, warranty: "131k Credits" },
      { id: "eleven_gc", name: "😘 Eleven Labs Gift Code (Creator)", price: 4.5, warranty: "100k Credits" },
    ]
  },
  video: {
    title: "🎬 Video Editing & Media",
    products: [
      { id: "cp_35d", name: "🥉 Capcut Pro 35 Days Team Auto", price: 0.6, bulkPrice: 0.5, warranty: "Trial Renewal", notes: "Login from 2 devices. Bulk $0.5 (order 10+)" },
      { id: "cp_180d", name: "😍 Capcut Pro 180 Days Team Auto", price: 3.5, warranty: "Full Warranty", notes: "Login from 2 devices." },
      { id: "cp_6m_p", name: "☄️ Capcut Pro 6 Months Personal", price: 10.0, warranty: "Full Warranty", notes: "Login from 2 devices." },
      { id: "cp_365d", name: "🛡 Capcut Pro 365 Days Team Auto", price: 6.0, warranty: "Full Warranty", notes: "Login from 2 devices." },
      { id: "veo3_25k", name: "✔️ VEO3 Ultra 25K Credits", price: 2.0, warranty: "24 Hours Warranty" },
    ]
  },
  utils: {
    title: "🛡 Utilities & VPN",
    products: [
      { id: "surf_30d", name: "😀 Surfshark VPN 30 Days", price: 1.0, warranty: "30 Days Validity", notes: "Personal use for 1 device" },
    ]
  }
};

// Helper to find a product by ID
export const getProductById = (id: string): Product | undefined => {
  for (const cat of Object.values(CATEGORIES)) {
    const found = cat.products.find(p => p.id === id);
    if (found) return found;
  }
  return undefined;
};
