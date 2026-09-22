import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { client } from '@/lib/apollo';
import { useAuthStore } from '@/store';

// ✅ Code-split per route instead of one giant bundle. Every page below was
// previously a static top-of-file import, so the production build packed
// every page's code (Messages, Watch, Settings, Profile, ...) into a
// single chunk regardless of which page someone actually opened first —
// which is what the "chunks larger than 500 kB after minification"
// warning was flagging. React.lazy() + <Suspense> below makes Vite/Rollup
// emit one chunk per page, fetched only when its route is actually
// visited. Every page file here uses named exports (no `export default`),
// which is what the `.then(m => ({ default: m.XPage }))` adapters are for
// — React.lazy() specifically requires a promise resolving to a `default`
// key.
const HomePage = lazy(() => import('@/pages/Home').then((m) => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.ResetPasswordPage })));
const ProfilePage = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.ProfilePage })));
const MessagesPage = lazy(() => import('@/pages/Messages').then((m) => ({ default: m.MessagesPage })));
const FriendsPage = lazy(() => import('@/pages/Friends').then((m) => ({ default: m.FriendsPage })));
const PostDetailPage = lazy(() => import('@/pages/PostDetail').then((m) => ({ default: m.PostDetailPage })));
const SavedPage = lazy(() => import('@/pages/Saved').then((m) => ({ default: m.SavedPage })));
const SettingsPage = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })));
const WatchPage = lazy(() => import('@/pages/Watch').then((m) => ({ default: m.WatchPage })));
const EventsPage = lazy(() => import('@/pages/Events').then((m) => ({ default: m.EventsPage })));
const EventDetailPage = lazy(() => import('@/pages/EventDetail').then((m) => ({ default: m.EventDetailPage })));
const MarketplacePage = lazy(() => import('@/pages/Marketplace').then((m) => ({ default: m.MarketplacePage })));
const ListingDetailPage = lazy(() => import('@/pages/ListingDetail').then((m) => ({ default: m.ListingDetailPage })));

// Minimal, dependency-free fallback — shown only for the brief moment a
// route chunk is being fetched (typically imperceptible on a warm cache),
// so it deliberately doesn't try to mimic each page's real layout.
function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-surface-dark">
      <Loader2 className="animate-spin text-brand-500" size={28} />
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <ApolloProvider client={client}>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
            <Route path="/reset-password"  element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
            <Route path="/"         element={<PrivateRoute><HomePage /></PrivateRoute>} />
            <Route path="/profile/:username" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
            <Route path="/messages"          element={<PrivateRoute><MessagesPage /></PrivateRoute>} />
            <Route path="/messages/:conversationId" element={<PrivateRoute><MessagesPage /></PrivateRoute>} />
            <Route path="/friends" element={<PrivateRoute><FriendsPage /></PrivateRoute>} />
            <Route path="/post/:id" element={<PrivateRoute><PostDetailPage /></PrivateRoute>} />
            <Route path="/watch" element={<PrivateRoute><WatchPage /></PrivateRoute>} />
            <Route path="/marketplace" element={<PrivateRoute><MarketplacePage /></PrivateRoute>} />
            <Route path="/listing/:id" element={<PrivateRoute><ListingDetailPage /></PrivateRoute>} />
            <Route path="/saved" element={<PrivateRoute><SavedPage /></PrivateRoute>} />
            <Route path="/events" element={<PrivateRoute><EventsPage /></PrivateRoute>} />
            <Route path="/event/:id" element={<PrivateRoute><EventDetailPage /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            borderRadius: '12px',
            fontFamily: 'inherit',
            fontSize: '14px',
            maxWidth: '420px',
          },
          success: { iconTheme: { primary: '#1877F2', secondary: '#fff' } },
        }}
      />
    </ApolloProvider>
  );
}
