-- CreateTable
CREATE TABLE IF NOT EXISTS "BlockchainTransaction" (
    "id" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "documentHash" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'EVIDENCE_UPLOAD',
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,

    CONSTRAINT "BlockchainTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BlockchainTransaction_transactionHash_key" ON "BlockchainTransaction"("transactionHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BlockchainTransaction_documentId_idx" ON "BlockchainTransaction"("documentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BlockchainTransaction_caseId_idx" ON "BlockchainTransaction"("caseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BlockchainTransaction_transactionHash_idx" ON "BlockchainTransaction"("transactionHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BlockchainTransaction_documentHash_idx" ON "BlockchainTransaction"("documentHash");

-- AddForeignKey (idempotent-safe via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlockchainTransaction_documentId_fkey'
  ) THEN
    ALTER TABLE "BlockchainTransaction"
      ADD CONSTRAINT "BlockchainTransaction_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "Document"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BlockchainTransaction_caseId_fkey'
  ) THEN
    ALTER TABLE "BlockchainTransaction"
      ADD CONSTRAINT "BlockchainTransaction_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "Case"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
