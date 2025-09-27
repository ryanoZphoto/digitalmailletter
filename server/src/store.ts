import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// In ESM, __dirname is not defined. Derive it from import.meta.url so the
// data directory is deterministic and tied to the server package location.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readJobs() {
  ensureDir();
  try {
    const raw = fs.readFileSync(JOBS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function writeJobs(jobs: any[]) {
  ensureDir();
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf8');
}

export function readConfig() {
  ensureDir();
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return null; }
}

export function writeConfig(cfg: any) {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}
