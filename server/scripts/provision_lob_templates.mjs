// Create minimal real Lob templates via API and write their IDs to data/config.json
// Requirements: LOB_API_KEY in env; will create:
// - Letter template (file)
// - Postcard templates (front/back)
// - Self-mailer templates (inside/outside)

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'config.json');

const BASE = 'https://api.lob.com/v1';
const KEY = process.env.LOB_API_KEY;
if (!KEY) {
  console.error('LOB_API_KEY not set.');
  process.exit(1);
}

async function createTemplate(name, html) {
  const res = await fetch(`${BASE}/templates`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${KEY}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    // Some accounts disallow arbitrary name field on templates; only pass html
    body: JSON.stringify({ html }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Create template failed: ${res.status} ${JSON.stringify(json)}`);
  return json.id; // tmpl_...
}

const letterHTML = `<html><body style="margin:0.5in;font-family:Arial,sans-serif"><div style="height:4.25in"></div><h1 style="margin:0 0 8px 0;font-size:18px">{{subject}}</h1><div style="font-size:12px;line-height:1.5">{{{body}}}</div><hr style="margin:.2in 0"/><div style="font-size:11px">From: {{sender.name}}</div><div style="font-size:11px">To: {{recipient.name}}</div></body></html>`;
const postcardFront = `<html><body style="margin:36px;font-family:Arial,sans-serif"><h1>{{headline}}</h1><p>{{subheadline}}</p></body></html>`;
const postcardBack = `<html><body style="margin:36px;font-family:Arial,sans-serif"><p>{{body}}</p><p>{{cta_text}}</p></body></html>`;
const selfInside = `<html><body style="margin:36px;font-family:Arial,sans-serif"><h2>{{headline}}</h2><p>{{body}}</p></body></html>`;
const selfOutside = `<html><body style="margin:36px;font-family:Arial,sans-serif"><h3>{{subheadline}}</h3></body></html>`;

async function main() {
  console.log('Creating Lob templates...');
  const ids = {
    letter: await createTemplate('MMF Letter', letterHTML),
    formal: await createTemplate('MMF Letter Formal', letterHTML),
    invoice: await createTemplate('MMF Letter Invoice', letterHTML),
    personal: await createTemplate('MMF Letter Personal', letterHTML),
    pcFront: await createTemplate('MMF Postcard Front', postcardFront),
    pcBack: await createTemplate('MMF Postcard Back', postcardBack),
    smInside: await createTemplate('MMF SelfMailer Inside', selfInside),
    smOutside: await createTemplate('MMF SelfMailer Outside', selfOutside),
  };

  const raw = await fs.readFile(DATA, 'utf8');
  const cfg = JSON.parse(raw || '{}');
  for (const t of cfg.templates || []) {
    if (t.id === 'tpl-default') t.lob = { file: ids.letter };
    if (t.id === 'tpl-formal') t.lob = { file: ids.formal };
    if (t.id === 'tpl-invoice') t.lob = { file: ids.invoice };
    if (t.id === 'tpl-personal') t.lob = { file: ids.personal };
    if (t.id === 'tpl-postcard') t.lob = { front: ids.pcFront, back: ids.pcBack };
    if (t.id === 'tpl-self-mailer') t.lob = { inside: ids.smInside, outside: ids.smOutside };
  }
  await fs.writeFile(DATA, JSON.stringify(cfg, null, 2), 'utf8');
  console.log('Updated config with real template IDs.');
}

main().catch(e => { console.error(e); process.exit(1); });


