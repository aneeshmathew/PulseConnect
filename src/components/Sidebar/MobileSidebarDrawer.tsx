import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { LeftSidebar } from '@/components/Sidebar/LeftSidebar';
import { Logo } from '@/components/UI/Logo';
import { useUIStore } from '@/store';

// Mobile-only nav drawer. The LeftSidebar is `hidden lg:block` in AppLayout,
// which (below `lg`) previously left no way at all to reach Friends/Watch/
// Marketplace/Saved/Events, dark mode, Settings, or Log Out — the profile
// dropdown in Navbar intentionally doesn't duplicate those. This renders the
// same LeftSidebar content as a slide-in panel, toggled by the Navbar
// hamburger button via useUIStore's mobileMenuOpen.
export function MobileSidebarDrawer() {
  const { mobileMenuOpen, closeMobileMenu } = useUIStore();

  return (
    <AnimatePresence>
      {mobileMenuOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closeMobileMenu}
            aria-hidden="true"
            className="fixed inset-0 bg-black/50 z-50 lg:hidden"
          />
          <motion.div
            key="panel"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed top-0 left-0 bottom-0 z-50 w-[82vw] max-w-72 bg-white dark:bg-surface-dark-2 shadow-2xl flex flex-col lg:hidden"
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <Logo size={32} />
              <button
                onClick={closeMobileMenu}
                aria-label="Close menu"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors"
              >
                <X size={18} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <LeftSidebar variant="drawer" onNavigate={closeMobileMenu} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
