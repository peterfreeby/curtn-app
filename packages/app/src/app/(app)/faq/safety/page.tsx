import {
  FaqFooter,
  FaqHeader,
  FaqSection,
  FaqToc,
} from "@/components/faq/FaqLayout";

const TOC = [
  { id: "principles", label: "How we think about safety" },
  { id: "not-allowed", label: "What's not allowed" },
  { id: "self-promo", label: "Self-promotion by artists" },
  { id: "reviews", label: "Reviews & criticism" },
  { id: "reporting", label: "Reporting a user or piece of content" },
  { id: "what-happens", label: "What happens after a report" },
  { id: "blocking", label: "Blocking another user" },
  { id: "removal", label: "Removing content about you" },
  { id: "edge-cases", label: "Disputes between artists, venues & audiences" },
];

export default function SafetyFaqPage() {
  return (
    <div className="px-4 py-10 max-w-2xl mx-auto">
      <FaqHeader
        eyebrow="Help · Safety"
        title="Safety, abuse & reporting"
        intro="What's allowed on Curtn, what isn't, and how to flag a problem."
      />

      <FaqToc items={TOC} />

      <FaqSection id="principles" title="How we think about safety">
        <p>
          Curtn is meant to be a public record and a place to talk about the
          work. That means we want strong opinions, sharp criticism, and honest
          history. It also means we don't want harassment, threats, or
          libelous claims about real people — and we'll act on those when they
          turn up.
        </p>
        <p>
          The line we try to draw is between <strong>what you said</strong>{" "}
          (fair game) and <strong>how you said it about whom</strong>{" "}
          (where most problems live).
        </p>
      </FaqSection>

      <FaqSection id="not-allowed" title="What's not allowed">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Harassment of a specific person.</strong> Persistent
            targeting, slurs, threats, sexualized comments about real people
            without their consent.
          </li>
          <li>
            <strong>Doxxing.</strong> Posting someone's home address, phone
            number, employer, or other private information.
          </li>
          <li>
            <strong>Impersonation.</strong> Pretending to be someone else,
            including claiming a page that isn't yours.
          </li>
          <li>
            <strong>Knowing falsehoods presented as fact.</strong> Critiquing a
            performance is fine. Asserting that an artist did something
            criminal when you know they didn't is not.
          </li>
          <li>
            <strong>Spam and scams.</strong> Bulk fake reviews, sock-puppet
            accounts, ratings rings, off-topic links that exist only to drive
            traffic somewhere unrelated. Artists promoting their own work is
            welcome — see below.
          </li>
          <li>
            <strong>Content involving minors that isn't directly about their
            stage work.</strong>
          </li>
        </ul>
      </FaqSection>

      <FaqSection id="self-promo" title="Self-promotion by artists">
        <p>
          If you're an artist, company, or venue, you're welcome to use Curtn
          to share your work. Linking your upcoming run on your own page,
          posting a list of your past performances, telling your followers
          about something you're producing — all good. That's a healthy part
          of an archive that lives and breathes.
        </p>
        <p>
          What we push back on is volume and dishonesty, not promotion itself.
          Don't make sock-puppet accounts to inflate your own ratings. Don't
          carpet-bomb unrelated pages with links to your show. Don't pretend
          to be an unaffiliated audience member writing about your own work.
        </p>
      </FaqSection>

      <FaqSection id="reviews" title="Reviews & criticism">
        <p>
          Reviews are personal. You're allowed to think a show was bad,
          boring, derivative, or that a performance didn't land. You don't need
          to be nice to be on Curtn.
        </p>
        <p>
          What we ask: punch up at the work, not down at the worker. A review
          that says the staging was incoherent is fine. A review that mocks an
          actor's body is not. A review that says a director's vision was
          confused is fine. A review that calls them a slur is not.
        </p>
      </FaqSection>

      <FaqSection
        id="reporting"
        title="Reporting a user or piece of content"
      >
        <p>
          Most reviews, lists, and profile pages have a report option in their
          menu. Choose the closest reason and add a sentence of context if it
          helps. Reports come straight to a human.
        </p>
        <p>
          For edits to a venue, company, or person page, you can also submit a
          removal request from the edit history menu — useful when the issue
          is what was written into the record rather than who wrote it.
        </p>
      </FaqSection>

      <FaqSection id="what-happens" title="What happens after a report">
        <p>
          A real person reads every report. Depending on what's there, we may:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Leave the content up (e.g. it's harsh but fair criticism).</li>
          <li>Hide it from public view while keeping the audit trail.</li>
          <li>Remove it entirely.</li>
          <li>Warn or suspend the user who posted it.</li>
          <li>Permanently ban accounts in the worst cases.</li>
        </ul>
        <p>
          We try to respond quickly but Curtn is small — give us a beat. If
          something is urgent (an active threat, content involving a minor),
          flag that explicitly in your report.
        </p>
      </FaqSection>

      <FaqSection id="blocking" title="Blocking another user">
        <p>
          You can block any user from their profile. Blocked users can't see
          your reviews and lists, can't message or mention you, and their
          content disappears from your feed. Blocking is one-directional and
          private — they aren't told.
        </p>
      </FaqSection>

      <FaqSection id="removal" title="Removing content about you">
        <p>
          If you're an artist, venue, or company and something in the public
          record about you is wrong, defamatory, or unsafe to leave up, you
          have a few options:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            If the page is unclaimed, you can edit it directly or claim it and
            edit. See the{" "}
            <a
              href="/faq/claiming"
              className="text-curtn-coral hover:underline"
            >
              claiming FAQ
            </a>
            .
          </li>
          <li>
            If a specific edit in the history is the problem, submit a removal
            request from the history menu. Approved removals hide the content
            from public view but keep the audit record.
          </li>
          <li>
            If a review crosses the line into harassment or false statements of
            fact, report it. We'll look.
          </li>
        </ul>
      </FaqSection>

      <FaqSection
        id="edge-cases"
        title="Disputes between artists, venues & audiences"
      >
        <p>
          Curtn isn't equipped to arbitrate every grievance between the people
          who make work and the people who watch it. We can act on harassment
          and clearly false claims. We can't settle whether your performance
          was actually as good as you think it was, or whether a venue handled
          a bad night well.
        </p>
        <p>
          When in doubt: report the specific content that breaks the rules
          above, not the underlying disagreement.
        </p>
      </FaqSection>

      <FaqFooter />
    </div>
  );
}
