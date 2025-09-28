import fetch from 'node-fetch';
import dotenv from 'dotenv';
import FormData from 'form-data';
import { toAlpha2 } from '../address.js';

dotenv.config();

const LOB_API_KEY = process.env.LOB_API_KEY;
const LOB_MODE = (process.env.LOB_MODE || 'live').toLowerCase();

if (!LOB_API_KEY) {
  console.warn('LOB_API_KEY not set — Lob provider will not be available');
}

const BASE = 'https://api.lob.com/v1';

type Address = {
  name?: string;
  company?: string;
  address_line1: string;
  address_line2?: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country: string;
};

type LobResponse = { id?: string; status?: string; [k: string]: any };

export async function sendLetterPDF({
  to,
  from,
  pdfBuffer,
  description,
}: {
  to: Address;
  from: Address;
  pdfBuffer: Buffer;
  description?: string;
}) {
  if (!LOB_API_KEY) throw new Error('LOB_API_KEY not configured');

  // If running in test mode, don't call the real Lob API — return a fake success.
  if (LOB_MODE === 'test') {
    // lightweight test response so workers can run end-to-end locally
    return {
      provider: 'lob',
      id: `test-${Date.now()}`,
      status: 'delivered',
      raw: { mode: 'test', to, from, description: description || 'test' },
    } as const;
  }

  const form = new FormData();

  const addAddr = (prefix: string, a: Address) => {
    // Normalize country
    if ((a as any).address_country) {
      const c = toAlpha2((a as any).address_country as any);
      if (c) (a as any).address_country = c;
    }
    if (a.name) form.append(`${prefix}[name]`, a.name);
    if (a.company) form.append(`${prefix}[company]`, a.company);
    form.append(`${prefix}[address_line1]`, a.address_line1);
    if (a.address_line2) form.append(`${prefix}[address_line2]`, a.address_line2 || '');
    form.append(`${prefix}[address_city]`, a.address_city);
    form.append(`${prefix}[address_state]`, a.address_state);
    form.append(`${prefix}[address_zip]`, a.address_zip);
    form.append(`${prefix}[address_country]`, a.address_country);
  };

  addAddr('to', to);
  addAddr('from', from);

  form.append('description', description || 'Mail My Forms letter');

  // Lob requires a 'color' parameter (true/false). Default to true for full-color print.
  // Use string values because form-data serializes them as fields.
  form.append('color', process.env.LOB_DEFAULT_COLOR || 'true');

  // Lob requires a 'use_type' parameter - must be "marketing" or "operational"
  form.append('use_type', 'operational');

  // 'file' is a Node Buffer
  form.append('file', pdfBuffer, { filename: 'letter.pdf', contentType: 'application/pdf' });

  const res = await fetch(`${BASE}/letters`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${LOB_API_KEY}:`).toString('base64')}`,
      // Note: form.getHeaders() will be merged by node-fetch if needed when using form-data, but
      // node-fetch doesn't automatically merge, so pass form headers explicitly
      ...form.getHeaders(),
    },
    body: form as any,
  });

  const json = (await res.json()) as LobResponse;
  if (!res.ok) {
    const err = new Error(`Lob API error: ${res.status} ${JSON.stringify(json)}`);
    (err as any).status = res.status;
    (err as any).body = json;
    throw err;
  }

  return {
    provider: 'lob',
    id: json.id,
    status: json.status || 'submitted',
    raw: json,
  } as const;
}

export default { sendLetterPDF };
