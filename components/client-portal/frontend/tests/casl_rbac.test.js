// components/client-portal/frontend/tests/casl_rbac.test.js
// Unit tests for CASL Role-Based Access Control in Client Portal Frontend

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAbilityForUser } from '../src/auth/ability.js';

test('CASL Client Portal RBAC: Ability & Desk Access Matrix', async (t) => {

  await t.test('1. Unauthenticated / null user cannot access any desk', () => {
    const ability = buildAbilityForUser(null);
    assert.equal(ability.can('access', 'VerifyDesk'), false, 'Null user must not access VerifyDesk');
    assert.equal(ability.can('access', 'IssueDesk'), false, 'Null user must not access IssueDesk');
    assert.equal(ability.can('access', 'RevokeDesk'), false, 'Null user must not access RevokeDesk');
  });

  await t.test('2. Base clerk with restricted permissions can only access VerifyDesk', () => {
    const clerk = {
      id: 'clerk-01',
      username: 'clerk_restricted',
      role: 'clerk',
      station_id: 'STATION-01',
      permissions: ['can_verify'],
    };

    const ability = buildAbilityForUser(clerk);
    assert.equal(ability.can('access', 'VerifyDesk'), true, 'Clerk must access VerifyDesk');
    assert.equal(ability.can('access', 'IssueDesk'), false, 'Restricted clerk must NOT access IssueDesk');
    assert.equal(ability.can('access', 'RevokeDesk'), false, 'Restricted clerk must NOT access RevokeDesk');
  });

  await t.test('3. Clerk with can_issue permission can access VerifyDesk and IssueDesk, but not RevokeDesk', () => {
    const clerk = {
      id: 'clerk-02',
      username: 'clerk_intake_only',
      role: 'clerk',
      station_id: 'STATION-02',
      permissions: ['can_verify', 'can_issue'],
    };

    const ability = buildAbilityForUser(clerk);
    assert.equal(ability.can('access', 'VerifyDesk'), true, 'Clerk can access VerifyDesk');
    assert.equal(ability.can('access', 'IssueDesk'), true, 'Clerk can access IssueDesk');
    assert.equal(ability.can('access', 'RevokeDesk'), false, 'Clerk must NOT access RevokeDesk');
  });

  await t.test('4. Clerk with can_revoke permission can access VerifyDesk and RevokeDesk, but not IssueDesk', () => {
    const clerk = {
      id: 'clerk-03',
      username: 'clerk_revocation_only',
      role: 'clerk',
      station_id: 'STATION-03',
      permissions: ['can_verify', 'can_revoke'],
    };

    const ability = buildAbilityForUser(clerk);
    assert.equal(ability.can('access', 'VerifyDesk'), true, 'Clerk can access VerifyDesk');
    assert.equal(ability.can('access', 'IssueDesk'), false, 'Clerk must NOT access IssueDesk');
    assert.equal(ability.can('access', 'RevokeDesk'), true, 'Clerk can access RevokeDesk');
  });

  await t.test('5. Clerk with unconfigured/default permissions gets standard full desk access', () => {
    const clerk = {
      id: 'clerk-04',
      username: 'clerk_standard',
      role: 'clerk',
      station_id: 'STATION-04',
      // permissions omitted or undefined
    };

    const ability = buildAbilityForUser(clerk);
    assert.equal(ability.can('access', 'VerifyDesk'), true, 'Standard clerk can access VerifyDesk');
    assert.equal(ability.can('access', 'IssueDesk'), true, 'Standard clerk can access IssueDesk');
    assert.equal(ability.can('access', 'RevokeDesk'), true, 'Standard clerk can access RevokeDesk');
  });

  await t.test('6. Clerk with full explicit permissions can access all desks', () => {
    const clerk = {
      id: 'clerk-05',
      username: 'clerk_supervisor',
      role: 'clerk',
      station_id: 'STATION-SUPERVISOR',
      permissions: ['can_verify', 'can_issue', 'can_revoke'],
    };

    const ability = buildAbilityForUser(clerk);
    assert.equal(ability.can('access', 'VerifyDesk'), true);
    assert.equal(ability.can('access', 'IssueDesk'), true);
    assert.equal(ability.can('access', 'RevokeDesk'), true);
  });
});
