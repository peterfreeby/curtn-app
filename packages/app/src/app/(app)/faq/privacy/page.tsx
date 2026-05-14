import {
  FaqFooter,
  FaqHeader,
  FaqSection,
  FaqToc,
} from "@/components/faq/FaqLayout";

const TOC = [
  { id: "summary", label: "The short version" },
  { id: "what-we-collect", label: "What we collect" },
  { id: "public-vs-private", label: "What's public vs. private" },
  { id: "third-parties", label: "Who else touches your data" },
  { id: "ads", label: "Ads, tracking & analytics" },
  { id: "retention", label: "Retention & deletion" },
  { id: "rights", label: "Your rights" },
  { id: "contact", label: "Contact" },
  { id: "changes", label: "Changes to this policy" },
];

export default function PrivacyFaqPage() {
  return (
    <div className="px-4 py-10 max-w-2xl mx-auto">
      <FaqHeader
        eyebrow="Help · Privacy"
        title="Privacy"
        intro="What Curtn collects, what it doesn't, and how we handle the data you give us. Written in plain language — not as a legal contract."
      />

      <FaqToc items={TOC} />

      <FaqSection id="summary" title="The short version">
        <ul className="list-disc pl-5 space-y-1">
          <li>We collect a phone number to sign you in. That's it for PII.</li>
          <li>We don't ask for your email, name, or address.</li>
          <li>
            We don't run ads today and don't sell your data. If we ever do run
            ads, they'll be on-topic (e.g. artists promoting their work) and
            won't rely on third-party behavioral tracking.
          </li>
          <li>
            Things you post (reviews, lists, edits) are public by design —
            that's the whole point of an archive.
          </li>
          <li>You can delete your account whenever you want.</li>
        </ul>
      </FaqSection>

      <FaqSection id="what-we-collect" title="What we collect">
        <p>
          <strong>Account data.</strong> Your phone number (used only for
          sign-in), the username you choose, your display name, and anything
          else you choose to add to your profile (bio, photo, location).
        </p>
        <p>
          <strong>Content you create.</strong> Reviews, ratings, lists,
          performances you mark as seen, edits to community pages, claim
          submissions, and the like.
        </p>
        <p>
          <strong>Basic activity.</strong> Enough information to make the
          product work — sign-in events, which page you last visited from your
          dashboard, whether a claim of yours has had recent activity. We
          don't build behavioral profiles.
        </p>
        <p>
          <strong>Standard request data.</strong> When your browser loads a
          page, it sends your IP address and user-agent to our hosting
          provider. That's true of every website.
        </p>
      </FaqSection>

      <FaqSection
        id="public-vs-private"
        title="What's public vs. private"
      >
        <p>
          <strong>Public by default:</strong> reviews, ratings, lists, your
          seen-history, your edits to community pages, your username and
          display name, and anything you put on your profile.
        </p>
        <p>
          <strong>Always private:</strong> your phone number, your sign-in
          events, your blocked-user list, and any private notes attached to
          claims or removal requests.
        </p>
      </FaqSection>

      <FaqSection id="third-parties" title="Who else touches your data">
        <p>
          Curtn is built with a small number of standard service providers:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Firebase Authentication</strong> (Google) — handles
            sign-in. Your phone number is verified through Firebase.
          </li>
          <li>
            <strong>MongoDB Atlas</strong> — the database where your account
            and content live.
          </li>
          <li>
            <strong>Vercel</strong> — hosts the website and serves it to your
            browser.
          </li>
        </ul>
        <p>
          These are service providers, not partners. They process your data on
          our behalf to run Curtn. We don't sell or share data with advertisers
          or data brokers.
        </p>
      </FaqSection>

      <FaqSection id="ads" title="Ads, tracking & analytics">
        <p>
          Curtn doesn't run ads today. We don't use third-party ad networks,
          retargeting pixels, or behavioral tracking, and we don't share your
          activity with anyone for marketing.
        </p>
        <p>
          We may run ads in the future — most likely letting artists,
          companies, and venues promote their own work to relevant audiences
          on Curtn itself. If we do:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Ads will be clearly labeled as such.
          </li>
          <li>
            Targeting will use on-Curtn signals only (e.g. the kind of work
            you've logged or followed). We won't sell your activity to outside
            advertisers or load third-party ad SDKs that track you across the
            web.
          </li>
          <li>
            We'll update this page with details before flipping anything on.
          </li>
        </ul>
        <p>
          We may also add lightweight, aggregate analytics over time to
          understand which features get used. If we do, we'll name the
          provider here.
        </p>
      </FaqSection>

      <FaqSection id="retention" title="Retention & deletion">
        <p>
          We keep your account and content for as long as your account is
          active. When you delete your account:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Your reviews, lists, and seen-history are removed from public view.
          </li>
          <li>
            Edits you made to community-maintained pages remain in the public
            edit history (an archive isn't useful if it can be retroactively
            erased), but are no longer attributed to you by name.
          </li>
          <li>Your phone number is dissociated from the account.</li>
          <li>
            Backups may retain residual copies for a short rolling window
            before they roll over.
          </li>
        </ul>
      </FaqSection>

      <FaqSection id="rights" title="Your rights">
        <p>
          Depending on where you live (notably the EU/UK and California), you
          may have specific rights over your data — access, correction,
          deletion, portability. Curtn intends to honor those rights for all
          users regardless of jurisdiction:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Access:</strong> ask us for a copy of what we hold about
            you.
          </li>
          <li>
            <strong>Correction:</strong> fix anything inaccurate — most of it
            you can edit yourself from your profile.
          </li>
          <li>
            <strong>Deletion:</strong> delete your account (see above).
          </li>
          <li>
            <strong>Portability:</strong> request an export of your reviews,
            lists, and seens in a machine-readable format.
          </li>
        </ul>
        <p>
          Some of these are fully self-serve; others currently go through a
          manual request. Reach out and we'll handle it.
        </p>
      </FaqSection>

      <FaqSection id="contact" title="Contact">
        <p>
          Privacy questions, data requests, or anything else covered here:
          reach out and a human will answer. Curtn is a small project — we
          don't have a privacy desk, but we do read every message.
        </p>
      </FaqSection>

      <FaqSection id="changes" title="Changes to this policy">
        <p>
          We'll update this page as the product changes. Material changes —
          new categories of data, new third-party services, anything that
          meaningfully affects what's public — will be flagged at the top of
          this page for a reasonable window.
        </p>
        <p className="text-sm text-curtn-muted">
          This page is intended to describe Curtn's practices in plain
          language. It's not a contract, and it doesn't grant or remove rights
          beyond those you have under the laws of your jurisdiction.
        </p>
      </FaqSection>

      <FaqFooter />
    </div>
  );
}
