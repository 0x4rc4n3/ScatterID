// Users Repository
// Roles: 'clerk', 'mod', 'root'

export function createUsersRepo(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO users (id, username, password_hash, role, station_id, totp_secret, totp_enabled, force_password_reset, created_at, updated_at)
      VALUES (@id, @username, @password_hash, @role, @station_id, @totp_secret, @totp_enabled, @force_password_reset, @created_at, @updated_at)
    `),
    findByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    findById: db.prepare('SELECT * FROM users WHERE id = ?'),
    findByRole: db.prepare('SELECT * FROM users WHERE role = ? ORDER BY created_at ASC'),
    updateTotp: db.prepare(`
      UPDATE users 
      SET totp_secret = @totp_secret, totp_enabled = @totp_enabled, updated_at = @updated_at 
      WHERE id = @id
    `),
    updatePassword: db.prepare(`
      UPDATE users 
      SET password_hash = @password_hash, force_password_reset = @force_password_reset, updated_at = @updated_at 
      WHERE id = @id
    `),
    listAll: db.prepare('SELECT id, username, role, station_id, totp_enabled, force_password_reset, created_at, updated_at FROM users ORDER BY created_at DESC')
  };

  return {
    createUser(user) {
      const now = new Date().toISOString();
      const record = {
        id: user.id,
        username: user.username,
        password_hash: user.password_hash,
        role: user.role,
        station_id: user.station_id || null,
        totp_secret: user.totp_secret || null,
        totp_enabled: user.totp_enabled ? 1 : 0,
        force_password_reset: user.force_password_reset ? 1 : 0,
        created_at: user.created_at || now,
        updated_at: user.updated_at || now
      };
      stmts.insert.run(record);
      return record;
    },

    findByUsername(username) {
      return stmts.findByUsername.get(username) || null;
    },

    findById(id) {
      return stmts.findById.get(id) || null;
    },

    findByRole(role) {
      return stmts.findByRole.all(role);
    },

    updateTotp(id, { totp_secret, totp_enabled }) {
      const now = new Date().toISOString();
      return stmts.updateTotp.run({
        id,
        totp_secret: totp_secret || null,
        totp_enabled: totp_enabled ? 1 : 0,
        updated_at: now
      });
    },

    updatePassword(id, password_hash, force_password_reset = 0) {
      const now = new Date().toISOString();
      return stmts.updatePassword.run({
        id,
        password_hash,
        force_password_reset: force_password_reset ? 1 : 0,
        updated_at: now
      });
    },

    listAll() {
      return stmts.listAll.all();
    }
  };
}
