import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { createSessionToken, verifySessionToken } from '../src/utils/auth';
import { requireRole } from '../src/middleware/auth.middleware';
import { login } from '../src/controllers/auth.controller';
import { prisma } from '../src/utils/prisma';

const user = { id: 'user-1', email: 'judge@example.com', name: 'Judge', role: 'JUDGE' };

test('password hashes authenticate a valid password and reject an invalid password', async () => {
  const hash = await bcrypt.hash('password123', 10);
  assert.equal(await bcrypt.compare('password123', hash), true);
  assert.equal(await bcrypt.compare('wrong-password', hash), false);
});

async function invokeLogin(email: string, password: string, foundUser: any) {
  const original = prisma.user.findUnique;
  (prisma.user.findUnique as any) = async () => foundUser;
  let body: any;
  let statusCode = 0;
  let error: any;
  await new Promise<void>((resolve) => {
    const response = {
      status(code: number) { statusCode = code; return this; },
      json(value: unknown) { body = value; resolve(); return this; },
    };
    (login as any)({ body: { email, password } }, response, (nextError?: unknown) => {
      error = nextError;
      resolve();
    });
  });
  (prisma.user.findUnique as any) = original;
  return { statusCode, body, error };
}

test('login accepts valid credentials and rejects invalid passwords and unknown users', async () => {
  const passwordHash = await bcrypt.hash('password123', 10);
  const validUser = { ...user, passwordHash };
  const valid = await invokeLogin(user.email, 'password123', validUser);
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.body.data.user.role, 'JUDGE');
  assert.equal(typeof valid.body.data.token, 'string');

  const invalidPassword = await invokeLogin(user.email, 'bad', validUser);
  assert.equal(invalidPassword.error?.statusCode, 401);
  const unknownUser = await invokeLogin('unknown@example.com', 'password123', null);
  assert.equal(unknownUser.error?.statusCode, 401);
});

test('signed sessions include an expiry and expired sessions are rejected', () => {
  assert.deepEqual(verifySessionToken(createSessionToken(user)), user);
  assert.equal(verifySessionToken(createSessionToken(user, -1)), null);
  assert.equal(verifySessionToken('not-a-token'), null);
});

test('official verification middleware returns 403 for client/lawyer/admin and allows judge', () => {
  const judgeOnly = requireRole('JUDGE');
  for (const role of ['CITIZEN', 'LAWYER', 'ADMIN']) {
    let error: any;
    judgeOnly({ user: { ...user, role } } as any, {} as any, (err?: unknown) => { error = err; });
    assert.equal(error?.statusCode, 403);
  }
  let error: any;
  judgeOnly({ user } as any, {} as any, (err?: unknown) => { error = err; });
  assert.equal(error, undefined);
});

test('role middleware enforces the protected capability matrix', () => {
  const policies = [
    { allowed: ['LAWYER'], denied: ['CITIZEN', 'JUDGE', 'ADMIN'] },
    { allowed: ['JUDGE'], denied: ['CITIZEN', 'LAWYER', 'ADMIN'] },
    { allowed: ['ADMIN'], denied: ['CITIZEN', 'LAWYER', 'JUDGE'] },
  ] as const;

  for (const policy of policies) {
    const middleware = requireRole(...policy.allowed);
    for (const role of policy.allowed) {
      let error: any;
      middleware({ user: { ...user, role } } as any, {} as any, (nextError?: unknown) => { error = nextError; });
      assert.equal(error, undefined);
    }
    for (const role of policy.denied) {
      let error: any;
      middleware({ user: { ...user, role } } as any, {} as any, (nextError?: unknown) => { error = nextError; });
      assert.equal(error?.statusCode, 403);
    }
  }
});
