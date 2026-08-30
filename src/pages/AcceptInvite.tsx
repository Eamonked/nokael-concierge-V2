import React from 'react';
import { motion } from 'motion/react';
import { Lock, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ==========================================
// Accept Invite / Set Password
// ==========================================
// Supabase's invite and password-recovery emails both redirect here with
// a session token in the URL hash fragment, e.g.:
//   #access_token=...&refresh_token=...&type=invite
//   #access_token=...&refresh_token=...&type=recovery
// This page is the piece that was previously missing entirely — invited
// users landed on the homepage with an unused token and no way to ever
// set a working password. See /areas/nokael-app notes on Sheila's login
// issue (2026-08-30) for the incident that surfaced this gap.
//
// Configure this as the redirect target in Supabase Dashboard → Auth →
// URL Configuration (and pass it as emailRedirectTo / redirectTo on
// inviteUserByEmail / resetPasswordForEmail calls) as:
//   https://www.nokael.com/accept-invite

type Stage = 'checking' | 'ready' | 'invalid' | 'submitting' | 'done';

export default function AcceptInvite() {
  const [stage, setStage] = React.useState<Stage>('checking');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const navigate = useNavigate();

  React.useEffect(() => {
    let isMounted = true;

    const consumeHashSession = async () => {
      if (!supabase) {
        setStage('invalid');
        return;
      }

      // Supabase-js v2 also auto-detects the hash on load (detectSessionInUrl
      // defaults to true), but we parse explicitly so we can tell the user
      // "invalid or expired invite" instead of silently falling through to
      // the logged-out state.
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.substring(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type'); // 'invite' | 'recovery' | 'signup' | ...

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
          console.warn('[Nokael Auth] Failed to establish session from invite link:', sessionError);
          setStage('invalid');
          return;
        }
        setStage('ready');
        return;
      }

      // No usable token in the URL — check if there's already a live
      // session (e.g. user refreshed this page after already setting a
      // password) before giving up.
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (data?.session) {
        setStage('ready');
      } else {
        setStage('invalid');
      }
    };

    consumeHashSession();
    return () => {
      isMounted = false;
    };
  }, []);

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
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setStage('done');
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to set password. Please try again.');
      setStage('ready');
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-neon/5 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full dispatch-card p-12 relative z-10"
      >
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-brand-neon/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-brand-neon/20">
            <ShieldCheck className="w-8 h-8 text-brand-neon" />
          </div>
          <h1 className="text-3xl font-display font-medium tracking-tighter mb-2">Set Access Key.</h1>
          <p className="text-brand-muted text-[10px] uppercase tracking-[0.3em] font-bold">Command Centre Onboarding</p>
        </div>

        {stage === 'checking' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-neon" />
            <p className="text-brand-muted text-xs">Verifying invite link...</p>
          </div>
        )}

        {stage === 'invalid' && (
          <div className="text-center space-y-4">
            <p className="text-red-500 text-xs font-bold uppercase tracking-widest">
              This invite link is invalid or has expired.
            </p>
            <p className="text-brand-muted text-xs leading-relaxed">
              Ask your Command Centre admin to send a new invite, or use "Forgot password" on the login page if you already have an account.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="btn-secondary w-full py-4 text-xs mt-4"
            >
              Back to Login
            </button>
          </div>
        )}

        {(stage === 'ready' || stage === 'submitting') && (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.3em] font-bold text-brand-muted mb-4">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted" />
                  <input
                    required
                    type="password"
                    placeholder="Minimum 8 characters"
                    className="w-full bg-brand-input border border-brand-input-border rounded-2xl py-5 pl-14 pr-6 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-all font-display tracking-tight"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.3em] font-bold text-brand-muted mb-4">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted" />
                  <input
                    required
                    type="password"
                    placeholder="Re-enter password"
                    className="w-full bg-brand-input border border-brand-input-border rounded-2xl py-5 pl-14 pr-6 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-all font-display tracking-tight"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-500 text-[10px] font-bold uppercase tracking-widest text-center"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={stage === 'submitting'}
              className="btn-primary w-full py-5 text-[10px]"
            >
              {stage === 'submitting' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Activate Access</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {stage === 'done' && (
          <div className="text-center space-y-3 py-4">
            <ShieldCheck className="w-10 h-10 text-brand-neon mx-auto" />
            <p className="text-brand-text text-sm font-medium">Password set. Redirecting to Command Centre...</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
