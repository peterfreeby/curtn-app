import Link from "next/link";

export function LogButton() {
  return (
    <Link
      href="/log"
      scroll={false}
      className="bg-curtn-coral text-curtn-deep px-4 py-2 dog-ear dog-ear-dark text-[13px] font-display font-bold uppercase tracking-wide hover:bg-curtn-red active:scale-[0.98] transition-all duration-200"
    >
      Log
    </Link>
  );
}
