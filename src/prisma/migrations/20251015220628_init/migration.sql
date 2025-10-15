-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "priority" TEXT,
    "sender" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "feedback" TEXT,
    "requiresResponse" BOOLEAN NOT NULL DEFAULT false,
    "codeEval" BOOLEAN NOT NULL DEFAULT false,
    "code" TEXT,
    "explanation" TEXT,
    "type" TEXT,
    "risk_level" TEXT,
    "codespaceResponse" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShareMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'collection-share',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "priority" TEXT,
    "sender" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "requiresResponse" BOOLEAN NOT NULL DEFAULT false,
    "collectionRequest" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "idx_message_timestamp" ON "Message"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_message_status" ON "Message"("status");

-- CreateIndex
CREATE INDEX "idx_share_message_timestamp" ON "ShareMessage"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "idx_share_message_status" ON "ShareMessage"("status");
