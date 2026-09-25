-- Additive Phase 6 legal-authority vector table. Intentionally NOT applied automatically.
-- Does not modify existing case, document, evidence, audit, verification, comparison, or blockchain tables.
-- Embeddings are stored as JSON so this does not require the pgvector extension.
-- Apply later only after review, for example:
--   cd backend && npx prisma migrate deploy
-- Default runtime continues to use VECTOR_STORE=memory.

CREATE TABLE "LegalAuthorityChunk" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "embedding" JSONB NOT NULL,
  "provenance" JSONB NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalAuthorityChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LegalAuthorityChunk_documentId_idx" ON "LegalAuthorityChunk"("documentId");
CREATE INDEX "LegalAuthorityChunk_scope_idx" ON "LegalAuthorityChunk"("scope");
