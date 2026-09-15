// components/ops-dashboard-web/src/authProvider/totp.ts
// Helper utilities for TOTP input formatting and recovery code handling.

export function formatTotpCode(code: string): string {
  return code.replace(/\D/g, '').slice(0, 6);
}

export function isValidTotpFormat(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function formatRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}
