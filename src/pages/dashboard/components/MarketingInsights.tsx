import React from 'react';
import { supabase, type QuoteRequest } from '../../../lib/supabase';

// What the client app tells us after delivery (Nokael-Confirmation-Portal
// supabase-client-app-migration.sql): where clients heard of us, ratings,
// Google review clicks, home-screen installs and re-bookings. Read once per
// date range — no polling.

const SOURCE_LABELS: Record<string, string> = {
  google: 'Google',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  referral: 'Referral',
  saw_vehicle: 'Saw a driver',
  repeat: 'Used us before',
  other: 'Other',
};

interface FeedbackRow { rating: number | null; lead_source: string | null; google_review_clicked_at: string | null }

export function MarketingInsights({ from, to, quotes }: { from: string; to: string; quotes: QuoteRequest[] }) {
  const [feedback, setFeedback] = React.useState<FeedbackRow[] | null>(null);
  const [installs, setInstalls] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const start = new Date(`${from}T00:00:00`).toISOString();
    const end = new Date(`${to}T23:59:59.999`).toISOString();
    (async () => {
      const [fb, inst] = await Promise.all([
        supabase.from('job_client_feedback').select('rating, lead_source, google_review_clicked_at')
          .gte('created_at', start).lte('created_at', end),
        supabase.from('client_app_tokens').select('token', { count: 'exact', head: true })
          .gte('installed_at', start).lte('installed_at', end),
      ]);
      if (!alive) return;
      // Missing tables (migration not applied yet) just hide the card.
      setFeedback(fb.error ? null : (fb.data as FeedbackRow[]));
      setInstalls(inst.error ? null : inst.count ?? 0);
    })();
    return () => { alive = false; };
  }, [from, to]);

  if (!feedback) return null;

  const rated = feedback.filter((f) => f.rating != null);
  const avg = rated.length ? rated.reduce((s, f) => s + (f.rating || 0), 0) / rated.length : null;
  const reviews = feedback.filter((f) => f.google_review_clicked_at).length;
  const rebooks = quotes.filter((q) => q.source === 'rebook');
  const rebooksConverted = rebooks.filter((q) => q.status === 'completed').length;

  const counts = new Map<string, number>();
  for (const f of feedback) if (f.lead_source) counts.set(f.lead_source, (counts.get(f.lead_source) || 0) + 1);
  const sources = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const answered = sources.reduce((s, [, n]) => s + n, 0);

  return (
    <div className="table-card marketing-insights">
      <div className="marketing-insights-head">
        <b>Client feedback &amp; re-bookings</b>
        <small>From the delivered tracking page and the client app</small>
      </div>
      <div className="marketing-insights-kpis">
        <div><span>Avg rating</span><strong>{avg ? avg.toFixed(1) : '—'}</strong><small>{rated.length} rated</small></div>
        <div><span>Google review clicks</span><strong>{reviews}</strong></div>
        <div><span>App installs</span><strong>{installs ?? '—'}</strong></div>
        <div><span>Re-bookings</span><strong>{rebooks.length}</strong><small>{rebooksConverted} converted</small></div>
      </div>
      <div className="marketing-insights-sources">
        <span className="marketing-insights-label">Where they heard of us</span>
        {sources.length ? sources.map(([key, n]) => (
          <div className="marketing-source-row" key={key}>
            <span>{SOURCE_LABELS[key] || key}</span>
            <span className="marketing-source-bar"><i style={{ width: `${(n / answered) * 100}%` }} /></span>
            <b>{n}</b>
          </div>
        )) : <small className="marketing-insights-empty">No answers in this range yet.</small>}
      </div>
    </div>
  );
}
