package main

import (
	"crypto/x509"
	"strings"
	"testing"

	"github.com/hyperledger/fabric-chaincode-go/pkg/cid"
	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-chaincode-go/shimtest"
)

type mockClientIdentity struct {
	mspID string
	id    string
}

func (m *mockClientIdentity) GetID() (string, error)                               { return m.id, nil }
func (m *mockClientIdentity) GetMSPID() (string, error)                            { return m.mspID, nil }
func (m *mockClientIdentity) GetAttributeValue(attrName string) (string, bool, error) { return "", false, nil }
func (m *mockClientIdentity) AssertAttributeValue(attrName, attrValue string) error   { return nil }
func (m *mockClientIdentity) GetX509Certificate() (*x509.Certificate, error)      { return nil, nil }

type mockTxContext struct {
	stub           *shimtest.MockStub
	clientIdentity cid.ClientIdentity
}

func (m *mockTxContext) GetStub() shim.ChaincodeStubInterface { return m.stub }
func (m *mockTxContext) GetClientIdentity() cid.ClientIdentity { return m.clientIdentity }

func (m *mockTxContext) startTx(txID string) {
	m.stub.MockTransactionStart(txID)
}

func (m *mockTxContext) endTx(txID string) {
	m.stub.MockTransactionEnd(txID)
}

func newMockContext(mspID string) *mockTxContext {
	stub := shimtest.NewMockStub("scatterproof", nil)
	return &mockTxContext{
		stub:           stub,
		clientIdentity: &mockClientIdentity{mspID: mspID, id: "test-user"},
	}
}

const (
	validUUID = "c9a646d3-9c61-4cc9-bc3d-5573752e25df"
	validHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
)

func TestAnchorProof_Success(t *testing.T) {
	contract := &SmartContract{}
	ctx := newMockContext("IssuerMSP")

	ctx.startTx("tx-anchor-1")
	err := contract.AnchorProof(ctx, validUUID, validHash, "IssuerMSP", "2026-09-05T12:00:00Z")
	ctx.endTx("tx-anchor-1")
	if err != nil {
		t.Fatalf("expected AnchorProof to succeed, got: %v", err)
	}

	// Verify record was written to world state
	record, err := contract.QueryProof(ctx, validUUID)
	if err != nil {
		t.Fatalf("expected QueryProof to succeed, got: %v", err)
	}
	if record.Status != "active" {
		t.Errorf("expected status 'active', got '%s'", record.Status)
	}
	if record.CredentialID != validUUID {
		t.Errorf("expected credentialId '%s', got '%s'", validUUID, record.CredentialID)
	}
	if record.DataHash != validHash {
		t.Errorf("expected dataHash '%s', got '%s'", validHash, record.DataHash)
	}
}

func TestAnchorProof_CaseNormalization(t *testing.T) {
	contract := &SmartContract{}
	ctx := newMockContext("IssuerMSP")

	upperUUID := strings.ToUpper(validUUID)
	upperHash := strings.ToUpper(validHash)

	ctx.startTx("tx-anchor-upper")
	err := contract.AnchorProof(ctx, upperUUID, upperHash, "IssuerMSP", "2026-09-05T12:00:00Z")
	ctx.endTx("tx-anchor-upper")
	if err != nil {
		t.Fatalf("expected case normalization to succeed, got: %v", err)
	}

	// Query with lowercase should find the normalized record
	record, err := contract.QueryProof(ctx, validUUID)
	if err != nil {
		t.Fatalf("expected QueryProof to succeed with normalized UUID, got: %v", err)
	}
	if record.CredentialID != validUUID {
		t.Errorf("expected normalized credentialId '%s', got '%s'", validUUID, record.CredentialID)
	}
	if record.DataHash != validHash {
		t.Errorf("expected normalized dataHash '%s', got '%s'", validHash, record.DataHash)
	}
}

func TestAnchorProof_ReplayProtection(t *testing.T) {
	contract := &SmartContract{}
	ctx := newMockContext("IssuerMSP")

	ctx.startTx("tx-1")
	err := contract.AnchorProof(ctx, validUUID, validHash, "IssuerMSP", "2026-09-05T12:00:00Z")
	ctx.endTx("tx-1")
	if err != nil {
		t.Fatalf("first AnchorProof failed: %v", err)
	}

	// Duplicate anchor must fail
	ctx.startTx("tx-2")
	err = contract.AnchorProof(ctx, validUUID, validHash, "IssuerMSP", "2026-09-05T12:00:00Z")
	ctx.endTx("tx-2")
	if err == nil {
		t.Fatal("expected duplicate AnchorProof to fail, but it succeeded")
	}
	if !strings.Contains(err.Error(), "already exists") {
		t.Errorf("expected error containing 'already exists', got: %v", err)
	}
}

