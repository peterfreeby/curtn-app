import { DesktopNav } from "@/components/nav/DesktopNav";
import { MobileTopBar } from "@/components/nav/MobileTopBar";
import { MobileFloatingBar } from "@/components/nav/MobileFloatingBar";

export default function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh w-full md:block overflow-x-hidden">
      <DesktopNav />
      <MobileTopBar />
      <main className="pt-[calc(env(safe-area-inset-top)+3rem)] md:pt-16 pb-[calc(env(safe-area-inset-bottom)+4rem)] md:pb-0">
        {children}
      </main>
      {modal}
      <MobileFloatingBar />
    </div>
  );
}
