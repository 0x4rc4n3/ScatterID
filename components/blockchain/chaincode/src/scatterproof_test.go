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

func TestRevokeProof_ExploitRegression_BypassWhenIssuerEqualsMSP(t *testing.T) {
	// REGRESSION TEST for BUG-BLOCKCHAIN-1:
	// In the flawed original logic:
	//   if record.IssuerID != requestingIssuerID && record.IssuerID != clientMSPID
	// when a credential had record.IssuerID == "IssuerMSP", the second clause evaluated to false.
	// Because of the '&&', the entire check failed to trigger, allowing an attacker to supply
	// any arbitrary requestingIssuerID (e.g. "UnauthorizedAttacker") and successfully revoke the credential.
	contract := &SmartContract{}
	ctx := newMockContext("IssuerMSP") // Valid MSP identity

	testCredID := "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
	ctx.startTx("tx-anchor-exploit")
	err := contract.AnchorProof(ctx, testCredID, validHash, "IssuerMSP", "2026-09-05T12:00:00Z")
	ctx.endTx("tx-anchor-exploit")
	if err != nil {
		t.Fatalf("AnchorProof failed: %v", err)
	}

	// Attacker attempts revocation with unauthorized requestingIssuerID
	ctx.startTx("tx-revoke-exploit-attempt")
	err = contract.RevokeProof(ctx, testCredID, "UnauthorizedAttacker")
	ctx.endTx("tx-revoke-exploit-attempt")

	if err == nil {
		t.Fatal("CRITICAL: Exploit succeeded! UnauthorizedAttacker revoked credential because record.IssuerID == clientMSPID")
	}
	expectedMsg := "requesting issuer UnauthorizedAttacker does not match original issuer IssuerMSP"
	if !strings.Contains(err.Error(), expectedMsg) {
		t.Errorf("expected error containing '%s', got: %v", expectedMsg, err)
	}

	// Verify proof state remains active and was NOT altered
	record, err := contract.QueryProof(ctx, testCredID)
	if err != nil {
		t.Fatalf("QueryProof failed: %v", err)
	}
	if record.Status != "active" {
		t.Errorf("expected record status to remain 'active', got '%s'", record.Status)
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

// TestRevokeProof_AuthorizationTruthTable exhaustively checks all 2^3 = 8 combinations of:
//   1. Caller MSP == "IssuerMSP" (authorized) vs "MaliciousMSP" (unauthorized)
//   2. Caller requestingIssuerID == original issuer ("Issuer-Alpha") vs mismatched ("Impostor-Beta")
//   3. Ledger record Status == "active" vs "revoked"
func TestRevokeProof_AuthorizationTruthTable(t *testing.T) {
	contract := &SmartContract{}
	originalIssuer := "Issuer-Alpha"
	impostorIssuer := "Impostor-Beta"

	type truthCase struct {
		name           string
		callerMSP      string
		requestIssuer  string
		initialStatus  string
		expectSuccess  bool
		expectedErrSub string
	}

	cases := []truthCase{
		// 1. (True, True, True) -> ALLOW
		{
			name:          "Case 1: [Auth MSP, Match Issuer, Active] -> ALLOW",
			callerMSP:     "IssuerMSP",
			requestIssuer: originalIssuer,
			initialStatus: "active",
			expectSuccess: true,
		},
		// 2. (True, True, False) -> DENY (already revoked)
		{
			name:           "Case 2: [Auth MSP, Match Issuer, Revoked] -> DENY (already revoked)",
			callerMSP:      "IssuerMSP",
			requestIssuer:  originalIssuer,
			initialStatus:  "revoked",
			expectSuccess:  false,
			expectedErrSub: "already revoked",
		},
		// 3. (True, False, True) -> DENY (mismatched issuer)
		{
			name:           "Case 3: [Auth MSP, Mismatched Issuer, Active] -> DENY (issuer mismatch)",
			callerMSP:      "IssuerMSP",
			requestIssuer:  impostorIssuer,
			initialStatus:  "active",
			expectSuccess:  false,
			expectedErrSub: "does not match original issuer",
		},
		// 4. (True, False, False) -> DENY (mismatched issuer takes precedence or rejects)
		{
			name:           "Case 4: [Auth MSP, Mismatched Issuer, Revoked] -> DENY (issuer mismatch)",
			callerMSP:      "IssuerMSP",
			requestIssuer:  impostorIssuer,
			initialStatus:  "revoked",
			expectSuccess:  false,
			expectedErrSub: "does not match original issuer",
		},
		// 5. (False, True, True) -> DENY (unauthorized MSP)
		{
			name:           "Case 5: [Unauth MSP, Match Issuer, Active] -> DENY (MSP unauthorized)",
			callerMSP:      "MaliciousMSP",
			requestIssuer:  originalIssuer,
			initialStatus:  "active",
			expectSuccess:  false,
			expectedErrSub: "is not permitted to revoke proofs",
		},
		// 6. (False, True, False) -> DENY (unauthorized MSP)
		{
			name:           "Case 6: [Unauth MSP, Match Issuer, Revoked] -> DENY (MSP unauthorized)",
			callerMSP:      "MaliciousMSP",
			requestIssuer:  originalIssuer,
			initialStatus:  "revoked",
			expectSuccess:  false,
			expectedErrSub: "is not permitted to revoke proofs",
		},
		// 7. (False, False, True) -> DENY (unauthorized MSP)
		{
			name:           "Case 7: [Unauth MSP, Mismatched Issuer, Active] -> DENY (MSP unauthorized)",
			callerMSP:      "MaliciousMSP",
			requestIssuer:  impostorIssuer,
			initialStatus:  "active",
			expectSuccess:  false,
			expectedErrSub: "is not permitted to revoke proofs",
		},
		// 8. (False, False, False) -> DENY (unauthorized MSP)
		{
			name:           "Case 8: [Unauth MSP, Mismatched Issuer, Revoked] -> DENY (MSP unauthorized)",
			callerMSP:      "MaliciousMSP",
			requestIssuer:  impostorIssuer,
			initialStatus:  "revoked",
			expectSuccess:  false,
			expectedErrSub: "is not permitted to revoke proofs",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// Fresh test context
			testUUID := "00000000-0000-4000-8000-000000000001"
			ctx := newMockContext("IssuerMSP")

			// Anchor baseline credential
			ctx.startTx("tx-setup")
			err := contract.AnchorProof(ctx, testUUID, validHash, originalIssuer, "2026-09-05T12:00:00Z")
			ctx.endTx("tx-setup")
			if err != nil {
				t.Fatalf("setup anchor failed: %v", err)
			}

			// If test case requires initial state to be 'revoked', revoke it first with authorized credentials
			if tc.initialStatus == "revoked" {
				ctx.startTx("tx-prerevoke")
				err := contract.RevokeProof(ctx, testUUID, originalIssuer)
				ctx.endTx("tx-prerevoke")
				if err != nil {
					t.Fatalf("setup pre-revocation failed: %v", err)
				}
			}

			// Switch context to target test caller MSP
			testCtx := newMockContext(tc.callerMSP)
			testCtx.stub = ctx.stub // Share the world state

			testCtx.startTx("tx-test-revoke")
			err = contract.RevokeProof(testCtx, testUUID, tc.requestIssuer)
			testCtx.endTx("tx-test-revoke")

			if tc.expectSuccess {
				if err != nil {
					t.Fatalf("expected revocation to SUCCEED, but got error: %v", err)
				}
				record, qErr := contract.QueryProof(testCtx, testUUID)
				if qErr != nil || record.Status != "revoked" {
					t.Errorf("expected status 'revoked', got record: %+v, err: %v", record, qErr)
				}
			} else {
				if err == nil {
					t.Fatalf("SECURITY VIOLATION: expected revocation to FAIL, but it SUCCEEDED!")
				}
				if !strings.Contains(err.Error(), tc.expectedErrSub) {
					t.Errorf("expected error containing %q, got: %q", tc.expectedErrSub, err.Error())
				}
			}
		})
	}
}

// TestAnchorProof_AuthorizationTruthTable exhaustively validates boolean guards on AnchorProof.
func TestAnchorProof_AuthorizationTruthTable(t *testing.T) {
	contract := &SmartContract{}

	type anchorCase struct {
		name          string
		callerMSP     string
		credID        string
		hash          string
		issuer        string
		timestamp     string
		preAnchor     bool
		expectSuccess bool
		errSub        string
	}

	cases := []anchorCase{
		{
			name:          "Valid fresh anchor by IssuerMSP -> ALLOW",
			callerMSP:     "IssuerMSP",
			credID:        "11111111-1111-4111-8111-111111111111",
			hash:          validHash,
			issuer:        "IssuerMSP",
			timestamp:     "2026-09-05T12:00:00Z",
			preAnchor:     false,
			expectSuccess: true,
		},
		{
			name:          "Unauthorized caller MSP -> DENY",
			callerMSP:     "UnauthorizedOrgMSP",
			credID:        "22222222-2222-4222-8222-222222222222",
			hash:          validHash,
			issuer:        "IssuerMSP",
			timestamp:     "2026-09-05T12:00:00Z",
			preAnchor:     false,
			expectSuccess: false,
			errSub:        "is not permitted to anchor proofs",
		},
		{
			name:          "Replay attack on existing credential -> DENY",
			callerMSP:     "IssuerMSP",
			credID:        "33333333-3333-4333-8333-333333333333",
			hash:          validHash,
			issuer:        "IssuerMSP",
			timestamp:     "2026-09-05T12:00:00Z",
			preAnchor:     true,
			expectSuccess: false,
			errSub:        "already exists",
		},
		{
			name:          "Empty issuer -> DENY",
			callerMSP:     "IssuerMSP",
			credID:        "44444444-4444-4444-8444-444444444444",
			hash:          validHash,
			issuer:        "   ",
			timestamp:     "2026-09-05T12:00:00Z",
			preAnchor:     false,
			expectSuccess: false,
			errSub:        "invalid issuerID",
		},
		{
			name:          "Empty timestamp -> DENY",
			callerMSP:     "IssuerMSP",
			credID:        "55555555-5555-4555-8555-555555555555",
			hash:          validHash,
			issuer:        "IssuerMSP",
			timestamp:     "",
			preAnchor:     false,
			expectSuccess: false,
			errSub:        "invalid timestamp",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := newMockContext("IssuerMSP")

			if tc.preAnchor {
				ctx.startTx("tx-pre")
				_ = contract.AnchorProof(ctx, tc.credID, tc.hash, tc.issuer, tc.timestamp)
				ctx.endTx("tx-pre")
			}

			testCtx := newMockContext(tc.callerMSP)
			testCtx.stub = ctx.stub

			testCtx.startTx("tx-anchor-test")
			err := contract.AnchorProof(testCtx, tc.credID, tc.hash, tc.issuer, tc.timestamp)
			testCtx.endTx("tx-anchor-test")

			if tc.expectSuccess {
				if err != nil {
					t.Fatalf("expected success, got error: %v", err)
				}
			} else {
				if err == nil {
					t.Fatalf("expected error containing %q, got nil", tc.errSub)
				}
				if !strings.Contains(err.Error(), tc.errSub) {
					t.Errorf("expected error %q, got: %q", tc.errSub, err.Error())
				}
			}
		})
	}
}
