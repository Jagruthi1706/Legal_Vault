import {
  PrismaClient,
  Role,
  CaseStatus,
  CaseType,
  ParticipantRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Safe upsert-based demo seed.
 * Does not wipe existing documents/transactions.
 */
async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);
  const citizen = await prisma.user.upsert({
    where: { email: 'asha.patel@example.com' },
    update: { name: 'Asha Patel', role: Role.CITIZEN, passwordHash },
    create: {
      name: 'Asha Patel',
      email: 'asha.patel@example.com',
      role: Role.CITIZEN,
      passwordHash,
    },
  });

  const lawyer = await prisma.user.upsert({
    where: { email: 'rahul.mehta@example.com' },
    update: { name: 'Adv. Rahul Mehta', role: Role.LAWYER, passwordHash },
    create: {
      name: 'Adv. Rahul Mehta',
      email: 'rahul.mehta@example.com',
      role: Role.LAWYER,
      passwordHash,
    },
  });

  const judge = await prisma.user.upsert({
    where: { email: 'meera.srinivasan@example.com' },
    update: { name: 'Hon. Justice Meera Srinivasan', role: Role.JUDGE, passwordHash },
    create: {
      name: 'Hon. Justice Meera Srinivasan',
      email: 'meera.srinivasan@example.com',
      role: Role.JUDGE,
      passwordHash,
    },
  });

  const client = await prisma.user.upsert({
    where: { email: 'client@example.com' },
    update: { name: 'Demo Client', role: Role.CITIZEN, passwordHash },
    create: { name: 'Demo Client', email: 'client@example.com', role: Role.CITIZEN, passwordHash },
  });
  const demoLawyer = await prisma.user.upsert({
    where: { email: 'lawyer@example.com' },
    update: { name: 'Demo Lawyer', role: Role.LAWYER, passwordHash },
    create: { name: 'Demo Lawyer', email: 'lawyer@example.com', role: Role.LAWYER, passwordHash },
  });
  const demoJudge = await prisma.user.upsert({
    where: { email: 'judge@example.com' },
    update: { name: 'Demo Judge', role: Role.JUDGE, passwordHash },
    create: { name: 'Demo Judge', email: 'judge@example.com', role: Role.JUDGE, passwordHash },
  });
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { name: 'Demo Administrator', role: Role.ADMIN, passwordHash },
    create: { name: 'Demo Administrator', email: 'admin@example.com', role: Role.ADMIN, passwordHash },
  });

  let demoCase = await prisma.case.findUnique({
    where: { caseNumber: 'LV-DEMO-001' },
  });

  if (!demoCase) {
    demoCase = await prisma.case.create({
      data: {
        caseNumber: 'LV-DEMO-001',
        title: 'Family Property Partition Dispute',
        description:
          'Partition dispute between two siblings over ancestral property in Mumbai. Used for LegalVault Sepolia blockchain demo.',
        caseType: CaseType.FAMILY,
        status: CaseStatus.ACTIVE,
        assignedJudgeId: judge.id,
      },
    });
  }

  const participantSpecs = [
    { userId: citizen.id, participantRole: ParticipantRole.PETITIONER },
    { userId: lawyer.id, participantRole: ParticipantRole.LAWYER },
    { userId: judge.id, participantRole: ParticipantRole.JUDGE },
    { userId: client.id, participantRole: ParticipantRole.PETITIONER },
    { userId: demoLawyer.id, participantRole: ParticipantRole.LAWYER },
    { userId: demoJudge.id, participantRole: ParticipantRole.JUDGE },
  ] as const;

  for (const spec of participantSpecs) {
    await prisma.caseParticipant.upsert({
      where: {
        caseId_userId: {
          caseId: demoCase.id,
          userId: spec.userId,
        },
      },
      update: { participantRole: spec.participantRole },
      create: {
        caseId: demoCase.id,
        userId: spec.userId,
        participantRole: spec.participantRole,
      },
    });
  }

  console.log('Demo seed ready.');
  // The administrator has system-wide visibility and does not need case membership.
  void admin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
