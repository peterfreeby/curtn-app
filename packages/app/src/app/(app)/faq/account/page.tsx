import {
  FaqFooter,
  FaqHeader,
  FaqSection,
  FaqToc,
} from "@/components/faq/FaqLayout";

const TOC = [
  { id: "sign-up", label: "Signing up & signing in" },
  { id: "phone-number", label: "Why phone numbers?" },
  { id: "username", label: "Your username & display name" },
  { id: "change-phone", label: "Changing your phone number" },
  { id: "lost-access", label: "I've lost access to my phone" },
  { id: "delete", label: "Deleting your account" },
];

export default function AccountFaqPage() {
  return (
    <div className="px-4 py-10 max-w-2xl mx-auto">
      <FaqHeader
        eyebrow="Help · Account"
        title="Account & sign-in"
        intro="How accounts work on Curtn, why we use phone numbers, and what to do if something goes wrong."
      />

      <FaqToc items={TOC} />

      <FaqSection id="sign-up" title="Signing up & signing in">
        <p>
          Curtn uses phone numbers to sign in. When you sign up — or sign back
          in on a new device — we send a one-time code by SMS, and you enter it
          to verify the number. There's no password to remember and no email
          loop to manage.
        </p>
        <p>
          Sign-in is handled by Firebase Authentication. We never see your
          password (there isn't one), and the code we send expires quickly.
        </p>
      </FaqSection>

      <FaqSection id="phone-number" title="Why phone numbers?">
        <p>
          Phone numbers give us a single, reliable identifier per account
          without us needing to build (or pay for) an email infrastructure or
          handle password resets. They also raise the cost of spinning up
          throwaway accounts a little, which helps keep the edit history clean.
        </p>
        <p>
          Your phone number is private. It's never shown on your profile, and
          we don't share it with other users.
        </p>
      </FaqSection>

      <FaqSection id="username" title="Your username & display name">
        <p>
          Your <strong>username</strong> is what shows up in your profile URL
          (curtn.io/u/yourname) and in mentions. It has to be unique and is
          chosen when you sign up.
        </p>
        <p>
          Your <strong>display name</strong> is what other users see attached
          to your reviews, lists, and edits. You can change it at any time
          from your profile settings.
        </p>
      </FaqSection>

      <FaqSection id="change-phone" title="Changing your phone number">
        <p>
          If you're switching numbers, you can update your phone in your
          profile settings. You'll need access to both numbers briefly during
          the change — we'll verify the new one before switching the old one
          off.
        </p>
      </FaqSection>

      <FaqSection id="lost-access" title="I've lost access to my phone">
        <p>
          If you can't receive SMS at the number on your account, get in touch
          with us. Because we don't store passwords or backup email addresses,
          recovery isn't fully automated yet — we'll work through it with you
          manually.
        </p>
      </FaqSection>

      <FaqSection id="delete" title="Deleting your account">
        <p>
          You can delete your account from your profile settings. When you do:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Your reviews, lists, and seen-history are removed from public view.
          </li>
          <li>
            Edits you made to community-maintained pages remain (the edit
            history exists for everyone's benefit), but they're no longer
            attributed to you by name.
          </li>
          <li>
            Any pages you claimed are released back to unclaimed so someone
            else can pick them up.
          </li>
          <li>Your phone number is dissociated from the account.</li>
        </ul>
        <p>Account deletion is permanent — there's no undo on the user end.</p>
      </FaqSection>

      <FaqFooter />
    </div>
  );
}
