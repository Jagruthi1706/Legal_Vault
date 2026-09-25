import assert from 'node:assert/strict';
import test from 'node:test';
import { JudicialDecision } from '@prisma/client';
import { createVerificationSchema } from '../src/validators/judicial.validator';
import { AuditService } from '../src/services/audit.service';

test('Phase 2: rejected judicial decisions require a reason', () => {
  assert.equal(createVerificationSchema.safeParse({ judicialDecision: JudicialDecision.REJECTED }).success, false);
  assert.equal(createVerificationSchema.safeParse({ judicialDecision: JudicialDecision.REJECTED, decisionReason: 'Reasons recorded.' }).success, true);
});

test('Phase 2: audit API is append-only', () => {
  const service = new AuditService() as unknown as Record<string, unknown>;
  assert.equal(typeof service.record, 'function');
  assert.equal('update' in service, false);
  assert.equal('delete' in service, false);
});
