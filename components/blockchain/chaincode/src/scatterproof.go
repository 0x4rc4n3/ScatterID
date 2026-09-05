package main

import (
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

var (
	uuidRegexp   = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	sha256Regexp = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

// SmartContract manages cryptographic proof records on the ledger.
type SmartContract struct {
	contractapi.Contract
}

// ProofRecord represents a credential commitment anchored on the ledger.
type ProofRecord struct {
	CredentialID string `json:"credentialId"`
	DataHash     string `json:"dataHash"`
	IssuerID     string `json:"issuerId"`
	Timestamp    string `json:"timestamp"`
	Status       string `json:"status"` // "active" | "revoked"
}

// HistoryRecord captures a point-in-time modification to a ProofRecord on the ledger.
type HistoryRecord struct {
	TxId      string       `json:"txId"`
	Timestamp time.Time    `json:"timestamp"`
	IsDelete  bool         `json:"isDelete"`
	Record    *ProofRecord `json:"record,omitempty"`
}

// AnchorProof writes a new credential commitment to the ledger.
func (s *SmartContract) AnchorProof(ctx contractapi.TransactionContextInterface, credentialID string, dataHash string, issuerID string, timestamp string) error {
	credentialID = strings.ToLower(strings.TrimSpace(credentialID))
	dataHash = strings.ToLower(strings.TrimSpace(dataHash))
	issuerID = strings.TrimSpace(issuerID)
	timestamp = strings.TrimSpace(timestamp)

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

	parsedTime, err := time.Parse(time.RFC3339Nano, timestamp)
	if err != nil {
		parsedTime, err = time.Parse(time.RFC3339, timestamp)
		if err != nil {
			return fmt.Errorf("invalid timestamp format: must be valid RFC 3339 / ISO 8601 format: %v", err)
		}
	}
	if parsedTime.Before(time.Unix(0, 0)) {
		return fmt.Errorf("invalid timestamp: date precedes Unix epoch (1970-01-01)")
	}
	if parsedTime.Year() > 2100 {
		return fmt.Errorf("invalid timestamp: date exceeds maximum supported year 2100")
	}

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
		return fmt.Errorf("failed to marshal proof record: %v", err)
	}

	if err := ctx.GetStub().SetEvent("ProofAnchored", recordJSON); err != nil {
		return fmt.Errorf("failed to emit ProofAnchored event: %v", err)
	}

	return ctx.GetStub().PutState(credentialID, recordJSON)
}

// QueryProof reads and deserializes the ProofRecord for the given credentialID.
func (s *SmartContract) QueryProof(ctx contractapi.TransactionContextInterface, credentialID string) (*ProofRecord, error) {
	credentialID = strings.ToLower(strings.TrimSpace(credentialID))

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
	if err := json.Unmarshal(recordJSON, &record); err != nil {
		return nil, fmt.Errorf("failed to unmarshal proof record: %v", err)
	}

	return &record, nil
}

// RevokeProof marks an active proof record as "revoked".
func (s *SmartContract) RevokeProof(ctx contractapi.TransactionContextInterface, credentialID string, requestingIssuerID string) error {
	credentialID = strings.ToLower(strings.TrimSpace(credentialID))
	requestingIssuerID = strings.TrimSpace(requestingIssuerID)

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

	// Only members of the designated issuing MSP are authorized to revoke
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get client MSP ID: %v", err)
	}
	if clientMSPID != "IssuerMSP" {
		return fmt.Errorf("unauthorized: client MSP %s is not permitted to revoke proofs", clientMSPID)
	}

	// Ensure caller-specified issuer identity matches the anchored issuer
	if record.IssuerID != requestingIssuerID {
		return fmt.Errorf("unauthorized: requesting issuer %s does not match original issuer %s", requestingIssuerID, record.IssuerID)
	}

	if record.Status == "revoked" {
		return fmt.Errorf("proof %s is already revoked", credentialID)
	}

	record.Status = "revoked"

	recordJSON, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal proof record: %v", err)
	}

	if err := ctx.GetStub().SetEvent("ProofRevoked", recordJSON); err != nil {
		return fmt.Errorf("failed to emit ProofRevoked event: %v", err)
	}

	return ctx.GetStub().PutState(credentialID, recordJSON)
}

// ProofExists checks if a proof record exists in the world state.
func (s *SmartContract) ProofExists(ctx contractapi.TransactionContextInterface, credentialID string) (bool, error) {
	credentialID = strings.ToLower(strings.TrimSpace(credentialID))

	if !uuidRegexp.MatchString(credentialID) {
		return false, fmt.Errorf("invalid credentialID format: must be a valid UUID v4")
	}

	recordJSON, err := ctx.GetStub().GetState(credentialID)
	if err != nil {
		return false, err
	}

	return recordJSON != nil, nil
}

// GetProofHistory returns the full transaction lifecycle history for a credentialID.
func (s *SmartContract) GetProofHistory(ctx contractapi.TransactionContextInterface, credentialID string) ([]HistoryRecord, error) {
	credentialID = strings.ToLower(strings.TrimSpace(credentialID))

	if !uuidRegexp.MatchString(credentialID) {
		return nil, fmt.Errorf("invalid credentialID format: must be a valid UUID v4")
	}

	iterator, err := ctx.GetStub().GetHistoryForKey(credentialID)
	if err != nil {
		return nil, fmt.Errorf("failed to get history for key %s: %v", credentialID, err)
	}
	defer iterator.Close()

	var history []HistoryRecord
	for iterator.HasNext() {
		modification, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("error reading history iterator: %v", err)
		}

		var proof *ProofRecord
		if len(modification.Value) > 0 {
			var p ProofRecord
			if err := json.Unmarshal(modification.Value, &p); err == nil {
				proof = &p
			}
		}

		var ts time.Time
		if modification.Timestamp != nil {
			ts = modification.Timestamp.AsTime()
		}

		history = append(history, HistoryRecord{
			TxId:      modification.TxId,
			Timestamp: ts,
			IsDelete:  modification.IsDelete,
			Record:    proof,
		})
	}

	return history, nil
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
