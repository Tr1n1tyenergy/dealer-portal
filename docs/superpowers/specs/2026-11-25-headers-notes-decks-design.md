# Headers, Note Taker and Presentations redesign (to-do 8.1–8.4)

Approved by Adrian on 25 Nov 2026 from the mockups in
`D:\Downloads\Dealer portal files\header-notes-decks-mockups-2026-11-25.html` (headers) and
`note-taker-presentations-mockups-2026-11-25.html` (picks: Note Taker 1, 3, 4; Presentations 1, 5, 9;
Staff header A; Dealer header A).

## Why
- 8.1: the staff portal has no way back to the modules page from Retail.
- 8.2: the staff header is cramped, and "Stock Sale Reporting" is cut off at about 1700 px.
- 8.3: the dealer header spacing looks off.
- 8.4: the Note Taker and Presentations pages don't match the rest of the portal.

## Approaches considered
1. **Restyle in place** (chosen): keep the routes, APIs and data, and rewrite the six screens and two headers to the
   approved mockups. Smallest change, and nothing new for production except one additive column.
2. Build the AI pipeline (recording upload, transcription, summaries) at the same time. Rejected for this round,
   because it needs a provider choice, an API key, a cost decision and audio storage, and none of those are settled.
   It stays a separate project (to-do 5.9).
3. Move Note Taker and Presentations inside the Retail staff shell. Rejected: they are separate modules on the
   modules page, and the module switcher already links them.

## Branches
- `fix/portal-headers` (8.1–8.3): staff header A and dealer header A.
- `feat/note-taker-redesign` (8.4), stacked on the headers branch so the Note Taker and Presentations header
  can reuse the module switcher. Merge the headers branch first.

## Staff header (A)
- On the left, a **module switcher** takes the place of the logo block: the Trinity mark, "Trinity Retail Intelligence" over
  the current module, and a chevron. Its menu has **All modules** (`/intelligence/dashboard`) followed by every
  work module the person may open (`splitModules(user).work`), with the current one marked.
- **Nav that fits:** tabs that don't fit the width move into a **More** menu. The fit is computed from the
  measured tab widths (a pure `fitCount` helper with a unit test).
- **Right side:** a round search button opens the existing search box (same behaviour: it goes to Orders with `?q=`),
  then the accessibility menu, the bell and the account menu, all unchanged.

## Dealer header (A)
- The logo, then **"Dealer Portal"** on one line (the "Trinity Retail Intelligence" subline is dropped), tighter
  nav spacing, and the right-side buttons unchanged. CSS only, plus removing the one line.

## Note Taker
- **Home (option 1, bento):** a photo hero tile (Start recording, Schedule), a **Next meeting** tile with a live
  countdown (from scheduled sessions), an **open actions** ring (from the notes' action items, minus the ticked ones),
  the **latest notes** summary, a **Recent** list (with status: Ready, Writing, Scheduled, Recording), and a **Decks**
  tile (count of the person's presentations, linking to Presentations).
- **Recording (option 3, dark):** the Trinity mark inside a ring of bars driven by the real microphone (the same
  getUserMedia and AnalyserNode approach as today), a timer, Pause/Resume and Stop. The countdown screen uses the same ring.
  The time limit (if set) shows as "x min left", and recording stops on its own at the limit.
  The captions panel says that live captions arrive with the transcription step. "Mark a decision/action" waits
  for captions and is left out.
- **Notes (option 4, tabs):** the meetings list on the left (searchable), and on the right Summary,
  Decisions, Actions (ticks are saved), Risks & opportunities, and Transcript. A meeting still being written
  shows a skeleton. Footer: "Make a deck from these notes" (goes to the builder with these notes picked) and
  "Download notes" (the existing JSON download).
- Ticked actions are stored in the notes JSON as `doneActions: number[]` via `PATCH /api/note-sessions/[id]`
  `{ action: "toggleAction", index }`. There's no schema change.

## Presentations
- **Home (option 1, bento):** the latest deck plays itself with story bars (hovering pauses it), with Present.
  A photo tile offers "Make the deck" for the newest completed notes that have no deck yet. A stats tile shows decks this month,
  slides made, and notes waiting for a deck. "All decks" lists each deck with a thumbnail and a Present button.
- **Create (option 5, builder)** at `/intelligence/presentations/new?from=<id>`: (1) pick notes (completed, no deck
  yet); (2) choose sections (Summary, Discussed, Decisions, Actions, Risks, Opportunities, Next steps); (3) choose the
  presenter (participants or yourself) and the look (Light, Navy, Station photo, Warm), with a live preview and a
  thumbnail strip. Create posts `{ noteSessionId, presenter, sections, theme }`.
- **Present (option 9, presenter view)** at `/intelligence/presentations/[id]`: the current slide, the next slide, the
  slide list, a timer, n / total, dots, ← → and Space, and full screen through the Fullscreen API (Esc leaves it).
- `generatePresentationSlides` takes an optional `sections` filter; the title slide is always kept.
- New column `Presentation.theme TEXT NOT NULL DEFAULT 'light'` (additive migration). The API validates the theme
  (`light | navy | photo | warm`).
- `POST /api/presentations` for notes that already have a deck returns 409 with the existing deck's id, where today it
  crashes on the unique key.

## Not in this round (named, not built)
- Real transcription and AI notes (5.9): the notes are still the template text that `completeNoteSession` writes.
- "Upload audio": today it only creates an empty instant session, so it's removed and not shown as working.
- Live captions, marked moments, playing the recording, speaker notes, "times presented".

## Checks
- Unit tests: `fitCount`, the `sections` filter, open-actions counting.
- DB tests: toggling an action, a duplicate deck → 409, theme saved, bad theme → 400.
- `npm test`, `npm run test:db`, typecheck, lint and build.
- Playwright on the local server (tri_stress) at 1440, 1280 and 390 px: no page errors, no sideways scroll, and every
  button on the six screens and two headers clicked.
