import { DesktopNav } from "@/components/nav/DesktopNav";
import { MobileNav } from "@/components/nav/MobileNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-dvh w-full flex flex-col md:block">
      <DesktopNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-[env(safe-area-inset-top)] md:pt-16 md:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
