package main

import (
	"encoding/json"
	"fmt"
	"log"
	"regexp"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

var (
	uuidRegexp   = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	sha256Regexp = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

// SmartContract provides functions for managing proof records
type SmartContract struct {
	contractapi.Contract
}

// ProofRecord defines the structure of a proof record on the ledger
type ProofRecord struct {
	CredentialID string `json:"credentialId"`
	DataHash     string `json:"dataHash"`
	IssuerID     string `json:"issuerId"`
	Timestamp    string `json:"timestamp"`
	Status       string `json:"status"` // "active" | "revoked"
}

// AnchorProof records a new proof hash on the ledger
func (s *SmartContract) AnchorProof(ctx contractapi.TransactionContextInterface, credentialID string, dataHash string, issuerID string, timestamp string) error {
	// Strict Zero Trust Input Validation
	if !uuidRegexp.MatchString(credentialID) {
		return fmt.Errorf("invalid credentialID format: must be a valid UUID v4")
	}
	if !sha256Regexp.MatchString(dataHash) {
		return fmt.Errorf("invalid dataHash format: must be a valid 64-character hexadecimal SHA3-256 hash")
	}
	if issuerID == "" || len(issuerID) > 256 {
		return fmt.Errorf("invalid issuerID: must be non-empty and under 256 characters")
	}
	if timestamp == "" || len(timestamp) > 64 {
		return fmt.Errorf("invalid timestamp: must be non-empty and under 64 characters")
	}

	// Access control: Ensure the caller has a valid client identity MSP and is authorized (IssuerMSP only)
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get client MSP ID: %v", err)
	}
	if clientMSPID != "IssuerMSP" {
		return fmt.Errorf("unauthorized: client MSP %s is not permitted to anchor proofs", clientMSPID)
	}

	exists, err := s.ProofExists(ctx, credentialID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("the proof for credential %s already exists", credentialID)
	}

	record := ProofRecord{
		CredentialID: credentialID,
		DataHash:     dataHash,
		IssuerID:     issuerID,
		Timestamp:    timestamp,
		Status:       "active",
	}

	recordJSON, err := json.Marshal(record)
	if err != nil {
		return err
	}

	// Emit chaincode event for asynchronous indexing and event-driven architectures
	if err := ctx.GetStub().SetEvent("ProofAnchored", recordJSON); err != nil {
		return fmt.Errorf("failed to emit ProofAnchored event: %v", err)
	}

	return ctx.GetStub().PutState(credentialID, recordJSON)
}

// QueryProof returns the ProofRecord stored in the ledger with given credentialID
func (s *SmartContract) QueryProof(ctx contractapi.TransactionContextInterface, credentialID string) (*ProofRecord, error) {
	// Strict Zero Trust Input Validation
	if !uuidRegexp.MatchString(credentialID) {
		return nil, fmt.Errorf("invalid credentialID format: must be a valid UUID v4")
	}

	recordJSON, err := ctx.GetStub().GetState(credentialID)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if recordJSON == nil {
		return nil, fmt.Errorf("the proof %s does not exist", credentialID)
	}

	var record ProofRecord
	err = json.Unmarshal(recordJSON, &record)
	if err != nil {
		return nil, err
	}

	return &record, nil
}

// RevokeProof sets the status of a proof record to "revoked"
func (s *SmartContract) RevokeProof(ctx contractapi.TransactionContextInterface, credentialID string, requestingIssuerID string) error {
	// Strict Zero Trust Input Validation
	if !uuidRegexp.MatchString(credentialID) {
		return fmt.Errorf("invalid credentialID format: must be a valid UUID v4")
	}
	if requestingIssuerID == "" || len(requestingIssuerID) > 256 {
		return fmt.Errorf("invalid requestingIssuerID: must be non-empty and under 256 characters")
	}

	record, err := s.QueryProof(ctx, credentialID)
	if err != nil {
		return err
	}

	// Access control: only the original issuer org (IssuerMSP) can revoke.
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get client MSP ID: %v", err)
	}
	if clientMSPID != "IssuerMSP" {
		return fmt.Errorf("unauthorized: client MSP %s is not permitted to revoke proofs", clientMSPID)
	}

	// Ensure the caller matches the original issuer (or caller's authorized MSP)
	if record.IssuerID != requestingIssuerID && record.IssuerID != clientMSPID {
		return fmt.Errorf("unauthorized: requesting issuer %s does not match original issuer %s", requestingIssuerID, record.IssuerID)
	}

	// Idempotent guard: prevent duplicate revocations, wasted ledger writes, and spurious events
	if record.Status == "revoked" {
		return fmt.Errorf("proof %s is already revoked", credentialID)
	}

	record.Status = "revoked"

	recordJSON, err := json.Marshal(record)
	if err != nil {
		return err
	}

	// Emit chaincode event for instant downstream revocation propagation
	if err := ctx.GetStub().SetEvent("ProofRevoked", recordJSON); err != nil {
		return fmt.Errorf("failed to emit ProofRevoked event: %v", err)
	}

	return ctx.GetStub().PutState(credentialID, recordJSON)
}

// ProofExists returns true when proof record with given credentialID exists in world state
func (s *SmartContract) ProofExists(ctx contractapi.TransactionContextInterface, credentialID string) (bool, error) {
	// Strict Zero Trust Input Validation
	if !uuidRegexp.MatchString(credentialID) {
		return false, fmt.Errorf("invalid credentialID format: must be a valid UUID v4")
	}

	recordJSON, err := ctx.GetStub().GetState(credentialID)
	if err != nil {
		return false, err
	}

	return recordJSON != nil, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Error creating scatterproof chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting scatterproof chaincode: %v", err)
	}
}
