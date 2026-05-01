export class ApironeService {
  private readonly baseUrl = 'https://apirone.com/api/v2';

  constructor(private accountId: string, private cache: KVNamespace) {}

  async getExchangeRate(currency: string): Promise<number> {
    const cacheKey = `rate_${currency}`;
    const cachedRate = await this.cache.get(cacheKey);
    
    if (cachedRate) return parseFloat(cachedRate);

    const res = await fetch(`${this.baseUrl}/ticker?currency=${currency}&fiat=usd`);
    if (!res.ok) throw new Error('Failed to fetch Apirone ticker');
    
    const data = await res.json() as any;
    const rate = data.usd;

    // Cache the rate for 5 minutes (300 seconds)
    await this.cache.put(cacheKey, rate.toString(), { expirationTtl: 300 });
    return rate;
  }

  calculateMinorUnits(usdAmount: number, rate: number, currency: string): number {
    const cryptoAmount = usdAmount / rate;
    const multiplier = currency.includes('trx') || currency.includes('eth') ? 1e6 : 1e8; 
    return Math.ceil(cryptoAmount * multiplier);
  }

  async createInvoice(params: {
    amount: number;
    currency: string;
    callbackUrl: string;
    orderId: string;
    productName: string;
  }) {
    const payload = {
      amount: params.amount,
      currency: params.currency,
      lifetime: 3600,
      "callback-url": params.callbackUrl,
      "user-data": {
        title: `Order #${params.orderId}`,
        merchant: "RavenHQ",
        items: [{ name: params.productName, cost: "0", qty: 1, total: "0" }]
      }
    };

    const res = await fetch(`${this.baseUrl}/accounts/${this.accountId}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`Apirone Invoice Error: ${await res.text()}`);
    return (await res.json()) as any;
  }
}