func TestAnchorProof_UnauthorizedMSP(t *testing.T) {
	contract := &SmartContract{}
	ctx := newMockContext("VerifierMSP")

	ctx.startTx("tx-unauth")
	err := contract.AnchorProof(ctx, validUUID, validHash, "IssuerMSP", "2026-09-05T12:00:00Z")
	ctx.endTx("tx-unauth")
	if err == nil {
		t.Fatal("expected non-IssuerMSP to be rejected, but it succeeded")
	}
	if !strings.Contains(err.Error(), "unauthorized") {
		t.Errorf("expected unauthorized error, got: %v", err)
	}
}

func TestAnchorProof_InputValidation(t *testing.T) {
	contract := &SmartContract{}
	ctx := newMockContext("IssuerMSP")

	tests := []struct {
		name         string
		credentialID string
		dataHash     string
		issuerID     string
		timestamp    string
		errMsg       string
	}{
		{"invalid uuid", "not-a-uuid", validHash, "IssuerMSP", "2026-09-05T12:00:00Z", "invalid credentialID"},
		{"short hash", validUUID, "deadbeef", "IssuerMSP", "2026-09-05T12:00:00Z", "invalid dataHash"},
		{"non-hex hash", validUUID, strings.Repeat("z", 64), "IssuerMSP", "2026-09-05T12:00:00Z", "invalid dataHash"},
		{"empty issuer", validUUID, validHash, "", "2026-09-05T12:00:00Z", "invalid issuerID"},
		{"empty timestamp", validUUID, validHash, "IssuerMSP", "", "invalid timestamp"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx.startTx("tx-validate")
			err := contract.AnchorProof(ctx, tt.credentialID, tt.dataHash, tt.issuerID, tt.timestamp)
			ctx.endTx("tx-validate")
			if err == nil {
				t.Fatalf("expected validation error for %s, got nil", tt.name)
			}
			if !strings.Contains(err.Error(), tt.errMsg) {
				t.Errorf("expected error containing '%s', got: %v", tt.errMsg, err)
			}
		})
	}
}

func TestQueryProof_NotFound(t *testing.T) {
	contract := &SmartContract{}
	ctx := newMockContext("IssuerMSP")

	_, err := contract.QueryProof(ctx, validUUID)
	if err == nil {
		t.Fatal("expected query for non-existent proof to fail, got nil")
	}
	if !strings.Contains(err.Error(), "does not exist") {
		t.Errorf("expected 'does not exist' error, got: %v", err)
	}
}

func TestRevokeProof_Success(t *testing.T) {
	contract := &SmartContract{}
	ctx := newMockContext("IssuerMSP")

	// Anchor proof first
	ctx.startTx("tx-anchor")
	err := contract.AnchorProof(ctx, validUUID, validHash, "IssuerMSP", "2026-09-05T12:00:00Z")
	ctx.endTx("tx-anchor")
	if err != nil {
		t.Fatalf("AnchorProof failed: %v", err)
	}

	// Revoke proof
	ctx.startTx("tx-revoke")
	err = contract.RevokeProof(ctx, validUUID, "IssuerMSP")
	ctx.endTx("tx-revoke")
	if err != nil {
		t.Fatalf("RevokeProof failed: %v", err)
	}

	// Check status is revoked
	record, err := contract.QueryProof(ctx, validUUID)
	if err != nil {
		t.Fatalf("QueryProof failed: %v", err)
	}
	if record.Status != "revoked" {
		t.Errorf("expected status 'revoked', got '%s'", record.Status)
	}
}

func TestRevokeProof_DoubleRevocation(t *testing.T) {
	contract := &SmartContract{}
	ctx := newMockContext("IssuerMSP")

	ctx.startTx("tx-anchor")
	err := contract.AnchorProof(ctx, validUUID, validHash, "IssuerMSP", "2026-09-05T12:00:00Z")
	ctx.endTx("tx-anchor")
	if err != nil {
		t.Fatalf("AnchorProof failed: %v", err)
	}

	ctx.startTx("tx-revoke-1")
	err = contract.RevokeProof(ctx, validUUID, "IssuerMSP")
	ctx.endTx("tx-revoke-1")
	if err != nil {
		t.Fatalf("first RevokeProof failed: %v", err)
	}

	// Second revocation must fail
	ctx.startTx("tx-revoke-2")
	err = contract.RevokeProof(ctx, validUUID, "IssuerMSP")
	ctx.endTx("tx-revoke-2")
	if err == nil {
		t.Fatal("expected second RevokeProof to fail, got nil")
	}
	if !strings.Contains(err.Error(), "already revoked") {
		t.Errorf("expected error containing 'already revoked', got: %v", err)
	}
}

