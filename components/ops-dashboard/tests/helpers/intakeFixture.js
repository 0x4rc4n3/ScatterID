let sequence = 0;

export function commitmentFields() {
  sequence += 1;
  return {
    data_hash: sequence.toString(16).padStart(64, '0'),
    claimant_receipt_token: (sequence + 1000).toString(16).padStart(64, '0')
  };
}

export const mockLedgerExecutor = {
  async executeIssuance(request) {
    const credentialId = `test-credential-${request.id}`;
    const anchorTxId = `tx_fabric_anchor_test_${request.id}`;
    return {
      status: 'anchored', credentialId, anchorTxId, txId: anchorTxId,
      issuanceReceipt: {
        status: 'anchored', credentialId, dataHash: request.data_hash,
        algorithm: 'ML-DSA-65', publicKeyId: 'test-public-key',
        signature: 'test-signature', anchorTxId, issuedAt: new Date().toISOString()
      }
    };
  },
  async executeRevocation(request) {
    return { status: 'revoked', credentialId: request.credential_id, txId: `tx_fabric_revoke_test_${request.id}` };
  }
};
