-- Create pug_lobby_spectators table for production-managed spectator lists
CREATE TABLE "pug_lobby_spectators" (
    "id" SERIAL NOT NULL,
    "lobbyId" INTEGER NOT NULL,
    "battleTag" TEXT NOT NULL,
    "personId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "addedByUserId" INTEGER,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedAt" TIMESTAMP(3),

    CONSTRAINT "pug_lobby_spectators_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pug_lobby_spectators_lobbyId_battleTag_key" ON "pug_lobby_spectators"("lobbyId", "battleTag");
CREATE INDEX "pug_lobby_spectators_lobbyId_idx" ON "pug_lobby_spectators"("lobbyId");

ALTER TABLE "pug_lobby_spectators"
  ADD CONSTRAINT "pug_lobby_spectators_lobbyId_fkey"
  FOREIGN KEY ("lobbyId") REFERENCES "pug_lobbies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
