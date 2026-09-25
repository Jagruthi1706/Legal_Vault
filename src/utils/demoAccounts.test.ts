import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_ACCOUNT_EMAILS } from '../pages/public/LoginPage';

test('development demo shortcuts use the intended accounts', () => {
  assert.deepEqual(DEMO_ACCOUNT_EMAILS, {
    client: 'client@example.com',
    lawyer: 'lawyer@example.com',
    judge: 'meera.srinivasan@example.com',
    admin: 'admin@example.com',
  });
});