import React from 'react';
import { motion } from 'motion/react';
import { Lock, ArrowRight, Loader2, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const navigate = useNavigate();

  // Redirect if already authenticated
  React.useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard');
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError('Invalid dispatch credentials. Access denied.');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-neon/5 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full dispatch-card p-12 relative z-10"
      >
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-brand-neon/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-brand-neon/20">
            <Terminal className="w-8 h-8 text-brand-neon" />
          </div>
          <h1 className="text-3xl font-display font-medium tracking-tighter mb-2">Dispatch Access.</h1>
          <p className="text-brand-muted text-[10px] uppercase tracking-[0.3em] font-bold">Authorized Personnel Only</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.3em] font-bold text-brand-muted mb-4">Admin Email</label>
              <input
                required
                type="email"
                placeholder="admin@example.com"
                className="w-full bg-brand-input border border-brand-input-border rounded-2xl py-5 px-6 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-all font-display tracking-tight"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.3em] font-bold text-brand-muted mb-4">Password</label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-muted" />
                <input
                  required
                  type="password"
                  placeholder="Enter Access Key"
                  className="w-full bg-brand-input border border-brand-input-border rounded-2xl py-5 pl-14 pr-6 text-brand-text focus:outline-none focus:border-brand-neon/50 transition-all font-display tracking-tight"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
            disabled={loading}
            className="btn-primary w-full py-5 text-[10px]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Initialize Command Center</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-12 pt-10 border-t border-brand-border text-center">
          <p className="text-[9px] text-brand-muted uppercase tracking-[0.3em] font-bold leading-relaxed">
            All access attempts are logged.<br />
            Emergency logistics protocol active.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
