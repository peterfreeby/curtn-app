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
    <div className="h-dvh w-full flex flex-col md:block">
      <DesktopNav />
      <MobileTopBar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden md:pt-16 md:pb-0 pb-20">
        {children}
      </main>
      {modal}
      <MobileFloatingBar />
    </div>
  );
}
