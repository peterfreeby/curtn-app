import Link from "next/link";
import { Icon } from "@/components/icons/Icons";

export function FaqSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-10 scroll-mt-24">
      <h2 className="text-xl font-semibold text-curtn-cream mb-3">{title}</h2>
      <div className="space-y-3 text-curtn-cream/90 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function FaqHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <>
      <Link
        href="/faq"
        className="inline-flex items-center gap-1.5 text-sm text-curtn-muted hover:text-curtn-cream transition-colors mb-4"
      >
        <Icon name="arrow-left" size={14} />
        All FAQs
      </Link>

      <p className="text-xs uppercase tracking-widest text-curtn-muted mb-2">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-semibold text-curtn-cream mb-3">{title}</h1>
      <p className="text-curtn-muted mb-8">{intro}</p>
    </>
  );
}

export function FaqToc({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav className="bg-curtn-surface border border-curtn-dark/30 dog-ear px-5 py-4 mb-10">
      <p className="text-xs uppercase tracking-widest text-curtn-muted mb-3">
        On this page
      </p>
      <ul className="space-y-1.5 text-sm">
        {items.map((t) => (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              className="text-curtn-cream/80 hover:text-curtn-coral transition-colors"
            >
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function FaqFooter({ children }: { children?: React.ReactNode }) {
  return (
    <div className="border-t border-curtn-dark/30 pt-6 mt-12 text-sm text-curtn-muted">
      {children ?? (
        <p>
          Something missing or unclear? Curtn is small and actively built — let
          us know and we'll update this page.
        </p>
      )}
    </div>
  );
}
