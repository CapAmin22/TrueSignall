import { Sidebar, MobileTabBar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { DemoProvider } from "@/lib/demo/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="md:pl-60">
          <Topbar />
          <main className="mx-auto max-w-6xl px-4 py-6 pb-20 md:px-6 md:pb-8">{children}</main>
        </div>
        <MobileTabBar />
      </div>
    </DemoProvider>
  );
}
