// Migration 002: Commitment-only claimant intake and issued-credential receipt support.
export const version = '002';
export const name = 'commitment_only_issuance';

export function up(db) {
  const cols = new Set(db.prepare('PRAGMA table_info(requests)').all().map(column => column.name));
  if (!cols.has('data_hash')) db.exec('ALTER TABLE requests ADD COLUMN data_hash TEXT DEFAULT NULL');
  if (!cols.has('claimant_receipt_token_hash')) db.exec('ALTER TABLE requests ADD COLUMN claimant_receipt_token_hash TEXT DEFAULT NULL');
  if (!cols.has('issuance_receipt_json')) db.exec('ALTER TABLE requests ADD COLUMN issuance_receipt_json TEXT DEFAULT NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_receipt_token_hash ON requests(claimant_receipt_token_hash) WHERE claimant_receipt_token_hash IS NOT NULL');
}

export function down(db) {
  db.exec('DROP INDEX IF EXISTS idx_requests_receipt_token_hash');
  // SQLite column drops require rebuilding the table; retain additive columns on rollback.
}
