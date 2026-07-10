import { Sidebar, MobileTabBar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { DemoProvider } from "@/lib/demo/store";
import { loadLiveBundle } from "@/lib/live/load";

// Session-dependent data — never statically prerender the app shell.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Live workspace when Supabase + session exist; demo fixtures otherwise.
  const bundle = await loadLiveBundle();

  return (
    <DemoProvider initialData={bundle}>
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
