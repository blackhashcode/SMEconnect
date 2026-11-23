-- The app orders conversation participants with JavaScript string comparison
-- (UTF-16 code units). The original check used the database's locale collation,
-- which orders mixed-case ids differently, so creating a conversation failed
-- for real (mixed-case) user ids. Compare bytes ("C" collation) instead, which
-- matches JavaScript ordering for the ASCII ids in use.
ALTER TABLE "conversation" DROP CONSTRAINT "conversation_ordered_participants";
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_ordered_participants"
  CHECK ("participantOneId" COLLATE "C" < "participantTwoId" COLLATE "C");
