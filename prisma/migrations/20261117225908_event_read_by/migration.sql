-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
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
    "readBy" TEXT NOT NULL DEFAULT 'rules',
    "status" TEXT NOT NULL DEFAULT 'live',
    "seriesId" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("allDay", "audience", "college", "confidence", "createdAt", "end", "evidence", "food", "freeFood", "hostId", "id", "locationRaw", "placeId", "rsvpUrl", "seriesId", "sourceId", "start", "status", "summary", "tags", "title", "updatedAt", "views") SELECT "allDay", "audience", "college", "confidence", "createdAt", "end", "evidence", "food", "freeFood", "hostId", "id", "locationRaw", "placeId", "rsvpUrl", "seriesId", "sourceId", "start", "status", "summary", "tags", "title", "updatedAt", "views" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE INDEX "Event_start_idx" ON "Event"("start");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
