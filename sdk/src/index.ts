import canonicalize from 'canonicalize';
import { randomBytes, createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
    InvalidClaimError,
    CredentialNotFoundError,
    RevokedCredentialError,
    CryptoServiceUnavailableError,
    InternalServerError
} from './errors.js';

export * from './errors.js';
export * from './types.js';
import { ScatterIDClientOptions } from './types.js';

export class ScatterIDClient {
    private apiKey: string;
    private issuanceUrl: string;
    private verificationUrl: string;

    constructor(options: ScatterIDClientOptions) {
        this.apiKey = options.apiKey;
        this.issuanceUrl = options.issuanceUrl || 'http://localhost:3000';
        this.verificationUrl = options.verificationUrl || 'http://localhost:3000';
    }

    private computeHash(claim: object, saltHex: string): string {
        const canonicalized = canonicalize(claim);
        if (!canonicalized) throw new InvalidClaimError("Failed to canonicalize claim", "INVALID_CLAIM");
        
        const saltBytes = Buffer.from(saltHex, 'hex');
        const claimBytes = Buffer.from(canonicalized, 'utf-8');
        const payload = Buffer.concat([saltBytes, claimBytes]);
        
        return createHash('sha3-256').update(payload).digest('hex');
    }

    private handleError(resData: any, status: number) {
        const code = resData.code || 'UNKNOWN';
        const msg = resData.error || `HTTP Error ${status}`;

        if (code === 'INVALID_PARAMETER' || status === 400) throw new InvalidClaimError(msg, code);
        if (code === 'NOT_FOUND' || status === 404) throw new CredentialNotFoundError(msg, code);
        if (code === 'CRYPTO_SERVICE_UNREACHABLE' || code === 'CRYPTO_SERVICE_ERROR' || status === 502) throw new CryptoServiceUnavailableError(msg, code);
        throw new InternalServerError(msg, code);
    }

    public async issue(claim: object, idempotencyKey?: string) {
        if (!claim || typeof claim !== 'object') {
            throw new InvalidClaimError("Claim must be an object", "INVALID_CLAIM");
        }

        const salt = randomBytes(16).toString('hex');
        const dataHash = this.computeHash(claim, salt);
        const idKey = idempotencyKey || uuidv4();

        const res = await fetch(`${this.issuanceUrl}/issue`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({ dataHash, idempotencyKey: idKey })
        });

        const data = await res.json();
        if (!res.ok) {
            this.handleError(data, res.status);
        }

        return {
            ...data,
            salt
        };
    }

    public async verifyByHash(dataHash: string, credentialId?: string) {
        const payload: any = { dataHash };
        if (credentialId) payload.credentialId = credentialId;

        const res = await fetch(`${this.verificationUrl}/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            this.handleError(data, res.status);
        }

        if (!data.valid && data.anchorStatus === 'revoked') {
             throw new RevokedCredentialError(data.reason || 'Credential revoked', 'REVOKED');
        }

        return data;
    }

    public async verifyByClaim(claim: object, salt: string, credentialId?: string) {
        const dataHash = this.computeHash(claim, salt);
        return this.verifyByHash(dataHash, credentialId);
    }

    public async getStatus(credentialId: string) {
        const res = await fetch(`${this.verificationUrl}/status/${credentialId}`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        const data = await res.json();
        if (!res.ok) {
            this.handleError(data, res.status);
        }

        return data;
    }
}
