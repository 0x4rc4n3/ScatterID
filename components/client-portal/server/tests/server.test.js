// components/client-portal/server/tests/server.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { createServer } from '../src/server.ts';

describe('ScatterID Client Portal Server (Counter-VPN Proxy)', () => {
  it('GET /healthz returns 200 ok', async () => {
    const app = createServer();
    const res = await supertest(app).get('/healthz');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'scatterid-client-portal-server');
  });

  it('POST /auth/login returns 400 when credentials are missing', async () => {
    const app = createServer();
    const res = await supertest(app).post('/auth/login').send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'MISSING_CREDENTIALS');
  });

  it('POST /issue rejects unauthenticated requests with 401', async () => {
    const app = createServer();
    const res = await supertest(app).post('/issue').send({ channel: 'hard' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'UNAUTHORIZED');
  });

  it('POST /revoke rejects unauthenticated requests with 401', async () => {
    const app = createServer();
    const res = await supertest(app).post('/revoke').send({ credentialId: 'cred-1' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'UNAUTHORIZED');
  });

  it('GET /track/:id rejects unauthenticated requests with 401', async () => {
    const app = createServer();
    const res = await supertest(app).get('/track/req-123');
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'UNAUTHORIZED');
  });

  it('POST /verify forwards directly to verification API', async () => {
    const mockVerifyClient = {
      async forwardVerifyRequest(payload) {
        return {
          status: 200,
          data: { valid: true, credentialId: payload.credentialId, status: 'active' },
        };
      },
    };

    const app = createServer({ verificationApiClient: mockVerifyClient });
    const res = await supertest(app)
      .post('/verify')
      .send({ credentialId: 'c9f8749d-6548-43d9-a29c-50bc549fef12' });

    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
  });

  it('POST /issue forwards to Ops Dashboard when authenticated', async () => {
    let capturedToken = null;
    let capturedPayload = null;

    const mockOpsClient = {
      async forwardIssueRequest(payload, token) {
        capturedToken = token;
        capturedPayload = payload;
        return { status: 201, data: { requestId: 'req-456', status: 'pending' } };
      },
    };

    const app = createServer({ opsDashboardClient: mockOpsClient });
    const res = await supertest(app)
      .post('/issue')
      .set('Authorization', 'Bearer valid-clerk-token')
      .send({ submission_channel: 'hard', claimant_data: { subject: 'Test' } });

    assert.equal(res.status, 201);
    assert.equal(capturedToken, 'valid-clerk-token');
    assert.equal(capturedPayload.submission_channel, 'hard');
  });
});
