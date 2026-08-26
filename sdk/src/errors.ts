export class ScatterIDError extends Error {
    public code: string;
    constructor(message: string, code: string) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
    }
}

export class InvalidClaimError extends ScatterIDError {}
export class CredentialNotFoundError extends ScatterIDError {}
export class RevokedCredentialError extends ScatterIDError {}
export class CryptoServiceUnavailableError extends ScatterIDError {}
export class InternalServerError extends ScatterIDError {}
