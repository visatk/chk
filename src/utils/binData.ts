export interface BinNetwork {
  name: string;
  regex: RegExp;
  lengths: number[];
  active: boolean;
}

/**
 * High-level routing map for BIN networks based on official ranges.
 * Inactive networks (Laser, Switch, Bankcard, Solo) are marked as active: false.
 */
export const NETWORKS: BinNetwork[] = [
  { name: 'American Express', regex: /^3[47]/, lengths: [15], active: true },
  { name: 'Bankcard', regex: /^(5610|56022[1-5])/, lengths: [16], active: false },
  { name: 'China UnionPay', regex: /^62/, lengths: [16, 17, 18, 19], active: true },
  { name: 'Diners Club Carte Blanche', regex: /^30[0-5]/, lengths: [14], active: true },
  { name: 'Diners Club International', regex: /^36/, lengths: [14], active: true },
  { name: 'Diners Club US/Canada', regex: /^5[45]/, lengths: [16], active: true },
  { name: 'Discover', regex: /^(6011|62212[6-9]|6221[3-9][0-9]|622[2-8][0-9]{2}|6229[0-1][0-9]|62292[0-5]|64[4-9]|65)/, lengths: [16], active: true },
  { name: 'JCB', regex: /^(352[89]|35[3-8][0-9])/, lengths: [16], active: true },
  { name: 'Laser', regex: /^(6304|6706|6771|6709)/, lengths: [16, 17, 18, 19], active: false },
  { name: 'Maestro', regex: /^(50|5[6-8]|6)/, lengths: [12, 13, 14, 15, 16, 17, 18, 19], active: true },
  { name: 'MasterCard', regex: /^(5[1-5]|222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)/, lengths: [16], active: true },
  { name: 'Solo', regex: /^(6334|6767)/, lengths: [16, 18, 19], active: false },
  { name: 'Switch', regex: /^(4903|4905|4911|4936|564182|633110|6333|6759)/, lengths: [16, 18, 19], active: false },
  { name: 'Visa', regex: /^4/, lengths: [13, 16, 19], active: true }
];

export function getNetworkInfo(bin: string): BinNetwork | null {
  for (const network of NETWORKS) {
    if (network.regex.test(bin)) {
      return network;
    }
  }
  return null;
}
