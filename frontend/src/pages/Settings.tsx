import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { Lock, Bell, Shield, Moon, Sun, LogOut, Eye, EyeOff, Settings as SettingsIcon } from 'lucide-react';
import {
  GET_MY_SETTINGS, UPDATE_PRIVACY_SETTINGS, UPDATE_NOTIFICATION_SETTINGS, CHANGE_PASSWORD,
} from '@/lib/graphql';
import { useAuthStore, useUIStore } from '@/store';
import { cn } from '@/utils';
import { AppLayout } from './Home';
import toast from 'react-hot-toast';

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', description: 'Anyone can see this' },
  { value: 'friends', label: 'Friends only', description: 'Only your friends can see this' },
  { value: 'private', label: 'Only me', description: "No one else can see this" },
] as const;

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      className={cn(
        'w-11 h-6 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-50 overflow-hidden',
        checked ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow',
          checked ? 'translate-x-[20px]' : 'translate-x-0'
        )}
      />
    </button>
  );
}

function SettingsSection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className="text-brand-500" />
        <h2 className="font-bold text-gray-900 dark:text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { darkMode, toggleDarkMode } = useUIStore();

  const { data, loading } = useQuery(GET_MY_SETTINGS);
  const [updatePrivacy, { loading: savingPrivacy }] = useMutation(UPDATE_PRIVACY_SETTINGS);
  const [updateNotifications] = useMutation(UPDATE_NOTIFICATION_SETTINGS);
  const [changePassword, { loading: changingPassword }] = useMutation(CHANGE_PASSWORD);

  const [profileVisibility, setProfileVisibility] = useState('public');
  const [postsVisibility, setPostsVisibility] = useState('public');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  useEffect(() => {
    if (data?.me?.privacySettings) {
      setProfileVisibility(data.me.privacySettings.profileVisibility);
      setPostsVisibility(data.me.privacySettings.postsVisibility);
    }
    if (data?.me?.notificationSettings) {
      setEmailNotifications(data.me.notificationSettings.emailNotifications);
      setPushNotifications(data.me.notificationSettings.pushNotifications);
    }
  }, [data]);

  const handlePrivacyChange = useCallback(async (field: 'profileVisibility' | 'postsVisibility', value: string) => {
    const setter = field === 'profileVisibility' ? setProfileVisibility : setPostsVisibility;
    const previous = field === 'profileVisibility' ? profileVisibility : postsVisibility;
    setter(value); // optimistic
    try {
      await updatePrivacy({ variables: { input: { [field]: value } } });
    } catch {
      setter(previous); // revert on failure
      toast.error('Failed to update privacy setting');
    }
  }, [profileVisibility, postsVisibility, updatePrivacy]);

  const handleNotificationToggle = useCallback(async (field: 'emailNotifications' | 'pushNotifications') => {
    const current = field === 'emailNotifications' ? emailNotifications : pushNotifications;
    const setter = field === 'emailNotifications' ? setEmailNotifications : setPushNotifications;
    setter(!current); // optimistic
    try {
      await updateNotifications({ variables: { input: { [field]: !current } } });
    } catch {
      setter(current); // revert on failure
      toast.error('Failed to update notification setting');
    }
  }, [emailNotifications, pushNotifications, updateNotifications]);

  // Password change form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const handleChangePassword = useCallback(async () => {
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    try {
      await changePassword({ variables: { currentPassword, newPassword } });
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to change password');
    }
  }, [currentPassword, newPassword, confirmPassword, changePassword]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const inputClass = "w-full px-3.5 py-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <AppLayout>
      <div className="flex items-center gap-2 mb-4">
        <SettingsIcon size={22} className="text-brand-500" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-100 dark:bg-surface-dark-3 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <SettingsSection icon={Shield} title="Privacy">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Who can see your profile</p>
                <div className="space-y-1.5">
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handlePrivacyChange('profileVisibility', opt.value)}
                      disabled={savingPrivacy}
                      className={cn(
                        'w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left transition-colors disabled:opacity-50',
                        profileVisibility === opt.value
                          ? 'bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-500'
                          : 'bg-gray-50 dark:bg-surface-dark-3 hover:bg-gray-100 dark:hover:bg-gray-600'
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</p>
                        <p className="text-xs text-gray-400">{opt.description}</p>
                      </div>
                      {profileVisibility === opt.value && <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 mt-3">Who can see your posts by default</p>
                <div className="space-y-1.5">
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handlePrivacyChange('postsVisibility', opt.value)}
                      disabled={savingPrivacy}
                      className={cn(
                        'w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left transition-colors disabled:opacity-50',
                        postsVisibility === opt.value
                          ? 'bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-500'
                          : 'bg-gray-50 dark:bg-surface-dark-3 hover:bg-gray-100 dark:hover:bg-gray-600'
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</p>
                        <p className="text-xs text-gray-400">{opt.description}</p>
                      </div>
                      {postsVisibility === opt.value && <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection icon={Bell} title="Notifications">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Email notifications</p>
                  <p className="text-xs text-gray-400">Get emailed about activity on your account</p>
                </div>
                <Toggle checked={emailNotifications} onChange={() => handleNotificationToggle('emailNotifications')} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Push notifications</p>
                  <p className="text-xs text-gray-400">Get notified in-app about activity</p>
                </div>
                <Toggle checked={pushNotifications} onChange={() => handleNotificationToggle('pushNotifications')} />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection icon={darkMode ? Moon : Sun} title="Appearance">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Dark mode</p>
                <p className="text-xs text-gray-400">Switch between light and dark themes</p>
              </div>
              <Toggle checked={darkMode} onChange={toggleDarkMode} />
            </div>
          </SettingsSection>

          <SettingsSection icon={Lock} title="Change password">
            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className={inputClass}
                />
              </div>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min. 8 characters)"
                className={inputClass}
              />
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={inputClass}
              />
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setShowPasswords((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  {showPasswords ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showPasswords ? 'Hide' : 'Show'} passwords
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Update password
                </button>
              </div>
            </div>
          </SettingsSection>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white dark:bg-surface-dark-2 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl shadow-card dark:shadow-card-dark transition-colors"
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>
      )}
    </AppLayout>
  );
}
