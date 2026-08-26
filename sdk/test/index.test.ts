import { jest } from "@jest/globals";
import { ScatterIDClient } from '../src/index';
import { createHash } from 'crypto';
import canonicalize from 'canonicalize';

describe('ScatterIDClient', () => {
    it('should compute consistent hash for a given claim and salt', () => {
        const client = new ScatterIDClient({ apiKey: 'test' });
        const claim = { subject: "John Doe", role: "Employee" };
        const saltHex = "00112233445566778899aabbccddeeff"; 
        
        const hash = (client as any).computeHash(claim, saltHex);
        
        // Exact expected hash computation:
        const expectedStr = '{"role":"Employee","subject":"John Doe"}';
        const payload = Buffer.concat([Buffer.from(saltHex, 'hex'), Buffer.from(expectedStr, 'utf-8')]);
        const expectedHash = createHash('sha3-256').update(payload).digest('hex');

        expect(hash).toEqual(expectedHash);
        expect(hash).toEqual("186193952f4b8c93f7d89a32cda305f8f50e136e25ad28c5419d01023df20808");
    });
});

    it('should deduplicate issues with the same idempotency key', async () => {
        const client = new ScatterIDClient({ apiKey: 'test' });
        
        // Mock global fetch
        const mockResponses: string[] = [];
        global.fetch = (jest.fn as any)().mockImplementation(async (url: any, options: any) => {
            const body = JSON.parse(options.body);
            if (mockResponses.includes(body.idempotencyKey)) {
                return {
                    ok: true,
                    json: async () => ({
                        credentialId: 'test-id',
                        status: 'anchored'
                    })
                };
            }
            mockResponses.push(body.idempotencyKey);
            return {
                ok: true,
                json: async () => ({
                    credentialId: 'test-id',
                    status: 'pending'
                })
            };
        });

        const claim = { subject: "John Doe" };
        const idKey = "my-id-key";
        
        const res1 = await client.issue(claim, idKey);
        const res2 = await client.issue(claim, idKey);
        
        expect(res1.credentialId).toEqual(res2.credentialId);
        
        expect(global.fetch).toHaveBeenCalledTimes(2);
        const calls = (global.fetch as jest.Mock).mock.calls;
        expect(JSON.parse((calls[0][1] as any).body).idempotencyKey).toEqual(idKey);
        expect(JSON.parse((calls[1][1] as any).body).idempotencyKey).toEqual(idKey);
    });
