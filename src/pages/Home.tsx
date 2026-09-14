import { useEffect } from 'react';
import { Navbar } from '@/components/Sidebar/Navbar';
import { LeftSidebar } from '@/components/Sidebar/LeftSidebar';
import { RightSidebar } from '@/components/Sidebar/RightSidebar';
import { Feed } from '@/components/Feed/Feed';
import { ChatPanel } from '@/components/Chat/ChatPanel';
import { useUIStore } from '@/store';

// AppLayout is shared across all authenticated pages
export function AppLayout({ children }: { children: React.ReactNode }) {
  const { darkMode } = useUIStore();

  // ✅ Fix: dark mode applied to <html>, not a nested div
  // (already handled in main.tsx + store toggle, but keep in sync)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    // No dark class here — Tailwind reads it from <html>
    <div className="min-h-screen bg-gray-100 dark:bg-surface-dark">
      <Navbar />
      <div className="max-w-[1400px] mx-auto pt-14 flex">
        {/* Left sidebar — sticky */}
        <div className="hidden lg:block w-72 flex-shrink-0">
          <LeftSidebar />
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 py-4 max-w-[680px] w-full mx-auto lg:mx-0">
          {children}
        </main>

        {/* Right sidebar — sticky */}
        <div className="hidden xl:block w-72 flex-shrink-0">
          <RightSidebar />
        </div>
      </div>

      {/* Floating chat panel */}
      <ChatPanel />
    </div>
  );
}

export function HomePage() {
  return (
    <AppLayout>
      <Feed />
    </AppLayout>
  );
}
