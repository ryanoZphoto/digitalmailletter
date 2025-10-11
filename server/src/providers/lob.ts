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

// --- Template-based sending (Letters, Postcards, Self‑Mailers) ---

type SendViaTemplateArgs = {
  resource: 'letters' | 'postcards' | 'self_mailers';
  to: Address;
  from: Address;
  // Letters: file -> tmpl_id; Postcards: front/back tmpl_id; Self-Mailers: inside/outside tmpl_id
  template?: { file?: string };
  postcardTemplates?: { front: string; back: string };
  selfMailerTemplates?: { inside: string; outside: string };
  mergeVariables?: Record<string, any>;
  useType?: 'marketing' | 'operational';
  color?: boolean;
  doubleSided?: boolean;
  mailType?: 'usps_first_class' | 'usps_standard';
  // Optional layout/production controls
  size?: string; // postcards: '4x6' | '6x9' | '6x11'; self_mailers: '6x18_bifold' | '11x9_bifold' | '12x9_bifold'
  extraService?: string;
  description?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
};

export async function sendViaTemplate(args: SendViaTemplateArgs) {
  if (!LOB_API_KEY) throw new Error('LOB_API_KEY not configured');

  if (LOB_MODE === 'test') {
    return {
      provider: 'lob',
      id: `test-${Date.now()}`,
      status: 'rendered',
      raw: { mode: 'test', ...args },
    } as const;
  }

  const { resource, to, from, template, postcardTemplates, selfMailerTemplates } = args;

  const body: any = {
    to,
    from,
    use_type: args.useType || 'operational',
    metadata: args.metadata || {},
  };

  if (resource === 'letters') {
    // For letters, pass file as tmpl_id
    if (!template?.file) throw new Error('letters: template.file (tmpl_id) required');
    body.file = template.file; // tmpl_...
    body.color = String(args.color ?? true);
    body.double_sided = String(args.doubleSided ?? false);
    body.mail_type = args.mailType || 'usps_first_class';
    // Ensure Lob places address block at top of first page
    body.address_placement = 'top_first_page';
    if (args.mergeVariables) body.merge_variables = args.mergeVariables;
  } else if (resource === 'postcards') {
    if (!postcardTemplates?.front || !postcardTemplates?.back) throw new Error('postcards: front/back tmpl_id required');
    body.front = postcardTemplates.front;
    body.back = postcardTemplates.back;
    body.mail_type = args.mailType || 'usps_first_class';
    if (args.size) body.size = args.size; else body.size = '4x6';
    if (args.mergeVariables) body.merge_variables = args.mergeVariables;
  } else if (resource === 'self_mailers') {
    if (!selfMailerTemplates?.inside || !selfMailerTemplates?.outside) throw new Error('self_mailers: inside/outside tmpl_id required');
    body.inside = selfMailerTemplates.inside;
    body.outside = selfMailerTemplates.outside;
    body.mail_type = args.mailType || 'usps_first_class';
    if (args.size) body.size = args.size; // default handled by Lob if omitted
    if (args.mergeVariables) body.merge_variables = args.mergeVariables;
  }

  if (args.description) body.description = args.description;

  const headers: any = {
    Authorization: `Basic ${Buffer.from(`${LOB_API_KEY}:`).toString('base64')}`,
    'Content-Type': 'application/json',
  };
  if (args.idempotencyKey) headers['Idempotency-Key'] = args.idempotencyKey;

  const res = await fetch(`${BASE}/${resource}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
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

export const lobProvider = { sendLetterPDF, sendViaTemplate };
export { Address };

// --- Inline HTML sending (no saved templates) ---
type SendInlineArgs = {
  resource: 'letters' | 'postcards' | 'self_mailers';
  to: Address;
  from: Address;
  letterHtml?: string;
  postcardFrontHtml?: string;
  postcardBackHtml?: string;
  selfInsideHtml?: string;
  selfOutsideHtml?: string;
  color?: boolean;
  doubleSided?: boolean;
  mailType?: 'usps_first_class' | 'usps_standard';
  description?: string;
  idempotencyKey?: string;
};

export async function sendInline(args: SendInlineArgs) {
  if (!LOB_API_KEY) throw new Error('LOB_API_KEY not configured');
  if (LOB_MODE === 'test') {
    return { provider: 'lob', id: `test-${Date.now()}`, status: 'rendered', raw: { mode: 'test', ...args } } as const;
  }
  const { resource, to, from } = args;
  const body: any = { to, from, use_type: 'operational' };
  if (resource === 'letters') {
    if (!args.letterHtml) throw new Error('letters: letterHtml required');
    body.file = args.letterHtml; // HTML string allowed
    body.color = String(args.color ?? true);
    body.double_sided = String(args.doubleSided ?? false);
    body.mail_type = args.mailType || 'usps_first_class';
    // Ensure address is printed in a reserved top area
    body.address_placement = 'top_first_page';
  } else if (resource === 'postcards') {
    if (!args.postcardFrontHtml || !args.postcardBackHtml) throw new Error('postcards: front/back HTML required');
    body.front = args.postcardFrontHtml;
    body.back = args.postcardBackHtml;
    body.mail_type = args.mailType || 'usps_first_class';
  } else if (resource === 'self_mailers') {
    if (!args.selfInsideHtml || !args.selfOutsideHtml) throw new Error('self_mailers: inside/outside HTML required');
    body.inside = args.selfInsideHtml;
    body.outside = args.selfOutsideHtml;
    body.mail_type = args.mailType || 'usps_first_class';
  }
  if (args.description) body.description = args.description;
  const headers: any = { Authorization: `Basic ${Buffer.from(`${LOB_API_KEY}:`).toString('base64')}`, 'Content-Type': 'application/json' };
  if (args.idempotencyKey) headers['Idempotency-Key'] = args.idempotencyKey;
  const res = await fetch(`${BASE}/${resource}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = (await res.json()) as LobResponse;
  if (!res.ok) { const err = new Error(`Lob API error: ${res.status} ${JSON.stringify(json)}`); (err as any).status = res.status; (err as any).body = json; throw err; }
  return { provider: 'lob', id: json.id, status: json.status || 'submitted', raw: json } as const;
}

export const lobInline = { sendInline };
