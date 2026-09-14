import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import { GraphQLError } from 'graphql';
import { LoginPage, RegisterPage } from '@/pages/Auth';
import { LOGIN, REGISTER } from '@/lib/graphql';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const setAuthMock = vi.fn();
vi.mock('@/store', () => ({
  useAuthStore: () => ({ setAuth: setAuthMock }),
  // Added when the login page grew a light/dark theme toggle — Auth.tsx
  // now calls useUIStore() too, so it needs a mock even though this file
  // doesn't test the toggle itself.
  useUIStore: () => ({ darkMode: true, toggleDarkMode: vi.fn() }),
}));

const toastSuccess = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { success: (...a: any[]) => toastSuccess(...a), error: vi.fn() },
}));

beforeEach(() => {
  navigateMock.mockClear();
  setAuthMock.mockClear();
  toastSuccess.mockClear();
});

function renderWithProviders(ui: ReactElement, mocks: any[] = []) {
  return render(
    <MemoryRouter>
      <MockedProvider mocks={mocks} addTypename={false}>
        {ui}
      </MockedProvider>
    </MemoryRouter>
  );
}

function fakeUser(overrides: Record<string, any>) {
  return {
    id: 'u1', username: 'x', firstName: 'X', lastName: 'Y', fullName: 'X Y',
    email: 'x@example.com', avatar: null, isOnline: true, isVerified: false,
    isFriend: false, friendsCount: 0,
    ...overrides,
  };
}

describe('LoginPage', () => {
  it('trims and lowercases the email on submit, then authenticates on success', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: { query: LOGIN, variables: { email: 'alice@example.com', password: 'secret123' } },
        result: { data: { login: { token: 'tok1', user: fakeUser({ username: 'alice', firstName: 'Alice' }) } } },
      },
    ];
    renderWithProviders(<LoginPage />, mocks);

    await user.type(screen.getByLabelText('Email'), '  Alice@Example.com  ');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() =>
      expect(setAuthMock).toHaveBeenCalledWith('tok1', expect.objectContaining({ username: 'alice' }))
    );
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('shows the server error message and does not authenticate on invalid credentials', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: { query: LOGIN, variables: { email: 'bob@example.com', password: 'wrongpass' } },
        result: { errors: [new GraphQLError('Invalid credentials', { extensions: { code: 'UNAUTHENTICATED' } })] },
      },
    ];
    renderWithProviders(<LoginPage />, mocks);

    await user.type(screen.getByLabelText('Email'), 'bob@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid credentials/i);
    expect(setAuthMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('keeps the submit button disabled until both fields have a value', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const submit = screen.getByRole('button', { name: /log in/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    expect(submit).toBeDisabled(); // still no password

    await user.type(screen.getByLabelText('Password'), 'x');
    expect(submit).toBeEnabled();
  });
});

describe('RegisterPage — client-side validation', () => {
  it('shows validation errors and never calls the mutation when the form is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.click(screen.getByRole('button', { name: /sign up/i }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    // No mocks were provided to MockedProvider — if the mutation had fired
    // despite the invalid form, this render would throw ("no more mocked
    // responses"), so reaching this assertion at all is part of the check.
    expect(setAuthMock).not.toHaveBeenCalled();
  });

  it('flags a password missing a digit, using the last-applied of several overlapping rules', async () => {
    // validateForm checks length, then uppercase, then digit as three
    // separate `if`s (not else-if) that each overwrite errors.password —
    // so a password failing more than one rule surfaces only the LAST
    // one that failed. Documenting that behavior here means a future
    // refactor to else-if (which would change which message wins) shows
    // up as a test failure instead of an unnoticed UX change.
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Doe');
    await user.type(screen.getByLabelText('Username'), 'johndoe');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'weakpass'); // long enough, lowercase, no digit
    await user.type(screen.getByLabelText('Confirm password'), 'weakpass');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByText(/must contain a number/i)).toBeInTheDocument();
  });

  it('flags mismatched passwords', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Doe');
    await user.type(screen.getByLabelText('Username'), 'johndoe');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm password'), 'Password2');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('rejects a username containing spaces or symbols', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Doe');
    await user.type(screen.getByLabelText('Username'), 'john doe!');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm password'), 'Password1');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByText(/letters, numbers, underscores only/i)).toBeInTheDocument();
  });

  it('clears a field-level error as soon as that field is edited again', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.click(screen.getByRole('button', { name: /sign up/i }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);

    const firstNameInput = screen.getByLabelText('First name');
    expect(firstNameInput).toHaveAttribute('aria-invalid', 'true');

    await user.type(firstNameInput, 'J');

    // The first-name field's own error clears immediately on edit, even
    // though the form as a whole is still invalid and other fields (e.g.
    // Last name) still correctly show "Required".
    expect(firstNameInput).toHaveAttribute('aria-invalid', 'false');
  });

  it('submits a valid form with the email and username trimmed + lowercased', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: REGISTER,
          variables: {
            input: {
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
              username: 'johndoe',
              password: 'Password1',
            },
          },
        },
        result: { data: { register: { token: 'tok2', user: fakeUser({ username: 'johndoe', firstName: 'John' }) } } },
      },
    ];
    renderWithProviders(<RegisterPage />, mocks);

    await user.type(screen.getByLabelText('First name'), 'John');
    await user.type(screen.getByLabelText('Last name'), 'Doe');
    await user.type(screen.getByLabelText('Username'), 'JohnDoe');
    await user.type(screen.getByLabelText('Email'), '  John@Example.com  ');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm password'), 'Password1');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() =>
      expect(setAuthMock).toHaveBeenCalledWith('tok2', expect.objectContaining({ username: 'johndoe' }))
    );
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
  });
});
