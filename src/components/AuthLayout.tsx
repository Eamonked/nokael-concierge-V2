import React from 'react';
import { Moon, Sun, ShieldCheck, Radio, Users } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/**
 * Shared frame for the sign-in / set-password pages, styled with the same
 * tokens as the ops dashboard (navy brand panel = the sidebar, lime accent,
 * --ent-* surfaces that follow light/dark).
 */
export function AuthLayout({ title, subtitle, children, footer }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="auth-brand-head">
          <span className="auth-brand-mark">
            <img src="/logo.svg" alt="" referrerPolicy="no-referrer" />
          </span>
          <b>NOKAEL</b>
        </div>
        <div className="auth-brand-copy">
          <h2>Operations dashboard</h2>
          <p>Dispatch, track and hand off every delivery from one place.</p>
          <ul>
            <li><Radio size={15} /> Live jobs, drivers and chain of custody</li>
            <li><Users size={15} /> Role-based team access</li>
            <li><ShieldCheck size={15} /> Every sign-in and change is logged</li>
          </ul>
        </div>
        <small className="auth-brand-foot">© {new Date().getFullYear()} Nokael · Authorised personnel only</small>
      </aside>

      <main className="auth-main">
        <button
          type="button"
          className="auth-theme-toggle"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="auth-card">
          <div className="auth-card-mobile-brand">
            <span className="auth-brand-mark"><img src="/logo.svg" alt="" referrerPolicy="no-referrer" /></span>
            <b>NOKAEL</b>
          </div>
          <header>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </header>
          {children}
        </div>
        {footer && <div className="auth-footer">{footer}</div>}
      </main>
    </div>
  );
}

/** Inline status line used under auth forms. */
export function AuthNotice({ kind, children }: { kind: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  return <div className={`auth-notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}
