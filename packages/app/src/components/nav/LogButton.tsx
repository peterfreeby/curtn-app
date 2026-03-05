import Link from "next/link";

export function LogButton() {
  return (
    <Link
      href="/log"
      className="bg-curtn-coral text-curtn-deep px-4 py-2 rounded-lg text-sm font-semibold hover:bg-curtn-red active:scale-[0.98] transition-all duration-200"
    >
      Log
    </Link>
  );
}
