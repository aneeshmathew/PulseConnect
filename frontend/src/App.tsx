import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { Toaster } from 'react-hot-toast';
import { Store, Calendar } from 'lucide-react';
import { client } from '@/lib/apollo';
import { useAuthStore } from '@/store';
import { HomePage } from '@/pages/Home';
import { LoginPage, RegisterPage } from '@/pages/Auth';
import { ProfilePage } from '@/pages/Profile';
import { MessagesPage } from '@/pages/Messages';
import { ComingSoonPage } from '@/pages/ComingSoon';
import { FriendsPage } from '@/pages/Friends';
import { PostDetailPage } from '@/pages/PostDetail';
import { SavedPage } from '@/pages/Saved';
import { SettingsPage } from '@/pages/Settings';
import { WatchPage } from '@/pages/Watch';

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
        <Routes>
          <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/"         element={<PrivateRoute><HomePage /></PrivateRoute>} />
          <Route path="/profile/:username" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="/messages"          element={<PrivateRoute><MessagesPage /></PrivateRoute>} />
          <Route path="/messages/:conversationId" element={<PrivateRoute><MessagesPage /></PrivateRoute>} />
          <Route path="/friends" element={<PrivateRoute><FriendsPage /></PrivateRoute>} />
          <Route path="/post/:id" element={<PrivateRoute><PostDetailPage /></PrivateRoute>} />
          <Route path="/watch" element={<PrivateRoute><WatchPage /></PrivateRoute>} />
          <Route path="/marketplace" element={<PrivateRoute>
            <ComingSoonPage icon={Store} title="Marketplace" description="Buying and selling with your community is coming soon." />
          </PrivateRoute>} />
          <Route path="/saved" element={<PrivateRoute><SavedPage /></PrivateRoute>} />
          <Route path="/events" element={<PrivateRoute>
            <ComingSoonPage icon={Calendar} title="Events" description="Create and discover events with friends — coming soon." />
          </PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
