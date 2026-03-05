import { DesktopNav } from "@/components/nav/DesktopNav";
import { MobileNav } from "@/components/nav/MobileNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DesktopNav />
      <main className="pt-16 md:pt-16 pb-20 md:pb-0 min-h-screen">
        {children}
      </main>
      <MobileNav />
    </>
  );
}
