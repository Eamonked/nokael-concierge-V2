import React from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, getSafeSession, clearStaleAuthSession } from '../lib/supabase';
import { AuthLayout, AuthNotice } from '../components/AuthLayout';

type Mode = 'signin' | 'forgot';

export default function Login() {
  const [mode, setMode] = React.useState<Mode>('signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [resetSent, setResetSent] = React.useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Set by the dashboard when a signed-in account has no team membership.
  const noAccess = params.get('reason') === 'no_access';

  // Redirect if already authenticated
  React.useEffect(() => {
    let isMounted = true;
    getSafeSession()
      .then((session) => {
        if (isMounted && session && !noAccess) {
          navigate('/dashboard');
        }
      })
      .catch(() => {
        clearStaleAuthSession();
      });

    return () => {
      isMounted = false;
    };
  }, [navigate, noAccess]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setResetSent(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!supabase) throw new Error('Supabase not configured.');
      const redirectTo = `${window.location.origin}/accept-invite`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) {
        throw new Error(/rate limit/i.test(error.message)
          ? 'Too many reset emails requested. Wait a few minutes and try again.'
          : error.message);
      }
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!supabase) {
        throw new Error('Sign-in is unavailable right now (Supabase not configured).');
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // Say why when it isn't simply a wrong password, so members know who to ask.
        if (/banned/i.test(error.message)) {
          setError('Your access has been disabled. Contact your team admin.');
        } else if (/not confirmed/i.test(error.message)) {
          setError('Please accept your invite email first, or use "Forgot password" to get a new link.');
        } else if (/rate limit|too many/i.test(error.message)) {
          setError('Too many attempts. Wait a minute and try again.');
        } else {
          setError('Incorrect email or password.');
        }
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'forgot') {
    return (
      <AuthLayout
        title="Reset your password"
        subtitle="Enter the email you sign in with and we'll send you a link to set a new password."
      >
        {resetSent ? (
          <div className="auth-form">
            <AuthNotice kind="success">
              If <b>{email.trim()}</b> has an account, a reset link is on its way. It works once and expires after a while. Check your spam folder if it doesn't arrive.
            </AuthNotice>
            <button type="button" className="auth-secondary" onClick={() => switchMode('signin')}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} className="auth-form">
            <div className="auth-field">
              <label htmlFor="reset-email">Email</label>
              <div className="auth-input">
                <Mail size={17} />
                <input
                  id="reset-email"
                  required
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {error && <AuthNotice kind="error">{error}</AuthNotice>}

            <button type="submit" disabled={loading} className="auth-submit">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send reset link'}
            </button>
            <button type="button" className="auth-link" onClick={() => switchMode('signin')} style={{ alignSelf: 'center' }}>
              <ArrowLeft size={13} style={{ display: 'inline', verticalAlign: '-2px', marginInlineEnd: 4 }} />
              Back to sign in
            </button>
          </form>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Sign in to the Nokael operations dashboard."
      footer={<>New to the team? Ask an admin to invite you. The invite email lets you set your password.</>}
    >
      <form onSubmit={handleSubmit} className="auth-form">
        {noAccess && (
          <AuthNotice kind="info">
            That account isn't on the team anymore. Ask an admin to invite you again.
          </AuthNotice>
        )}

        <div className="auth-field">
          <label htmlFor="login-email">Email</label>
          <div className="auth-input">
            <Mail size={17} />
            <input
              id="login-email"
              required
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="auth-field">
          <div className="auth-field-row">
            <label htmlFor="login-password">Password</label>
            <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>
              Forgot password?
            </button>
          </div>
          <div className="auth-input">
            <Lock size={17} />
            <input
              id="login-password"
              required
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="auth-reveal"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && <AuthNotice kind="error">{error}</AuthNotice>}

        <button type="submit" disabled={loading} className="auth-submit">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Sign in
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
