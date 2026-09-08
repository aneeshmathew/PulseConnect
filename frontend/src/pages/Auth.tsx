import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { LOGIN, REGISTER } from '@/lib/graphql';
import { useAuthStore } from '@/store';
import { cn } from '@/utils';
import toast from 'react-hot-toast';

// ─── Shared input field ───────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  required?: boolean;
}

function InputField({ label, type = 'text', value, onChange, placeholder, error, autoComplete, required }: FieldProps) {
  const [showPwd, setShowPwd] = useState(false);
  const isPassword = type === 'password';
  const id = label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword ? (showPwd ? 'text' : 'password') : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            'w-full px-4 py-3 rounded-xl border bg-white dark:bg-surface-dark-3 text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition-all text-sm',
            error
              ? 'border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20'
              : 'border-gray-300 dark:border-gray-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            aria-label={showPwd ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [login, { loading }] = useMutation(LOGIN);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) return;
    try {
      const { data } = await login({ variables: { email: email.trim().toLowerCase(), password } });
      if (data?.login) {
        setAuth(data.login.token, data.login.user);
        navigate('/', { replace: true });
        toast.success(`Welcome back, ${data.login.user.firstName}! 👋`);
      }
    } catch (err: any) {
      setError(err?.graphQLErrors?.[0]?.message ?? 'Login failed. Please try again.');
    }
  }, [email, password, login, setAuth, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-dark flex items-center justify-center px-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-12 items-center">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center text-white font-black text-3xl mb-6 select-none">
            S
          </div>
          <h1 className="text-5xl font-black text-brand-500 mb-4 leading-tight">PluseConnect</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
            Connect with friends and the world around you on PluseConnect.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <div className="bg-white dark:bg-surface-dark-2 rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {error && (
                <div role="alert" className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                  <AlertCircle size={15} className="flex-shrink-0" /> {error}
                </div>
              )}
              <InputField
                label="Email" type="email" value={email} onChange={setEmail}
                placeholder="your@email.com" autoComplete="email" required
              />
              <InputField
                label="Password" type="password" value={password} onChange={setPassword}
                placeholder="••••••••" autoComplete="current-password" required
              />
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Log In
              </button>
              <button type="button" className="w-full text-sm text-brand-500 hover:underline text-center py-1">
                Forgot password?
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs text-gray-400 font-medium">or</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>

            <Link
              to="/register"
              className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center text-sm"
            >
              Create New Account
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Register ─────────────────────────────────────────────────────────────────

interface FormState {
  firstName: string; lastName: string; email: string;
  username: string; password: string; confirmPassword: string;
}

interface FormErrors {
  firstName?: string; lastName?: string; email?: string;
  username?: string; password?: string; confirmPassword?: string;
  general?: string;
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.firstName.trim()) errors.firstName = 'Required';
  if (!form.lastName.trim()) errors.lastName = 'Required';
  if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Valid email required';
  if (!form.username.trim() || form.username.length < 3) errors.username = 'Min. 3 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(form.username)) errors.username = 'Letters, numbers, underscores only';
  if (!form.password || form.password.length < 8) errors.password = 'Min. 8 characters';
  if (!/[A-Z]/.test(form.password)) errors.password = 'Must contain an uppercase letter';
  if (!/[0-9]/.test(form.password)) errors.password = 'Must contain a number';
  if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match';
  return errors;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState<FormState>({
    firstName: '', lastName: '', email: '', username: '', password: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const [register, { loading }] = useMutation(REGISTER);

  const update = useCallback((key: keyof FormState) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    // Clear the error for this field as the user types
    setErrors((e) => ({ ...e, [key]: undefined }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    try {
      const { data } = await register({
        variables: {
          input: {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim().toLowerCase(),
            username: form.username.trim().toLowerCase(),
            password: form.password,
          },
        },
      });
      if (data?.register) {
        setAuth(data.register.token, data.register.user);
        navigate('/', { replace: true });
        toast.success('Welcome to PluseConnect! 🎉');
      }
    } catch (err: any) {
      const msg = err?.graphQLErrors?.[0]?.message ?? 'Registration failed';
      setErrors({ general: msg });
    }
  }, [form, register, setAuth, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-dark flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-brand-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-3 select-none">S</div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Create Account</h1>
          <p className="text-gray-500 mt-1 text-sm">It's quick and easy.</p>
        </div>

        <div className="bg-white dark:bg-surface-dark-2 rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {errors.general && (
              <div role="alert" className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={15} className="flex-shrink-0" /> {errors.general}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <InputField label="First name" value={form.firstName} onChange={update('firstName')}
                placeholder="John" error={errors.firstName} autoComplete="given-name" required />
              <InputField label="Last name" value={form.lastName} onChange={update('lastName')}
                placeholder="Doe" error={errors.lastName} autoComplete="family-name" required />
            </div>
            <InputField label="Username" value={form.username} onChange={update('username')}
              placeholder="johndoe" error={errors.username} autoComplete="username" required />
            <InputField label="Email" type="email" value={form.email} onChange={update('email')}
              placeholder="john@example.com" error={errors.email} autoComplete="email" required />
            <InputField label="Password" type="password" value={form.password} onChange={update('password')}
              placeholder="Min. 8 characters" error={errors.password} autoComplete="new-password" required />
            <InputField label="Confirm password" type="password" value={form.confirmPassword} onChange={update('confirmPassword')}
              placeholder="Repeat password" error={errors.confirmPassword} autoComplete="new-password" required />

            <p className="text-xs text-gray-400 leading-relaxed">
              By signing up, you agree to our{' '}
              <button type="button" className="text-brand-500 hover:underline">Terms</button>{' '}
              and{' '}
              <button type="button" className="text-brand-500 hover:underline">Privacy Policy</button>.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Sign Up
            </button>
          </form>

          <div className="text-center mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Link to="/login" className="text-sm text-brand-500 hover:underline font-medium">
              Already have an account? Log in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
