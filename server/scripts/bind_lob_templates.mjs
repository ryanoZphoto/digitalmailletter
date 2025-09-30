// Bind existing Lob template IDs from environment into data/config.json
// Expected env vars (set whichever you have):
// LETTER: LOB_TPL_LETTER, LOB_TPL_FORMAL, LOB_TPL_INVOICE, LOB_TPL_PERSONAL
// POSTCARD: LOB_TPL_PC_FRONT, LOB_TPL_PC_BACK
// SELF-MAILER: LOB_TPL_SM_INSIDE, LOB_TPL_SM_OUTSIDE

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG = path.join(__dirname, '..', '..', 'data', 'config.json');

function env(name) { return process.env[name]; }

async function main(){
  const raw = await fs.readFile(CONFIG, 'utf8').catch(async () => '{"templates":[],"serviceLevels":[]}');
  const cfg = JSON.parse(raw || '{}');
  cfg.templates = cfg.templates || [];
  const index = new Map(cfg.templates.map(t => [t.id, t]));
  function ensure(t){ if(!index.has(t.id)){ cfg.templates.push(t); index.set(t.id, t);} return index.get(t.id); }

  const defaults = [
    { id: 'tpl-default', name:'Standard Business Letter', category:'Letters', thumbnail:'/templates/tpl-default.svg'},
    { id: 'tpl-formal', name:'Formal/Legal Notice', category:'Letters', thumbnail:'/templates/tpl-formal.svg'},
    { id: 'tpl-invoice', name:'Invoice/Billing', category:'Letters', thumbnail:'/templates/tpl-invoice.svg'},
    { id: 'tpl-personal', name:'Personal Correspondence', category:'Letters', thumbnail:'/templates/tpl-personal.svg'},
    { id: 'tpl-postcard', name:'Postcard 4x6', category:'Postcards', thumbnail:'/templates/tpl-postcard.svg'},
    { id: 'tpl-self-mailer', name:'Self‑Mailer (Tri‑Fold)', category:'Self-Mailers', thumbnail:'/templates/tpl-self-mailer.svg'}
  ];
  for (const t of defaults) ensure({ ...t });

  const map = {
    'tpl-default': env('LOB_TPL_LETTER'),
    'tpl-formal': env('LOB_TPL_FORMAL'),
    'tpl-invoice': env('LOB_TPL_INVOICE'),
    'tpl-personal': env('LOB_TPL_PERSONAL'),
  };
  const pcFront = env('LOB_TPL_PC_FRONT');
  const pcBack = env('LOB_TPL_PC_BACK');
  const smInside = env('LOB_TPL_SM_INSIDE');
  const smOutside = env('LOB_TPL_SM_OUTSIDE');

  for (const [id, val] of Object.entries(map)){
    if (val && /^tmpl_/.test(val)){
      const t = index.get(id);
      t.lob = { file: val };
      t.comingSoon = false;
    }
  }
  if (pcFront && pcBack){ const t = index.get('tpl-postcard'); t.lob = { front: pcFront, back: pcBack }; t.comingSoon = false; }
  if (smInside && smOutside){ const t = index.get('tpl-self-mailer'); t.lob = { inside: smInside, outside: smOutside }; t.comingSoon = false; }

  await fs.writeFile(CONFIG, JSON.stringify(cfg, null, 2), 'utf8');
  console.log('Bound Lob template IDs into config.');
}

main().catch(e => { console.error(e); process.exit(1); });


