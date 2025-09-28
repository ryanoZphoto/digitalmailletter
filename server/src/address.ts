import countries from 'i18n-iso-countries';

export async function initCountries() {
  // Dynamically import the locale with an import assertion so Node ESM accepts it
  const enModule = await import('i18n-iso-countries/langs/en.json', { assert: { type: 'json' } });
  countries.registerLocale(enModule.default as any);
}

export function toAlpha2(input?: string) {
  if (!input) return undefined;
  const s = String(input).trim();
  if (!s) return undefined;
  // Already alpha-2?
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();

  // Try alpha-3 -> alpha-2
  if (/^[A-Za-z]{3}$/.test(s)) {
    const alpha2 = countries.alpha3ToAlpha2(s.toUpperCase());
    if (alpha2) return alpha2;
  }

  // Try full country name -> alpha2
  const alpha2FromName = countries.getAlpha2Code(s, 'en');
  if (alpha2FromName) return alpha2FromName;

  // Not recognized
  return undefined;
}

// US State code normalization for Lob API
export function normalizeUSState(state?: string): string | undefined {
  if (!state) return undefined;
  const s = String(state).trim();
  if (!s) return undefined;

  // US State codes and names mapping
  const stateMap: { [key: string]: string } = {
    // 2-letter codes
    'AL': 'AL', 'AK': 'AK', 'AZ': 'AZ', 'AR': 'AR', 'CA': 'CA', 'CO': 'CO', 'CT': 'CT', 'DE': 'DE',
    'FL': 'FL', 'GA': 'GA', 'HI': 'HI', 'ID': 'ID', 'IL': 'IL', 'IN': 'IN', 'IA': 'IA', 'KS': 'KS',
    'KY': 'KY', 'LA': 'LA', 'ME': 'ME', 'MD': 'MD', 'MA': 'MA', 'MI': 'MI', 'MN': 'MN', 'MS': 'MS',
    'MO': 'MO', 'MT': 'MT', 'NE': 'NE', 'NV': 'NV', 'NH': 'NH', 'NJ': 'NJ', 'NM': 'NM', 'NY': 'NY',
    'NC': 'NC', 'ND': 'ND', 'OH': 'OH', 'OK': 'OK', 'OR': 'OR', 'PA': 'PA', 'RI': 'RI', 'SC': 'SC',
    'SD': 'SD', 'TN': 'TN', 'TX': 'TX', 'UT': 'UT', 'VT': 'VT', 'VA': 'VA', 'WA': 'WA', 'WV': 'WV',
    'WI': 'WI', 'WY': 'WY', 'DC': 'DC',

    // Full state names
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
    'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
    'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
    'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD', 'MASSACHUSETTS': 'MA',
    'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO', 'MONTANA': 'MT',
    'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM',
    'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
    'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
    'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY',
    'DISTRICT OF COLUMBIA': 'DC'
  };

  const upperState = s.toUpperCase();
  return stateMap[upperState];
}

export function validateAddressFields(addr: any) {
  // Expect an object with address_line1, address_city, address_state, address_zip, address_country
  const required = ['address_line1','address_city','address_state','address_zip','address_country'];
  for (const k of required) {
    if (!addr || typeof addr[k] !== 'string' || !addr[k].trim()) return { ok: false, missing: k };
  }
  const country = toAlpha2(addr.address_country);
  if (!country) return { ok: false, missing: 'address_country', reason: 'invalid' };

  // For US addresses, validate state
  if (country === 'US') {
    const normalizedState = normalizeUSState(addr.address_state);
    if (!normalizedState) return { ok: false, missing: 'address_state', reason: 'invalid' };
    // Update the address with normalized state
    addr.address_state = normalizedState;
  }

  return { ok: true, country };
}

export default { toAlpha2, normalizeUSState, validateAddressFields };
