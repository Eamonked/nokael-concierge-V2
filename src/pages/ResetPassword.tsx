import React from 'react';
import { motion } from 'motion/react';
import { Lock, KeyRound, CheckCircle2, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, getSafeSession } from '../lib/supabase';

export default function ResetPassword() {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  React.useEffect(() => {
    // Check if the user has an active authenticated session (e.g., from clicking the recovery / magic link)
    getSafeSession().then((session) => {
      if (session?.user) {
        setUserEmail(session.user.email || null);
      }
    });

    // Also listen to auth state change (in case access token hash is being processed from the URL)
    const { data: authListener } = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (session?.user) {
          setUserEmail(session.user.email || null);
        }
      }
    }) || { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setStatus('error');
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setStatus('error');
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      if (!supabase) {
        throw new Error('Supabase client is unavailable.');
      }

      const { data, error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setStatus('success');
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      console.error('Password update error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Failed to update password. Please ensure you clicked a valid recovery link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 relative overflow-hidden py-12">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-neon/5 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full dispatch-card p-8 sm:p-12 relative z-10 border border-brand-border"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-neon/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-brand-neon/20">
            <KeyRound className="w-8 h-8 text-brand-neon" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-medium tracking-tight mb-2 text-brand-text">
            Set New Password
          </h1>
          <p className="text-brand-muted text-xs">
            {userEmail ? (
              <span>Updating credentials for <b className="text-brand-text font-mono">{userEmail}</b></span>
            ) : (
              'Enter your new dashboard password below'
            )}
          </p>
        </div>

        {status === 'success' ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-sm font-bold text-emerald-400">Password Updated Successfully!</p>
            <p className="text-xs text-brand-muted">Redirecting you to the Command Centre dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-brand-muted mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                  <input
                    required
                    type="password"
                    placeholder="Enter at least 6 characters"
                    className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3.5 pl-11 pr-4 text-sm text-brand-text focus:outline-none focus:border-brand-neon/50 transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] font-bold text-brand-muted mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                  <input
                    required
                    type="password"
                    placeholder="Re-enter your new password"
                    className="w-full bg-brand-input border border-brand-input-border rounded-xl py-3.5 pl-11 pr-4 text-sm text-brand-text focus:outline-none focus:border-brand-neon/50 transition-all"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {status === 'error' && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Save Password & Launch Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-brand-border text-center">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-xs text-brand-muted hover:text-brand-text transition-colors"
          >
            ← Back to Login
          </button>
        </div>
      </motion.div>
    </div>
  );
}
