import React from 'react';
import { Lock, Eye, EyeOff, Loader2, Mail, User, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AuthLayout, AuthNotice } from '../components/AuthLayout';

// ==========================================
// Accept Invite / Set Password
// ==========================================
// Supabase's invite and password-recovery emails both redirect here, either
// with a session token in the URL hash fragment:
//   #access_token=...&refresh_token=...&type=invite
//   #access_token=...&refresh_token=...&type=recovery
// or, for PKCE-style links, with ?code=... . Expired / used links come back
// as #error=...&error_description=... .
//
// Configure this as the redirect target in Supabase Dashboard → Auth →
// URL Configuration (and pass it as emailRedirectTo / redirectTo on
// inviteUserByEmail / resetPasswordForEmail calls) as:
//   https://www.nokael.com/accept-invite

type Stage = 'checking' | 'ready' | 'invalid' | 'submitting' | 'done';
type LinkType = 'invite' | 'recovery';

export default function AcceptInvite() {
  const [stage, setStage] = React.useState<Stage>('checking');
  const [linkType, setLinkType] = React.useState<LinkType>('recovery');
  const [email, setEmail] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState('');
  // Why the link failed (from Supabase's #error_description), and the
  // "email me a new link" form shown on the invalid screen.
  const [linkError, setLinkError] = React.useState('');
  const [resendEmail, setResendEmail] = React.useState('');
  const [resendState, setResendState] = React.useState<'idle' | 'sending' | 'sent'>('idle');
  const [resendError, setResendError] = React.useState('');
  const navigate = useNavigate();

  React.useEffect(() => {
    let isMounted = true;

    const markReady = async (type: LinkType) => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      const user = data.user;
      setEmail(user?.email ?? '');
      setFullName((user?.user_metadata?.full_name as string | undefined) ?? '');
      // An invited user who has never signed in is setting up, not resetting.
      setLinkType(type === 'invite' || (user?.invited_at && !user?.last_sign_in_at) ? 'invite' : 'recovery');
      setStage('ready');
    };

    const consumeLink = async () => {
      if (!supabase) {
        setStage('invalid');
        return;
      }

      // Supabase-js v2 also auto-detects the hash on load (detectSessionInUrl
      // defaults to true), but we parse explicitly so we can tell the user
      // "invalid or expired link" instead of silently falling through to
      // the logged-out state.
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.substring(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const search = new URLSearchParams(window.location.search);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = (params.get('type') ?? search.get('type')) as LinkType | null;

      const errorDescription = params.get('error_description') ?? search.get('error_description');
      if (errorDescription) {
        window.history.replaceState(null, '', window.location.pathname);
        if (!isMounted) return;
        setLinkError(errorDescription.replace(/\+/g, ' '));
        setStage('invalid');
        return;
      }

      if (accessToken && refreshToken && (type === 'invite' || type === 'recovery')) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        // Clear the token out of the visible URL regardless of outcome —
        // it's single-use and shouldn't linger in browser history.
        window.history.replaceState(null, '', window.location.pathname);
        if (!isMounted) return;
        if (sessionError) {
          console.warn('[Nokael Auth] Failed to establish session from link:', sessionError);
          setLinkError(sessionError.message);
          setStage('invalid');
          return;
        }
        await markReady(type);
        return;
      }

      const code = search.get('code');
      if (code) {
        const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
        window.history.replaceState(null, '', window.location.pathname);
        if (!isMounted) return;
        if (codeError) {
          setLinkError(codeError.message);
          setStage('invalid');
          return;
        }
        await markReady(type ?? 'recovery');
        return;
      }

      // No usable token in the URL — check if there's already a live session
      // (e.g. supabase-js consumed the hash first, or the user refreshed).
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (data?.session) {
        await markReady(type ?? 'recovery');
      } else {
        setStage('invalid');
      }
    };

    consumeLink();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !resendEmail.trim()) return;
    setResendState('sending');
    setResendError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resendEmail.trim(), {
      redirectTo: `${window.location.origin}/accept-invite`,
    });
    if (resetError) {
      setResendError(/rate limit/i.test(resetError.message)
        ? 'Too many emails requested. Wait a few minutes and try again.'
        : resetError.message);
      setResendState('idle');
      return;
    }
    setResendState('sent');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setStage('submitting');
    try {
      if (!supabase) throw new Error('Supabase not configured.');
      const trimmedName = fullName.trim();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        ...(linkType === 'invite' && trimmedName ? { data: { full_name: trimmedName } } : {}),
      });
      if (updateError) throw updateError;
      setStage('done');
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err: any) {
      setError(/same.*password|should be different/i.test(err.message ?? '')
        ? 'Choose a password different from your current one.'
        : err.message || 'Failed to set password. Please try again.');
      setStage('ready');
    }
  };

  if (stage === 'checking') {
    return (
      <AuthLayout title="One moment" subtitle="Checking your link…">
        <div className="auth-state"><Loader2 size={24} className="animate-spin" /></div>
      </AuthLayout>
    );
  }

  if (stage === 'invalid') {
    return (
      <AuthLayout
        title="This link has expired"
        subtitle="Links work once and expire after a while. Enter your email and we'll send you a fresh one."
      >
        <div className="auth-form">
          {linkError && <AuthNotice kind="info">{linkError}</AuthNotice>}
          {resendState === 'sent' ? (
            <AuthNotice kind="success">
              If <b>{resendEmail.trim()}</b> has an account, a new link is on its way. Check your spam folder if it doesn't arrive.
            </AuthNotice>
          ) : (
            <form onSubmit={handleResend} className="auth-form">
              <div className="auth-field">
                <label htmlFor="resend-email">Email</label>
                <div className="auth-input">
                  <Mail size={17} />
                  <input
                    id="resend-email"
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                  />
                </div>
              </div>
              {resendError && <AuthNotice kind="error">{resendError}</AuthNotice>}
              <button type="submit" disabled={resendState === 'sending'} className="auth-submit">
                {resendState === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send me a new link'}
              </button>
            </form>
          )}
          <p className="auth-hint">
            Invited but never set a password? Your admin can also resend the invite from Team → ⋯ → Resend invite.
          </p>
          <button type="button" className="auth-secondary" onClick={() => navigate('/login')}>
            Back to sign in
          </button>
        </div>
      </AuthLayout>
    );
  }

  if (stage === 'done') {
    return (
      <AuthLayout title={linkType === 'invite' ? "You're all set" : 'Password updated'}>
        <div className="auth-state">
          <CheckCircle2 size={36} />
          <p>Taking you to the dashboard…</p>
        </div>
      </AuthLayout>
    );
  }

  const isInvite = linkType === 'invite';
  return (
    <AuthLayout
      title={isInvite ? 'Set up your account' : 'Choose a new password'}
      subtitle={isInvite
        ? `You've been invited to the Nokael operations dashboard${email ? ` as ${email}` : ''}. Set a password to finish.`
        : `Set a new password${email ? ` for ${email}` : ''}.`}
    >
      <form onSubmit={handleSubmit} className="auth-form">
        {isInvite && (
          <div className="auth-field">
            <label htmlFor="invite-name">Full name</label>
            <div className="auth-input">
              <User size={17} />
              <input
                id="invite-name"
                type="text"
                autoComplete="name"
                maxLength={100}
                placeholder="How your team will see you"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="auth-field">
          <label htmlFor="new-password">New password</label>
          <div className="auth-input">
            <Lock size={17} />
            <input
              id="new-password"
              required
              autoFocus={!isInvite}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
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

        <div className="auth-field">
          <label htmlFor="confirm-password">Confirm password</label>
          <div className="auth-input">
            <Lock size={17} />
            <input
              id="confirm-password"
              required
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        {error && <AuthNotice kind="error">{error}</AuthNotice>}

        <button type="submit" disabled={stage === 'submitting'} className="auth-submit">
          {stage === 'submitting'
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : isInvite ? 'Create account' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  );
}