func TestRevokeProof_UnauthorizedMSP(t *testing.T) {
	contract := &SmartContract{}
	ctxIssuer := newMockContext("IssuerMSP")
	ctxVerifier := newMockContext("VerifierMSP")

	ctxIssuer.startTx("tx-anchor")
	err := contract.AnchorProof(ctxIssuer, validUUID, validHash, "IssuerMSP", "2026-09-05T12:00:00Z")
	ctxIssuer.endTx("tx-anchor")
	if err != nil {
		t.Fatalf("AnchorProof failed: %v", err)
	}

	// VerifierMSP tries to revoke using the same underlying stub
	ctxVerifier.stub = ctxIssuer.stub
	ctxVerifier.startTx("tx-revoke-unauth")
	err = contract.RevokeProof(ctxVerifier, validUUID, "IssuerMSP")
	ctxVerifier.endTx("tx-revoke-unauth")
	if err == nil {
		t.Fatal("expected VerifierMSP revocation to fail, got nil")
	}
	if !strings.Contains(err.Error(), "unauthorized") {
		t.Errorf("expected unauthorized error, got: %v", err)
	}
}

func TestRevokeProof_MismatchedIssuer(t *testing.T) {
	contract := &SmartContract{}
	ctx := newMockContext("IssuerMSP")

	ctx.startTx("tx-anchor")
	err := contract.AnchorProof(ctx, validUUID, validHash, "IssuerMSP", "2026-09-05T12:00:00Z")
	ctx.endTx("tx-anchor")
	if err != nil {
		t.Fatalf("AnchorProof failed: %v", err)
	}

	ctx.startTx("tx-revoke-mismatch")
	err = contract.RevokeProof(ctx, validUUID, "WrongIssuer")
	ctx.endTx("tx-revoke-mismatch")
	if err == nil {
		t.Fatal("expected mismatched requesting issuer to fail, got nil")
	}
	if !strings.Contains(err.Error(), "does not match original issuer") {
		t.Errorf("expected mismatch error, got: %v", err)
	}
}

func TestProofExists(t *testing.T) {
	contract := &SmartContract{}
	ctx := newMockContext("IssuerMSP")

	exists, err := contract.ProofExists(ctx, validUUID)
	if err != nil {
		t.Fatalf("ProofExists failed: %v", err)
	}
	if exists {
		t.Error("expected ProofExists to return false for non-existent proof")
	}

	ctx.startTx("tx-anchor")
	err = contract.AnchorProof(ctx, validUUID, validHash, "IssuerMSP", "2026-09-05T12:00:00Z")
	ctx.endTx("tx-anchor")
	if err != nil {
		t.Fatalf("AnchorProof failed: %v", err)
	}

	exists, err = contract.ProofExists(ctx, validUUID)
	if err != nil {
		t.Fatalf("ProofExists failed: %v", err)
	}
	if !exists {
		t.Error("expected ProofExists to return true after anchoring")
	}
}

func TestGetProofHistory_NotImplementedInMock(t *testing.T) {
	contract := &SmartContract{}
	ctx := newMockContext("IssuerMSP")

	// In shimtest.MockStub, GetHistoryForKey returns "not implemented"
	_, err := contract.GetProofHistory(ctx, validUUID)
	if err == nil {
		t.Fatal("expected error from MockStub.GetHistoryForKey, got nil")
	}
	if !strings.Contains(err.Error(), "not implemented") {
		t.Errorf("expected 'not implemented' error from MockStub, got: %v", err)
	}
}

func TestGetProofHistory_InvalidUUID(t *testing.T) {
	contract := &SmartContract{}
	ctx := newMockContext("IssuerMSP")

	_, err := contract.GetProofHistory(ctx, "invalid-uuid")
	if err == nil {
		t.Fatal("expected error on invalid UUID, got nil")
	}
	if !strings.Contains(err.Error(), "invalid credentialID") {
		t.Errorf("expected 'invalid credentialID' error, got: %v", err)
	}
}
