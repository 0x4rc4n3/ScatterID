// ScatterID Ops Migration Runner
// Supports WAL mode, foreign key validation, forward migrations, and rollbacks

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as migration001 from './001_initial_ops_schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Registered migrations in chronological order
export const MIGRATIONS = [
  migration001
];

/**
 * Initializes a SQLite database connection with mandatory WAL mode,
 * foreign key enforcement, and standard busy timeout.
 */
export function initDb(dbPath = null) {
  const targetPath = dbPath || process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../data/ops.db');
  
  // Ensure directory exists if not an in-memory database
  if (targetPath !== ':memory:') {
    const dbDir = path.dirname(targetPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  const db = new Database(targetPath);

  // Non-negotiable architectural invariants: WAL mode & Foreign Keys enabled
  const journalMode = db.pragma('journal_mode = WAL', { simple: true });
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  return { db, targetPath, journalMode };
}

/**
 * Ensures schema_migrations tracking table exists.
 */
export function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

/**
 * Gets all currently applied migration records.
 */
export function getAppliedMigrations(db) {
  ensureMigrationTable(db);
  return db.prepare('SELECT * FROM schema_migrations ORDER BY id ASC').all();
}

/**
 * Runs all pending migrations forward.
 */
export function migrateUp(db) {
  ensureMigrationTable(db);
  const applied = getAppliedMigrations(db);
  const appliedVersions = new Set(applied.map(m => m.version));

  const results = [];

  for (const mig of MIGRATIONS) {
    if (!appliedVersions.has(mig.version)) {
      // Execute migration and record tracking in a single atomic transaction
      const runTx = db.transaction(() => {
        mig.up(db);
        const timestamp = new Date().toISOString();
        db.prepare(`
          INSERT INTO schema_migrations (version, name, applied_at)
          VALUES (?, ?, ?)
        `).run(mig.version, mig.name, timestamp);
      });

      runTx();
      results.push({ version: mig.version, name: mig.name, status: 'APPLIED' });
    } else {
      results.push({ version: mig.version, name: mig.name, status: 'ALREADY_APPLIED' });
    }
  }

  return results;
}

/**
 * Rolls back the latest applied migration.
 */
export function migrateDown(db) {
  ensureMigrationTable(db);
  const applied = getAppliedMigrations(db);
  if (applied.length === 0) {
    return { status: 'NO_MIGRATIONS_TO_ROLLBACK' };
  }

  const latest = applied[applied.length - 1];
  const mig = MIGRATIONS.find(m => m.version === latest.version);

  if (!mig) {
    throw new Error(`Migration definition not found for version ${latest.version}`);
  }

  const runTx = db.transaction(() => {
    mig.down(db);
    db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(latest.version);
  });

  runTx();

  return { version: latest.version, name: latest.name, status: 'ROLLED_BACK' };
}

/**
 * CLI Entry point
 */
if (process.argv[1] === __filename) {
  const command = process.argv[2] || 'up';
  const { db, targetPath, journalMode } = initDb();

  console.log(`[ScatterID Migrations] Connected to: ${targetPath}`);
  console.log(`[ScatterID Migrations] Journal Mode: ${journalMode}`);

  try {
    if (command === 'up') {
      const results = migrateUp(db);
      console.log('[ScatterID Migrations] Migration results:');
      console.table(results);
    } else if (command === 'down') {
      const result = migrateDown(db);
      console.log('[ScatterID Migrations] Rollback result:');
      console.log(result);
    } else if (command === 'status') {
      const applied = getAppliedMigrations(db);
      console.log('[ScatterID Migrations] Applied migrations:');
      console.table(applied);
    } else {
      console.error(`Unknown command: ${command}. Use "up", "down", or "status".`);
      process.exit(1);
    }
  } catch (err) {
    console.error('[ScatterID Migrations] Error:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}
