-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "messageId" TEXT,
    "sender" TEXT,
    "listName" TEXT,
    "subject" TEXT,
    "rawText" TEXT NOT NULL,
    "fileUrl" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT
);

-- CreateTable
CREATE TABLE "Host" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'club',
    "yaleclubsUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "officerNetid" TEXT
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "hostId" TEXT,
    "title" TEXT NOT NULL,
    "start" DATETIME NOT NULL,
    "end" DATETIME,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "placeId" TEXT,
    "locationRaw" TEXT,
    "summary" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "freeFood" BOOLEAN NOT NULL DEFAULT false,
    "food" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'open_to_all',
    "college" TEXT,
    "rsvpUrl" TEXT,
    "confidence" REAL NOT NULL,
    "evidence" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'live',
    "seriesId" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "changedFields" TEXT NOT NULL,
    "fromSourceId" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventVersion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" TEXT,
    "details" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Listing_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "hostName" TEXT,
    "typicalMonth" INTEGER,
    "yearsSeen" TEXT NOT NULL,
    "isTradition" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "netid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "college" TEXT,
    "alertEmail" TEXT,
    "alertFreeFood" BOOLEAN NOT NULL DEFAULT false,
    "digestOn" BOOLEAN NOT NULL DEFAULT true,
    "gcalConnected" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Save" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "gcalEventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Save_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Save_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "eventId" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_messageId_key" ON "Source"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "Host_name_key" ON "Host"("name");

-- CreateIndex
CREATE INDEX "Event_start_idx" ON "Event"("start");

-- CreateIndex
CREATE UNIQUE INDEX "User_netid_key" ON "User"("netid");

-- CreateIndex
CREATE UNIQUE INDEX "Save_userId_eventId_key" ON "Save"("userId", "eventId");
