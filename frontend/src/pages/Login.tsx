import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { EyeIcon, EyeOffIcon } from '../components/ui/Icons';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lastChar, setLastChar] = useState('');
  const lastCharTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);

    if (lastCharTimeoutRef.current) {
      clearTimeout(lastCharTimeoutRef.current);
    }

    if (value.length > 0 && !showPassword) {
      setLastChar(value.slice(-1));
      lastCharTimeoutRef.current = setTimeout(() => {
        setLastChar('');
      }, 1500);
    } else {
      setLastChar('');
    }
  };

  const handlePasswordBlur = () => {
    if (lastCharTimeoutRef.current) {
      clearTimeout(lastCharTimeoutRef.current);
      lastCharTimeoutRef.current = null;
    }
    setLastChar('');
  };

  const toggleShowPassword = () => {
    setShowPassword((prev) => !prev);
    if (lastCharTimeoutRef.current) {
      clearTimeout(lastCharTimeoutRef.current);
      lastCharTimeoutRef.current = null;
    }
    setLastChar('');
    setTimeout(() => passwordInputRef.current?.focus(), 0);
  };

  useEffect(() => {
    return () => {
      if (lastCharTimeoutRef.current) {
        clearTimeout(lastCharTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 bg-primary rounded-lg flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7v10l8 4" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">Floramagg Inventory</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Sign in to your account</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm" role="alert">
              {error}
            </div>
          )

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="label-field">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field mt-1"
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="label-field">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  ref={passwordInputRef}
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={handlePasswordBlur}
                  className="input-field mt-1 pr-12"
                  placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={toggleShowPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
                {lastChar && !showPassword && (
                  <span className="absolute right-12 top-1/2 -translate-y-1/2 text-sm text-gray-400 animate-fade-in">
                    {lastChar}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="none" d="M4 12a8 8 0 018-8V0" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          Demo credentials: <br />
          Admin: admin@floramagg.com / password_1 <br />
          Manager: staff1@floramagg.com / password_1
        </div>
      </div>
    </div>
  );
}