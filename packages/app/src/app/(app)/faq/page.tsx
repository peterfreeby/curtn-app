import Link from "next/link";
import { Icon } from "@/components/icons/Icons";

const TOPICS = [
  {
    slug: "what-is-curtn",
    title: "What is Curtn?",
    blurb:
      "A short overview of what Curtn is, who it's for, and how it's different from a ticketing or social platform.",
  },
  {
    slug: "claiming",
    title: "Claiming your page",
    blurb:
      "How actors, production companies, and venues claim their page on Curtn — and how to manage your identity once you do.",
  },
  {
    slug: "account",
    title: "Account & sign-in",
    blurb:
      "How accounts work, why we use phone numbers, and what to do if you've lost access or want to delete your account.",
  },
  {
    slug: "safety",
    title: "Safety, abuse & reporting",
    blurb:
      "What's allowed on Curtn, what isn't, and how to flag a problem when you see one.",
  },
  {
    slug: "privacy",
    title: "Privacy",
    blurb:
      "What Curtn collects, who else touches your data, and how to delete your account.",
  },
];

export default function FaqIndexPage() {
  return (
    <div className="px-4 py-10 max-w-2xl mx-auto">
      <p className="text-xs uppercase tracking-widest text-curtn-muted mb-2">
        Help
      </p>
      <h1 className="text-3xl font-semibold text-curtn-cream mb-2">FAQ</h1>
      <p className="text-curtn-muted mb-8">
        Answers to common questions about using Curtn.
      </p>

      <ul className="space-y-3">
        {TOPICS.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/faq/${t.slug}`}
              className="block bg-curtn-surface border border-curtn-dark/30 dog-ear px-5 py-4 hover:border-curtn-coral/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <Icon
                  name="question"
                  size={20}
                  className="text-curtn-muted mt-0.5 shrink-0"
                />
                <div>
                  <h2 className="text-curtn-cream font-medium mb-1">
                    {t.title}
                  </h2>
                  <p className="text-sm text-curtn-muted">{t.blurb}</p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
