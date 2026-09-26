import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

type Feedback = { kind: 'ok' | 'error'; text: string } | null;

const FeedbackLine = ({ feedback }: { feedback: Feedback }) =>
  feedback ? (
    <p className={feedback.kind === 'ok' ? 'text-emerald-600 text-xs mt-2' : 'text-red-500 text-xs mt-2'}>{feedback.text}</p>
  ) : null;

/**
 * Settings → Preferences → Account: the signed-in member manages their own
 * name, email and password. Everything goes through the member's own Supabase
 * session (no admin rights needed).
 */
export function AccountSettings() {
  const { t } = useTranslation('dashboard');
  const [email, setEmail] = React.useState('');
  const [pendingEmail, setPendingEmail] = React.useState<string | null>(null);
  const [fullName, setFullName] = React.useState('');
  const [savedName, setSavedName] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [busy, setBusy] = React.useState<'name' | 'email' | 'password' | null>(null);
  const [nameFeedback, setNameFeedback] = React.useState<Feedback>(null);
  const [emailFeedback, setEmailFeedback] = React.useState<Feedback>(null);
  const [passwordFeedback, setPasswordFeedback] = React.useState<Feedback>(null);

  React.useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      setEmail(user.email ?? '');
      setPendingEmail(user.new_email ?? null);
      const name = (user.user_metadata?.full_name as string | undefined) ?? '';
      setFullName(name);
      setSavedName(name);
    });
  }, []);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy('name');
    setNameFeedback(null);
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName.trim() || null } });
    setBusy(null);
    if (error) return setNameFeedback({ kind: 'error', text: error.message });
    setSavedName(fullName.trim());
    setNameFeedback({ kind: 'ok', text: t('account.nameSaved', { defaultValue: 'Name updated.' }) });
  };

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const target = newEmail.trim();
    if (!target || target.toLowerCase() === email.toLowerCase()) return;
    setBusy('email');
    setEmailFeedback(null);
    const { error } = await supabase.auth.updateUser(
      { email: target },
      { emailRedirectTo: `${window.location.origin}/dashboard` },
    );
    setBusy(null);
    if (error) return setEmailFeedback({ kind: 'error', text: error.message });
    setPendingEmail(target);
    setNewEmail('');
    setEmailFeedback({
      kind: 'ok',
      text: t('account.emailPending', {
        email: target,
        defaultValue: 'Check your inbox: we sent a confirmation link to {{email}}. Your email changes once you click it (you may also need to confirm from your current address).',
      }),
    });
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setPasswordFeedback(null);
    if (newPassword.length < 8) {
      return setPasswordFeedback({ kind: 'error', text: t('account.passwordTooShort', { defaultValue: 'Use at least 8 characters.' }) });
    }
    if (newPassword !== confirmPassword) {
      return setPasswordFeedback({ kind: 'error', text: t('account.passwordMismatch', { defaultValue: 'The new passwords do not match.' }) });
    }
    setBusy('password');
    // Confirm it's really them before changing the password.
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) {
      setBusy(null);
      return setPasswordFeedback({ kind: 'error', text: t('account.currentPasswordWrong', { defaultValue: 'Your current password is incorrect.' }) });
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(null);
    if (error) return setPasswordFeedback({ kind: 'error', text: error.message });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordFeedback({ kind: 'ok', text: t('account.passwordChanged', { defaultValue: 'Password changed.' }) });
  };

  const sendResetLink = async () => {
    if (!supabase || !email) return;
    setBusy('password');
    setPasswordFeedback(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/accept-invite` });
    setBusy(null);
    setPasswordFeedback(error
      ? { kind: 'error', text: error.message }
      : { kind: 'ok', text: t('account.resetSent', { email, defaultValue: 'Reset link sent to {{email}}.' }) });
  };

  return (
    <div className="settings-form-card">
      <div className="settings-section-heading">
        <div>
          <h3>{t('settings.preferences.account') || 'Account'}</h3>
          <p>{t('account.subtitle', { defaultValue: 'Your name, sign-in email and password' })}</p>
        </div>
      </div>

      <form className="settings-form-grid" onSubmit={saveName}>
        <div className="field wide">
          <span>{t('account.fullName', { defaultValue: 'Full name' })}</span>
          <div className="flex gap-2">
            <input type="text" value={fullName} maxLength={100} onChange={(e) => setFullName(e.target.value)} className="flex-1" />
            <button className="primary" type="submit" disabled={busy === 'name' || fullName.trim() === savedName}>
              {t('account.save', { defaultValue: 'Save' })}
            </button>
          </div>
          <FeedbackLine feedback={nameFeedback} />
        </div>
      </form>

      <form className="settings-form-grid" onSubmit={changeEmail}>
        <div className="field">
          <span>{t('settings.preferences.email') || 'Email Address'}</span>
          <input type="email" value={email} disabled />
          {pendingEmail && pendingEmail !== email && (
            <small className="text-[11px] opacity-70">
              {t('account.pendingNote', { email: pendingEmail, defaultValue: 'Pending change to {{email}} — confirm from your inbox.' })}
            </small>
          )}
        </div>
        <div className="field">
          <span>{t('account.newEmail', { defaultValue: 'New email address' })}</span>
          <div className="flex gap-2">
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@company.com" className="flex-1" />
            <button className="primary" type="submit" disabled={busy === 'email' || !newEmail.trim()}>
              {t('account.changeEmail', { defaultValue: 'Change' })}
            </button>
          </div>
        </div>
        <div className="field wide" style={{ marginTop: -8 }}>
          <FeedbackLine feedback={emailFeedback} />
        </div>
      </form>

      <form className="settings-form-grid" onSubmit={changePassword}>
        <div className="field">
          <span>{t('account.currentPassword', { defaultValue: 'Current password' })}</span>
          <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        <div className="field" />
        <div className="field">
          <span>{t('account.newPassword', { defaultValue: 'New password' })}</span>
          <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
        </div>
        <div className="field">
          <span>{t('account.confirmPassword', { defaultValue: 'Confirm new password' })}</span>
          <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
        </div>
        <div className="field wide">
          <FeedbackLine feedback={passwordFeedback} />
        </div>
        <div className="settings-form-footer" style={{ gridColumn: '1 / -1' }}>
          <button type="button" className="secondary" onClick={sendResetLink} disabled={busy === 'password'}>
            {t('account.forgotCurrent', { defaultValue: "Forgot it? Email me a reset link" })}
          </button>
          <button className="primary" type="submit" disabled={busy === 'password'}>
            {t('account.changePassword', { defaultValue: 'Change password' })}
          </button>
        </div>
      </form>
    </div>
  );
}
