import Link from "next/link";
import type { meetingHome } from "@/lib/note-taker/home-data";
import { SUPPORT_EMAIL } from "@/lib/company/contact";
import { NAIROBI_OFFSET_MS } from "@/lib/time/nairobi";
import { ActionItems } from "./action-items";
import { AccessRequestCard } from "./access-request-card";
import "./staff-member-home.css";

type Home = Awaited<ReturnType<typeof meetingHome>>;
const NOTE_TAKER = "/intelligence/note-taker";
const DAY = 86400e3;

/** "Today 11:00", "Yesterday 15:00", "Mon 10:00", "28 Oct" in Nairobi time. */
export function whenLabel(at: Date, now: Date, withTime = true): string {
  const day = (d: Date) => Math.floor((d.getTime() + NAIROBI_OFFSET_MS) / DAY);
  const local = new Date(at.getTime() + NAIROBI_OFFSET_MS);
  const time = withTime ? ` ${local.toISOString().slice(11, 16)}` : "";
  const diff = day(at) - day(now);
  if (diff === 0) return `Today${time}`;
  if (diff === -1) return `Yesterday${time}`;
  if (diff === 1) return `Tomorrow${time}`;
  if (Math.abs(diff) < 7) return `${local.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}${time}`;
  return local.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

const minutes = (s: number | null) => (s ? `${Math.max(1, Math.round(s / 60))} min` : null);

function meetingChip(m: Home["meetings"][number]): { tone: string; label: string } {
  if (m.status === "SCHEDULED" || m.status === "COUNTDOWN") return { tone: "trinity", label: "Scheduled" };
  if (m.status === "RECORDING" || m.status === "PAUSED") return { tone: "moving", label: "Recording" };
  if (m.notesStatus === "READY") return { tone: "done", label: "Notes ready" };
  if (m.notesStatus === "FAILED" || m.transcriptStatus === "FAILED") return { tone: "problem", label: "Notes failed" };
  return { tone: "muted", label: "Transcribing" };
}

function notesCounts(json: string | null): string {
  try {
    const n = JSON.parse(json ?? "") as Record<string, unknown>;
    const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
    const d = len(n.keyDecisions ?? n.decisions);
    const a = len(n.actionItems ?? n.actions);
    return [d ? `${d} ${d === 1 ? "decision" : "decisions"}` : "", a ? `${a} ${a === 1 ? "action" : "actions"}` : ""].filter(Boolean).join(" · ");
  } catch {
    return "";
  }
}

/** The person's day in one line for the photo greeting. */
export function memberSentence(home: Home, now: Date): string {
  const parts = [
    home.next ? (whenLabel(home.next.at, now).startsWith("Today") ? `${home.next.name} starts at ${whenLabel(home.next.at, now).slice(6)}` : `Next meeting: ${home.next.name}, ${whenLabel(home.next.at, now)}`) : "",
    home.openCount ? `${home.openCount} ${home.openCount === 1 ? "action item is" : "action items are"} waiting on you` : "",
  ].filter(Boolean);
  return parts.length ? `${parts.join(" · ")}.` : "Record a meeting and its notes, decisions and action items land here.";
}

/** Action items and recent decisions: on the Staff Member Home, and on the staff Home for anyone with meetings. */
export function MeetingCards({ home, now }: { home: Home; now: Date }) {
  return (
    <>
      <section className="ui-panel" aria-labelledby="smh-todo">
        <h2 id="smh-todo" className="ui-section-title">
          Your action items
        </h2>
        <p className="smh-sub">From your meeting notes · tick when done</p>
        <ActionItems items={home.items.map((i) => ({ sessionId: i.sessionId, meeting: i.meeting, when: whenLabel(i.at, now, false), text: i.text, hash: i.hash }))} />
      </section>
      <section className="ui-panel" aria-labelledby="smh-dec">
        <h2 id="smh-dec" className="ui-section-title">
          Recent decisions
        </h2>
        <p className="smh-sub">What your meetings agreed</p>
        {home.decisions.length === 0 ? (
          <p className="smh-empty">No decisions recorded yet.</p>
        ) : (
          <ul className="smh-dec">
            {home.decisions.map((d, i) => (
              <li key={`${d.sessionId}-${i}`}>
                {d.text}
                <em>
                  {d.meeting} · {whenLabel(d.at, now, false)}
                </em>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Staff Member Home (live dashboards spec §3.4): their meetings, week, action items, decisions and account. No order counts or prices. */
export function StaffMemberHome({
  home,
  now,
  lastSignIn,
  areas,
  pendingSince,
}: {
  home: Home;
  now: Date;
  lastSignIn: Date | null;
  areas: { key: string; label: string }[];
  pendingSince: string | null;
}) {
  const next = home.next;
  return (
    <div className="ui-page smh">
      <section className="smh-lift" aria-label="Your day">
        <article className="smh-card">
          <span className="smh-card__label">Next meeting</span>
          {next ? (
            <>
              <b className="smh-card__name">{next.name}</b>
              <span className="smh-card__sub">{[whenLabel(next.at, now), minutes(next.timeLimitSeconds), next.people ? `${next.people} people` : ""].filter(Boolean).join(" · ")}</span>
              <Link href={`${NOTE_TAKER}/${next.id}`} className="ui-btn ui-btn--secondary smh-card__btn">
                Open
              </Link>
            </>
          ) : (
            <>
              <b className="smh-card__name">Nothing scheduled</b>
              <Link href={NOTE_TAKER} className="ui-btn ui-btn--secondary smh-card__btn">
                Schedule a meeting
              </Link>
            </>
          )}
        </article>
        <article className="smh-card">
          <span className="smh-card__label">Notes ready to read</span>
          <b className="smh-card__value">{home.ready.length}</b>
          <span className="smh-card__sub">{home.ready.length ? home.ready.slice(0, 2).map((s) => s.name).join(" · ") : "From the last 7 days"}</span>
          {home.ready.length ? (
            <Link href={`${NOTE_TAKER}/${home.ready[0].id}/notes`} className="ui-btn ui-btn--primary smh-card__btn">
              Read notes
            </Link>
          ) : null}
        </article>
        <article className="smh-card">
          <span className="smh-card__label">Your action items</span>
          <b className="smh-card__value">{home.openCount}</b>
          <span className="smh-card__sub">{home.openCount ? `From ${home.openMeetings} ${home.openMeetings === 1 ? "meeting" : "meetings"}` : "All done"}</span>
          {home.openCount ? (
            <a href="#smh-todo" className="ui-btn ui-btn--secondary smh-card__btn">
              See them
            </a>
          ) : null}
        </article>
      </section>

      <div className="smh-two">
        <section className="ui-panel" aria-labelledby="smh-meet">
          <div className="smh-head">
            <div>
              <h2 id="smh-meet" className="ui-section-title">
                Your meetings
              </h2>
              <p className="smh-sub">Recorded and scheduled, newest first</p>
            </div>
            <Link href={NOTE_TAKER} className="ui-navlink">
              Open Note Taker
            </Link>
          </div>
          {home.meetings.length === 0 ? (
            <p className="smh-empty">No meetings yet. Start a recording in Note Taker.</p>
          ) : (
            <ul className="smh-meet">
              {home.meetings.map((m) => {
                const chip = meetingChip(m);
                const counts = notesCounts(m.notesJson);
                return (
                  <li key={m.id}>
                    <span>
                      <b>{m.name}</b>
                      <em>{[whenLabel(m.at, now), minutes(m.durationSeconds), m.people ? `${m.people} people` : "", counts].filter(Boolean).join(" · ")}</em>
                    </span>
                    <span className={`ui-chip ui-chip--${chip.tone}`}>{chip.label}</span>
                    <Link href={chip.label === "Notes ready" ? `${NOTE_TAKER}/${m.id}/notes` : `${NOTE_TAKER}/${m.id}`} className="ui-navlink">
                      {chip.label === "Notes ready" ? "Read" : "Open"}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="ui-panel" aria-labelledby="smh-decks">
          <div className="smh-head">
            <div>
              <h2 id="smh-decks" className="ui-section-title">
                Presentations
              </h2>
              <p className="smh-sub">Decks made from your notes</p>
            </div>
            <Link href="/intelligence/presentations" className="ui-navlink">
              All
            </Link>
          </div>
          {home.decks.length === 0 ? (
            <p className="smh-empty">No decks yet. Make one from a meeting&apos;s notes.</p>
          ) : (
            <ul className="smh-decks">
              {home.decks.map((d) => (
                <li key={d.id}>
                  <span className="smh-decks__thumb" aria-hidden />
                  <span>
                    <b>{d.title}</b>
                    <em>
                      {d.slides} slides · {whenLabel(d.createdAt, now, false)}
                    </em>
                  </span>
                  <Link href={`/intelligence/presentations/${d.id}`} className="ui-btn ui-btn--secondary">
                    Present
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="ui-panel" aria-labelledby="smh-week">
        <div className="smh-head">
          <div>
            <h2 id="smh-week" className="ui-section-title">
              This week
            </h2>
            <p className="smh-sub">Your scheduled and recorded meetings, Monday to Friday</p>
          </div>
          <Link href={NOTE_TAKER} className="ui-navlink">
            Schedule a meeting
          </Link>
        </div>
        <ol className="smh-week">
          {home.week.map((d) => (
            <li key={d.label} className={d.today ? "is-today" : undefined} aria-current={d.today ? "date" : undefined}>
              <b>
                {d.label}
                {d.today ? " · today" : ""}
              </b>
              {d.items.map((i) => (
                <Link key={i.id} href={`${NOTE_TAKER}/${i.id}`}>
                  {i.name} <span>{i.time}</span>
                </Link>
              ))}
            </li>
          ))}
        </ol>
      </section>

      <div className="smh-three">
        <MeetingCards home={home} now={now} />
        <section className="ui-panel" aria-labelledby="smh-acct">
          <h2 id="smh-acct" className="ui-section-title">
            Your account and help
          </h2>
          <p className="smh-sub">The basics, in one place</p>
          <ul className="smh-acct">
            <li>
              <span>Last signed in</span>
              <span className="smh-acct__value">{lastSignIn ? whenLabel(lastSignIn, now) : "—"}</span>
            </li>
            <li>
              <span>Password</span>
              <Link href="/intelligence/forgot-password" className="ui-navlink">
                Change password
              </Link>
            </li>
            <li className="smh-acct__ask">
              <span>Need more of the portal?</span>
              <AccessRequestCard areas={areas} pendingSince={pendingSince} />
            </li>
            <li>
              <span>Help</span>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="ui-navlink">
                {SUPPORT_EMAIL}
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
