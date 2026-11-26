-- Deck look picked in the Presentations builder. Additive with a default, so existing decks show as "light".
ALTER TABLE "Presentation" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'light';
