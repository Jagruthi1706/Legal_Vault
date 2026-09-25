import assert from 'node:assert/strict';
import test from 'node:test';
import { caseService } from '../src/services/case.service';
import { documentService } from '../src/services/document.service';
import { JudicialService } from '../src/services/judicial.service';
import { prisma } from '../src/utils/prisma';

const prismaAny = prisma as any;

/**
 * Regression coverage for the judge-access root cause.
 *
 * Case/document visibility is granted either by a CaseParticipant row or by
 * `Case.assignedJudgeId`. The assignment field is written only by the
 * ADMIN-only assignment endpoint, which validates that the target user is a
 * JUDGE, so it is authorization-grade. Before this was modelled, an assigned
 * judge who had no duplicate participant row received 404s on their own case,
 * its documents, and blockchain verification.
 */

const withStub = async (
  target: any,
  method: string,
  impl: (...args: any[]) => any,
  run: () => Promise<void>,
) => {
  const original = target[method];
  target[method] = impl;
  try {
    await run();
  } finally {
    target[method] = original;
  }
};

test('case visibility predicate includes the assigned-judge clause', async () => {
  let captured: any;
  await withStub(prismaAny.case, 'findFirst', async (args: any) => {
    captured = args.where;
    return { id: 'case-1' };
  }, async () => {
    const allowed = await caseService.canAccessCase('case-1', 'judge-1', 'JUDGE');
    assert.equal(allowed, true);
  });

  assert.equal(captured.id, 'case-1');
  assert.deepEqual(captured.OR, [
    { participants: { some: { userId: 'judge-1' } } },
    { assignedJudgeId: 'judge-1' },
  ]);
});

test('an unassigned judge with no participant row cannot access a case', async () => {
  await withStub(prismaAny.case, 'findFirst', async () => null, async () => {
    await withStub(prismaAny.caseParticipant, 'findFirst', async () => null, async () => {
      const allowed = await caseService.canAccessCase('case-1', 'judge-2', 'JUDGE');
      assert.equal(allowed, false);
    });
  });
});

test('document listing is scoped by participant or assigned-judge authorization', async () => {
  let captured: any;
  await withStub(prismaAny.document, 'findMany', async (args: any) => {
    captured = args.where;
    return [];
  }, async () => {
    await documentService.getDocumentsForUser(undefined, 'judge-1', 'JUDGE');
  });

  assert.deepEqual(captured.case.OR, [
    { participants: { some: { userId: 'judge-1' } } },
    { assignedJudgeId: 'judge-1' },
  ]);
});

test('hash-only blockchain verification lookup resolves an assigned judge document', async () => {
  let captured: any;
  await withStub(prismaAny.document, 'findFirst', async (args: any) => {
    captured = args.where;
    return { id: 'document-1' };
  }, async () => {
    const record = await documentService.getDocumentByHashForUser('0xABC', 'judge-1', 'JUDGE');
    assert.equal(record?.id, 'document-1');
  });

  // The stored hash is still normalized (0x-stripped, lowercased).
  assert.equal(captured.sha256Hash, 'abc');
  assert.deepEqual(captured.case.OR, [
    { participants: { some: { userId: 'judge-1' } } },
    { assignedJudgeId: 'judge-1' },
  ]);
});

test('administrator document access remains unscoped', async () => {
  let captured: any;
  await withStub(prismaAny.document, 'findFirst', async (args: any) => {
    captured = args.where;
    return { id: 'document-1' };
  }, async () => {
    await documentService.getDocumentByHashForUser('abcd', 'admin-1', 'ADMIN');
  });

  assert.equal(captured.case, undefined);
  assert.equal(captured.sha256Hash, 'abcd');
});

test('official judicial action is permitted for the assigned judge without a duplicate participant row', async () => {
  await withStub(prismaAny.case, 'findUnique', async (args: any) => {
    // The assignment field is authoritative; no participant pre-requirement.
    assert.equal(args.include.participants, undefined);
    return {
      id: 'case-1',
      assignedJudgeId: 'judge-1',
      assignedJudge: { role: 'JUDGE' },
    };
  }, async () => {
    const record = await new JudicialService().assertAssignedJudge('case-1', 'judge-1');
    assert.equal(record.id, 'case-1');
  });
});

test('official judicial action is denied for a judge who is not assigned to the case', async () => {
  await withStub(prismaAny.case, 'findUnique', async () => ({
    id: 'case-1',
    assignedJudgeId: 'judge-1',
    assignedJudge: { role: 'JUDGE' },
  }), async () => {
    await assert.rejects(
      () => new JudicialService().assertAssignedJudge('case-1', 'judge-2'),
      /assigned judge/i,
    );
  });
});

test('official judicial action is denied when the assigned user no longer holds the JUDGE role', async () => {
  await withStub(prismaAny.case, 'findUnique', async () => ({
    id: 'case-1',
    assignedJudgeId: 'user-9',
    assignedJudge: { role: 'ADMIN' },
  }), async () => {
    await assert.rejects(
      () => new JudicialService().assertAssignedJudge('case-1', 'user-9'),
      /assigned judge/i,
    );
  });
});