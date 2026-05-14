import Link from "next/link";
import {
  FaqFooter,
  FaqHeader,
  FaqSection,
  FaqToc,
} from "@/components/faq/FaqLayout";

const TOC = [
  { id: "what-is-a-claim", label: "What is a claim?" },
  { id: "who-can-claim", label: "Who can claim what?" },
  { id: "how-to-claim", label: "How do I claim my page?" },
  { id: "review", label: "How are claims reviewed?" },
  { id: "verification", label: "Verification signals" },
  { id: "after-claim", label: "What changes once I'm the claimant?" },
  { id: "proposals", label: "Edits from other users (proposals)" },
  { id: "history", label: "Edit history & reverts" },
  { id: "transfer", label: "Transferring your claim" },
  { id: "activity", label: "The 12-month activity rule" },
  { id: "removal", label: "Removing content or hiding history" },
  { id: "unclaimed", label: "What happens to unclaimed pages?" },
];

export default function ClaimingFaqPage() {
  return (
    <div className="px-4 py-10 max-w-2xl mx-auto">
      <FaqHeader
        eyebrow="Help · Claiming"
        title="Claiming your page on Curtn"
        intro="Everything an actor, production company, or venue should know about managing their identity on Curtn."
      />

      <FaqToc items={TOC} />

      <FaqSection id="what-is-a-claim" title="What is a claim?">
        <p>
          A claim is how you tell Curtn that a page belongs to you. Most pages
          on Curtn start out unclaimed — they exist because someone logged a
          show, run, or performance, or because Curtn imported a record from a
          public source. Claiming a page moves it from a community-maintained
          record to one you steward directly.
        </p>
        <p>
          The three kinds of pages you can claim are <strong>venues</strong>,{" "}
          <strong>production companies</strong>, and <strong>people</strong>{" "}
          (actors, directors, designers, etc.).
        </p>
      </FaqSection>

      <FaqSection id="who-can-claim" title="Who can claim what?">
        <p>
          <strong>Actors and other artists</strong> can claim their own person
          page. If a producer wants to manage an artist's page on their behalf,
          the artist should claim it first and then transfer or share access
          (transfers are covered below).
        </p>
        <p>
          <strong>Production companies</strong> can claim their company page.
          Anyone authorized to speak for the company can submit the claim —
          you'll be asked to show that authority during review.
        </p>
        <p>
          <strong>Venues</strong> can claim their venue page. A staff member or
          owner can submit; the same evidence rules apply.
        </p>
      </FaqSection>

      <FaqSection id="how-to-claim" title="How do I claim my page?">
        <p>
          On any unclaimed venue, company, or person page, you'll see a banner
          inviting you to claim it. Tap it and you'll be taken to a short form
          where you can:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Tell us, in your own words, why this page is yours.</li>
          <li>
            Optionally link an external profile (your official website, an
            Instagram, a verified IMDb, etc.) — see Verification below for what
            helps most.
          </li>
        </ul>
        <p>
          Submitting the form creates a pending claim. You can see all the
          claims you've submitted on your{" "}
          <Link href="/dashboard" className="text-curtn-coral hover:underline">
            dashboard
          </Link>
          .
        </p>
      </FaqSection>

      <FaqSection id="review" title="How are claims reviewed?">
        <p>
          Every claim is reviewed manually by a Curtn admin. We're a small
          team, so reviews are not instant — give it a few days. You'll get an
          in-app notification when your claim is approved or declined.
        </p>
        <p>
          If we decline, we'll include a reason. The common ones are:
          insufficient evidence, a competing claim already in flight, or a page
          that needs to be split or merged before a claim makes sense.
          Declining isn't permanent — you can resubmit with more context.
        </p>
      </FaqSection>

      <FaqSection id="verification" title="Verification signals">
        <p>
          You don't need every signal below to get approved — they're just the
          strongest forms of evidence we look at. The more of these you can
          show, the faster a reviewer can say yes:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Webmaster verification.</strong> If you control the website
            for a venue or company, you can add a small token we provide to
            your site (or a DNS record) and we'll confirm the link
            automatically. This is the strongest single signal.
          </li>
          <li>
            <strong>External profile links.</strong> Linking an official social
            profile, your company's listing on a recognized industry directory,
            or a personal site that already references the page helps a lot.
          </li>
          <li>
            <strong>Trust-graph endorsements.</strong> If an already-claimed
            page that's clearly connected to you (your agency, the venue you
            perform at, your producing company) endorses your claim, that
            counts as a meaningful vouch.
          </li>
        </ul>
        <p className="text-sm text-curtn-muted">
          These signals add up to a score reviewers can see at a glance. In
          some cases, a claim with a high enough score may be auto-approved.
        </p>
      </FaqSection>

      <FaqSection id="after-claim" title="What changes once I'm the claimant?">
        <p>
          Once approved, the page is marked as claimed and you appear as its
          steward. Concretely:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            You can edit the claimable fields on your page directly — name,
            description, links, photos, and so on — and your edits publish
            immediately.
          </li>
          <li>
            Other users no longer have direct edit access. Instead, their edits
            arrive as proposals you can approve or decline.
          </li>
          <li>
            Your dashboard surfaces the page along with anything that needs
            your attention (pending proposals, transfer offers, etc.).
          </li>
        </ul>
      </FaqSection>

      <FaqSection id="proposals" title="Edits from other users (proposals)">
        <p>
          When someone else tries to edit your page, their change becomes a{" "}
          <strong>proposal</strong> queued for your review. You'll see it on
          your dashboard and on a strip at the top of the page itself.
        </p>
        <p>
          You can approve a proposal (it publishes), decline it (it doesn't),
          or ignore it. Ignored proposals don't sit forever — after 10 days you
          get a reminder, and after 14 days they auto-approve. This keeps
          obviously-correct edits (a fixed typo, an updated address) from being
          blocked by an inactive claimant.
        </p>
        <p>
          If two proposals would conflict with each other, approving one
          automatically declines the other.
        </p>
      </FaqSection>

      <FaqSection id="history" title="Edit history & reverts">
        <p>
          Every edit to a venue, company, or person page is recorded. You can
          see the full history on the page itself, including who made the edit
          and what they changed.
        </p>
        <p>
          If something gets edited in a way you don't want — even by you, by
          mistake — you can revert any entry in the history. A revert is itself
          recorded as a new entry, so the trail is always complete.
        </p>
      </FaqSection>

      <FaqSection id="transfer" title="Transferring your claim">
        <p>
          If you need to hand off a page — your manager is taking over, you're
          leaving a company, the venue changed ownership — you can transfer
          your claim from your dashboard.
        </p>
        <p>
          You pick the recipient by their Curtn username and add an optional
          message. They have <strong>14 days</strong> to accept or decline.
          During that window the claim still belongs to you; if they don't
          respond, the offer expires and nothing changes.
        </p>
      </FaqSection>

      <FaqSection id="activity" title="The 12-month activity rule">
        <p>
          Claims aren't forever-by-default. To make sure pages don't get stuck
          with stewards who've moved on, Curtn watches for activity on each
          claimed page.
        </p>
        <p>
          If a claimant goes 11 months without any activity (visiting the
          dashboard, editing the page, responding to a proposal), we send a
          warning notification. At 12 months without activity, the claim
          expires and the page returns to unclaimed — at which point anyone
          else can claim it.
        </p>
        <p>
          You don't need to do anything special to keep a claim — just use
          Curtn occasionally on behalf of your page.
        </p>
      </FaqSection>

      <FaqSection id="removal" title="Removing content or hiding history">
        <p>
          Sometimes a piece of edit history shouldn't stay public — a real name
          that should be a stage name, an old address that's now a private
          residence, a description written in bad faith. You can submit a{" "}
          <strong>removal request</strong> from the edit history menu and an
          admin will review it.
        </p>
        <p>
          If approved, the entry stays in the audit trail (we never destroy
          history) but its contents are hidden from non-admin viewers. Curtn
          isn't a venue for litigating disputes, but it is a tool for keeping
          your public identity accurate.
        </p>
      </FaqSection>

      <FaqSection id="unclaimed" title="What happens to unclaimed pages?">
        <p>
          Most pages on Curtn are unclaimed and that's fine — the community
          keeps them accurate. Any signed-in user can edit an unclaimed page
          directly, and every change is recorded in the page's edit history so
          bad edits can be reverted.
        </p>
        <p>
          When you claim a page, all of that prior history stays attached — you
          inherit a record, you don't start fresh.
        </p>
      </FaqSection>

      <FaqFooter />
    </div>
  );
}
