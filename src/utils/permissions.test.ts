import assert from 'node:assert/strict';
import test from 'node:test';
import type { User, UserRole } from '../types';
import { can, getEvidenceWorkflowVisibility } from './permissions';
import { getRoleHomePath, mapBackendRole } from '../contexts/AuthContext';

const userFor = (role: UserRole): User => ({
  id: `${role}-id`, name: role, email: `${role}@example.com`, role, verified: true,
});

test('client UI does not render tamper detection or official verification controls', () => {
  const view = getEvidenceWorkflowVisibility(userFor('client'));
  assert.equal(view.tamperDetection, false);
  assert.equal(view.officialVerify, false);
});

test('lawyer UI does not render tamper detection or official verification controls', () => {
  const view = getEvidenceWorkflowVisibility(userFor('lawyer'));
  assert.equal(view.tamperDetection, false);
  assert.equal(view.officialVerify, false);
  assert.equal(view.anchorCustody, true);
});

test('judge UI renders official verification and tamper detection controls', () => {
  const view = getEvidenceWorkflowVisibility(userFor('judge'));
  assert.equal(view.tamperDetection, true);
  assert.equal(view.officialVerify, true);
  assert.equal(view.anchorCustody, false);
});

test('admin UI has user management but no judicial verification controls', () => {
  const admin = userFor('admin');
  const view = getEvidenceWorkflowVisibility(admin);
  assert.equal(can(admin, 'manageUsers'), true);
  assert.equal(view.officialVerify, false);
  assert.equal(view.tamperDetection, false);
});

test('backend role mapping preserves supported roles and denies unknown roles', () => {
  assert.equal(mapBackendRole('CITIZEN'), 'client');
  assert.equal(mapBackendRole('LAWYER'), 'lawyer');
  assert.equal(mapBackendRole('JUDGE'), 'judge');
  assert.equal(mapBackendRole('ADMIN'), 'admin');
  assert.equal(mapBackendRole('CLERK'), 'invalid');
  assert.equal(mapBackendRole('unexpected'), 'invalid');
});

test('authenticated roles resolve to their guarded home paths', () => {
  assert.equal(getRoleHomePath('client'), '/app/client');
  assert.equal(getRoleHomePath('lawyer'), '/app/lawyer');
  assert.equal(getRoleHomePath('judge'), '/app/judge');
  assert.equal(getRoleHomePath('admin'), '/app/admin');
  assert.equal(getRoleHomePath('invalid'), '/app/forbidden');
});
