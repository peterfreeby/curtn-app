import Link from "next/link";
import {
  FaqFooter,
  FaqHeader,
  FaqSection,
  FaqToc,
} from "@/components/faq/FaqLayout";

const TOC = [
  { id: "what", label: "What is Curtn?" },
  { id: "who-for", label: "Who is it for?" },
  { id: "how-it-works", label: "How it works" },
  { id: "what-its-not", label: "What Curtn is not" },
  { id: "where-data-comes-from", label: "Where the data comes from" },
  { id: "who-runs-it", label: "Who runs Curtn?" },
];

export default function WhatIsCurtnPage() {
  return (
    <div className="px-4 py-10 max-w-2xl mx-auto">
      <FaqHeader
        eyebrow="Help · About"
        title="What is Curtn?"
        intro="Curtn is a performance archive for live theater — a place to log what you've seen, find what's worth seeing, and keep a public record of the work."
      />

      <FaqToc items={TOC} />

      <FaqSection id="what" title="What is Curtn?">
        <p>
          Curtn is a performance archive for live theater. You can log shows
          you've seen, write reviews, build lists, follow other people whose
          taste you trust, and browse pages for venues, production companies,
          and artists.
        </p>
        <p>
          If you've used Letterboxd for films or RateYourMusic for albums, the
          shape is familiar. The big difference is that live performance is
          ephemeral — a run closes, the production never tours, the cast goes
          on to other things. Curtn exists so the record doesn't disappear with
          the run.
        </p>
      </FaqSection>

      <FaqSection id="who-for" title="Who is it for?">
        <p>
          Anyone who goes to the theater. Audiences who want a place to keep
          track of what they've seen. Artists who want a public record of their
          work. Researchers, critics, students, and history-keepers who want
          something better than a half-remembered Playbill stack.
        </p>
        <p>
          Curtn skews toward live theater in the broadest sense — Broadway and
          Off-Broadway, regional, fringe, devised work, dance, opera, and
          experimental performance all belong here.
        </p>
      </FaqSection>

      <FaqSection id="how-it-works" title="How it works">
        <p>
          The basic objects on Curtn are <strong>shows</strong>, the productions
          that stage them (<strong>runs</strong> and <strong>performances</strong>),
          and the people, companies, and venues attached to those runs.
        </p>
        <p>
          You can mark performances as seen, rate them, review them, and group
          them into lists. Your feed surfaces what people you follow are
          logging and writing. Venues, companies, and artists each have a
          dedicated page that anyone can help keep accurate — and that the
          person or organization in question can{" "}
          <Link
            href="/faq/claiming"
            className="text-curtn-coral hover:underline"
          >
            claim and steward directly
          </Link>
          .
        </p>
      </FaqSection>

      <FaqSection id="what-its-not" title="What Curtn is not">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Not a ticketing platform.</strong> Curtn doesn't sell
            tickets, take payments, or replace your relationship with a box
            office. Where helpful, pages link out to where you can actually buy
            seats.
          </li>
          <li>
            <strong>Not primarily a marketing channel.</strong> Artists,
            companies, and venues are welcome to share their work here — but
            the center of gravity is the archive and the audience, not press
            copy.
          </li>
          <li>
            <strong>Not a moderated news site.</strong> Reviews are personal —
            yours alone — and the platform doesn't aggregate them into an
            authoritative score.
          </li>
        </ul>
      </FaqSection>

      <FaqSection
        id="where-data-comes-from"
        title="Where the data comes from"
      >
        <p>
          A lot of what you see on Curtn was put there by users like you —
          logging a show that didn't exist yet, adding a cast member,
          correcting a date. Some pages start as imports from public sources
          (theater listings, programs, press kits) so the archive isn't empty
          on day one.
        </p>
        <p>
          All edits are recorded in a public edit history. If a page looks
          wrong, you can fix it directly (when it's unclaimed) or propose a
          change (when it's claimed). Bad edits can be reverted.
        </p>
      </FaqSection>

      <FaqSection id="who-runs-it" title="Who runs Curtn?">
        <p>
          Curtn is a small, independent project — currently built and
          maintained by one person. It's not venture-funded and isn't owned by
          a larger company, which keeps the focus on the archive instead of
          growth metrics. Down the line we may run modest, on-topic ads —
          most likely letting artists promote their own work to relevant
          audiences — but the experience won't be ad-driven.
        </p>
      </FaqSection>

      <FaqFooter />
    </div>
  );
}
