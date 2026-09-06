// Unified SQLite Database Client with WAL Mode & Foreign Key Invariants
// Document ID: DEV-ARCH-08

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let globalDb = null;

export function getDatabasePath() {
  return process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../data/ops.db');
}

/**
 * Creates or retrieves the singleton SQLite connection with WAL mode enabled.
 */
export function getDb(customPath = null) {
  if (globalDb && !customPath) {
    return globalDb;
  }

  const dbPath = customPath || getDatabasePath();

  if (dbPath !== ':memory:') {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  const database = new Database(dbPath);

  // Non-negotiable architectural invariants
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');
  database.pragma('synchronous = NORMAL');

  if (!customPath) {
    globalDb = database;
  }

  return database;
}

export function closeDb() {
  if (globalDb) {
    globalDb.close();
    globalDb = null;
  }
}

export default {
  getDb,
  closeDb,
  getDatabasePath
};
