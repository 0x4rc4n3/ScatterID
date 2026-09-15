// components/ops-dashboard-web/tests/permissionMatrix.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkPermission, PERMISSION_MATRIX } from '../src/accessControl/permissionMatrix.ts';

describe('ScatterID Ops Console Permission Matrix (§6 & Rule 6)', () => {
  it('Root administrator has full access across all operations', () => {
    assert.equal(checkPermission('root', 'overview', 'read'), true);
    assert.equal(checkPermission('root', 'credentials', 'read'), true);
    assert.equal(checkPermission('root', 'awaitingAccept', 'decide'), true);
    assert.equal(checkPermission('root', 'flagged', 'execute'), true);
    assert.equal(checkPermission('root', 'keyRotation', 'rotate'), true);
    assert.equal(checkPermission('root', 'systemHealth', 'reconcile'), true);
    assert.equal(checkPermission('root', 'policy', 'write'), true);
    assert.equal(checkPermission('root', 'userManagement', 'reset-password-all'), true);
  });

  it('Pending Requests queue is read-only for Root administrator per §6', () => {
    assert.equal(checkPermission('root', 'pendingRequests', 'read'), true);
    assert.equal(checkPermission('root', 'pendingRequests', 'decide'), false);
  });

  it('Moderator has permission to review and decide in Pending Requests queue', () => {
    assert.equal(checkPermission('mod', 'pendingRequests', 'read'), true);
    assert.equal(checkPermission('mod', 'pendingRequests', 'decide'), true);
  });

  it('Moderator is strictly barred from Awaiting Accept and Flagged queues (Root-only)', () => {
    assert.equal(checkPermission('mod', 'awaitingAccept', 'read'), false);
    assert.equal(checkPermission('mod', 'awaitingAccept', 'execute'), false);
    assert.equal(checkPermission('mod', 'flagged', 'read'), false);
    assert.equal(checkPermission('mod', 'flagged', 'execute'), false);
  });

  it('Moderator has read-only policy access and cannot alter governance profiles', () => {
    assert.equal(checkPermission('mod', 'policy', 'read'), true);
    assert.equal(checkPermission('mod', 'policy', 'write'), false);
  });

  it('Moderator may reset Help Desk Clerk passwords but not Root or Mod passwords', () => {
    assert.equal(checkPermission('mod', 'userManagement', 'reset-password-clerk'), true);
    assert.equal(checkPermission('mod', 'userManagement', 'reset-password-all'), false);
  });

  it('Counter Help Desk Clerk has zero access to Ops Dashboard console resources', () => {
    assert.equal(checkPermission('clerk', 'overview', 'read'), false);
    assert.equal(checkPermission('clerk', 'credentials', 'read'), false);
    assert.equal(checkPermission('clerk', 'moderationQueue', 'read'), false);
    assert.equal(checkPermission('clerk', 'keyRotation', 'read'), false);
    assert.equal(checkPermission('clerk', 'auditLog', 'read'), false);
  });
});
