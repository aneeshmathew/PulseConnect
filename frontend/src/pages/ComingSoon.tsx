import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LucideIcon, ArrowLeft } from 'lucide-react';
import { AppLayout } from './Home';

// These five nav destinations (Friends, Watch, Marketplace, Saved, Settings)
// were linked from both the top navbar and left sidebar without a real
// feature built yet — no page, and no backend GraphQL schema support
// either. Before this page existed, clicking any of them hit App.tsx's
// catch-all route and silently bounced back to Home with no explanation.
// This at least tells the person what's going on instead of looking
// broken. Events has since been built out for real (see docs/DEVELOPMENT.md)
// and no longer uses this component — Marketplace is the only one left.
interface ComingSoonPageProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function ComingSoonPage({ icon: Icon, title, description }: ComingSoonPageProps) {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark p-10 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
            <Icon size={28} className="text-brand-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1.5">{title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">{description}</p>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <ArrowLeft size={15} />
            Back to Home
          </button>
        </motion.div>
      </div>
    </AppLayout>
  );
}
