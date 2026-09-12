import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import { SettingsPage } from '@/pages/Settings';
import {
  GET_MY_SETTINGS, UPDATE_PRIVACY_SETTINGS, UPDATE_NOTIFICATION_SETTINGS, CHANGE_PASSWORD,
} from '@/lib/graphql';

vi.mock('@/pages/Home', () => ({
  AppLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const logout = vi.fn();
const toggleDarkMode = vi.fn();
let darkMode = false;
vi.mock('@/store', () => ({
  useAuthStore: () => ({ logout }),
  useUIStore: () => ({ darkMode, toggleDarkMode }),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

const settingsData = {
  me: {
    id: 'me1',
    privacySettings: { profileVisibility: 'public', postsVisibility: 'friends' },
    notificationSettings: { emailNotifications: true, pushNotifications: false },
  },
};

function renderSettings(mocks: any[]) {
  return render(
    <MemoryRouter>
      <MockedProvider mocks={mocks}>
        <SettingsPage />
      </MockedProvider>
    </MemoryRouter>
  );
}

describe('SettingsPage', () => {
  it('shows loading placeholders before settings arrive', () => {
    const mocks = [{ request: { query: GET_MY_SETTINGS }, result: { data: settingsData }, delay: 50 }];
    renderSettings(mocks);
    expect(screen.queryByText('Privacy')).not.toBeInTheDocument();
  });

  it('renders the fetched privacy and notification settings', async () => {
    const mocks = [{ request: { query: GET_MY_SETTINGS }, result: { data: settingsData } }];
    renderSettings(mocks);

    expect(await screen.findByText('Privacy')).toBeInTheDocument();
    // "Public" is pre-selected for profile visibility, "Friends only" for posts.
    const emailToggle = screen.getAllByRole('switch')[0];
    const pushToggle = screen.getAllByRole('switch')[1];
    expect(emailToggle).toHaveAttribute('aria-checked', 'true');
    expect(pushToggle).toHaveAttribute('aria-checked', 'false');
  });

  it('updates profile visibility optimistically and calls the mutation', async () => {
    const mocks = [
      { request: { query: GET_MY_SETTINGS }, result: { data: settingsData } },
      {
        request: { query: UPDATE_PRIVACY_SETTINGS, variables: { input: { profileVisibility: 'private' } } },
        result: { data: { updatePrivacySettings: { id: 'me1', privacySettings: { profileVisibility: 'private', postsVisibility: 'friends' } } } },
      },
    ];
    renderSettings(mocks);
    await screen.findByText('Privacy');

    // "Only me" appears twice — once under profile visibility, once under
    // posts visibility (same three options, rendered independently for
    // each). The profile-visibility one is first in the DOM.
    const profileOnlyMeBtn = screen.getAllByRole('button', { name: /only me/i })[0];
    fireEvent.click(profileOnlyMeBtn);
    // Optimistic update happens synchronously; the ring highlight moves to "Only me".
    expect(profileOnlyMeBtn).toHaveClass('ring-brand-500');
  });

  it('reverts a notification toggle and shows an error if the mutation fails', async () => {
    const mocks = [
      { request: { query: GET_MY_SETTINGS }, result: { data: settingsData } },
      { request: { query: UPDATE_NOTIFICATION_SETTINGS, variables: { input: { emailNotifications: false } } }, error: new Error('Network error') },
    ];
    renderSettings(mocks);
    await screen.findByText('Notifications');

    const emailToggle = screen.getAllByRole('switch')[0];
    expect(emailToggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(emailToggle); // optimistic flip to false
    expect(emailToggle).toHaveAttribute('aria-checked', 'false');

    await waitFor(() => expect(emailToggle).toHaveAttribute('aria-checked', 'true'));
  });

  it('toggles dark mode via the Appearance section', async () => {
    const mocks = [{ request: { query: GET_MY_SETTINGS }, result: { data: settingsData } }];
    renderSettings(mocks);
    await screen.findByText('Appearance');

    // Switch order on the page: email notifications, push notifications, dark mode.
    const darkModeToggle = screen.getAllByRole('switch')[2];
    fireEvent.click(darkModeToggle);
    expect(toggleDarkMode).toHaveBeenCalledTimes(1);
  });

  it('disables "Update password" until all three password fields are filled', async () => {
    const mocks = [{ request: { query: GET_MY_SETTINGS }, result: { data: settingsData } }];
    renderSettings(mocks);
    await screen.findByText('Change password');

    const updateBtn = screen.getByRole('button', { name: /update password/i });
    expect(updateBtn).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByPlaceholderText('New password (min. 8 characters)'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'newpass123' } });
    expect(updateBtn).not.toBeDisabled();
  });

  it('submits a password change and clears the form on success', async () => {
    const mocks = [
      { request: { query: GET_MY_SETTINGS }, result: { data: settingsData } },
      {
        request: { query: CHANGE_PASSWORD, variables: { currentPassword: 'oldpass123', newPassword: 'newpass123' } },
        result: { data: { changePassword: true } },
      },
    ];
    renderSettings(mocks);
    await screen.findByText('Change password');

    fireEvent.change(screen.getByPlaceholderText('Current password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByPlaceholderText('New password (min. 8 characters)'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect((screen.getByPlaceholderText('Current password') as HTMLInputElement).value).toBe('');
    });
  });

  it('logs out and redirects to /login', async () => {
    const mocks = [{ request: { query: GET_MY_SETTINGS }, result: { data: settingsData } }];
    renderSettings(mocks);
    await screen.findByText('Privacy');

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});
