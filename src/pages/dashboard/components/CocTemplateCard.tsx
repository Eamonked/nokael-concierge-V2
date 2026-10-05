import React from 'react';
import { RotateCcw, Download, Upload, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getActiveTenant, setActiveTenant, normalizeTenant, subscribeTenant } from '../../../lib/tenant';
import { buildCocPdf } from '../../../lib/cocPdf';
import {
  DEFAULT_COC_TEMPLATE, normalizeCocTemplate, SAMPLE_COC_JOB, SAMPLE_COC_DRIVER, SAMPLE_COC_POD,
  type CocTemplate,
} from '../../../lib/cocRender';

/**
 * Settings → COC certificate. Edits organizations.settings.coc, which both the
 * dashboard and the client portal (coc.nokael.com) use to draw the certificate.
 * The preview is the real PDF, built from a sample delivered job.
 */
export function CocTemplateCard({ orgId, canEdit }: { orgId?: string | null; canEdit: boolean }) {
  const saved = React.useMemo(() => normalizeCocTemplate(getActiveTenant().settings.coc), []);
  const [tpl, setTpl] = React.useState<CocTemplate>(saved);
  const [savedTpl, setSavedTpl] = React.useState<CocTemplate>(saved);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [logoUrl, setLogoUrl] = React.useState(getActiveTenant().branding.logo_url || '');
  const [logoBusy, setLogoBusy] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const hasLogo = Boolean(logoUrl);

  const set = <K extends keyof CocTemplate>(key: K, value: CocTemplate[K]) => {
    setTpl(prev => ({ ...prev, [key]: value }));
    setMessage(null);
  };
  const dirty = JSON.stringify(tpl) !== JSON.stringify(savedTpl);

  // The company profile can arrive after this mounts; adopt it unless mid-edit.
  const dirtyRef = React.useRef(dirty);
  dirtyRef.current = dirty;
  React.useEffect(() => subscribeTenant(t => {
    setLogoUrl(t.branding.logo_url || '');
    if (dirtyRef.current) return;
    const next = normalizeCocTemplate(t.settings.coc);
    setTpl(next);
    setSavedTpl(next);
  }), []);

  // Rebuild the preview shortly after typing stops.
  React.useEffect(() => {
    let alive = true;
    let url: string | null = null;
    const timer = window.setTimeout(async () => {
      const { doc } = await buildCocPdf(SAMPLE_COC_JOB, SAMPLE_COC_DRIVER, SAMPLE_COC_POD, { template: normalizeCocTemplate(tpl) });
      if (!alive) return;
      url = URL.createObjectURL(doc.output('blob'));
      setPreviewUrl(url);
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [tpl, logoUrl]);

  const save = async () => {
    if (!supabase || !orgId) return;
    setSaving(true);
    setMessage(null);
    const clean = normalizeCocTemplate(tpl);
    const { data, error } = await supabase.rpc('update_org_profile', { p_org: orgId, p_settings: { coc: clean } });
    setSaving(false);
    if (error) return setMessage({ kind: 'error', text: error.message });
    // The function drops keys it doesn't know; an older database silently ignores "coc".
    if (!(data as any)?.settings?.coc) {
      return setMessage({ kind: 'error', text: 'The database is not ready for COC templates yet — apply supabase-coc-template.sql, then save again.' });
    }
    setActiveTenant(normalizeTenant(data));
    setTpl(clean);
    setSavedTpl(clean);
    setMessage({ kind: 'ok', text: 'Saved. New certificates — from here and from client tracking links — use this template.' });
  };

  /** Saves branding.logo_url (the company-wide logo) and refreshes the active company. */
  const saveLogoUrl = async (url: string) => {
    const { data, error } = await supabase!.rpc('update_org_profile', { p_org: orgId, p_branding: { logo_url: url } });
    if (error) throw error;
    setActiveTenant(normalizeTenant(data));
    setLogoUrl(url);
  };

  const uploadLogo = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file || !supabase || !orgId) return;
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[file.type];
    if (!ext) return setMessage({ kind: 'error', text: 'Use a PNG, JPG or WebP image.' });
    if (file.size > 1024 * 1024) return setMessage({ kind: 'error', text: 'The logo must be 1 MB or smaller.' });
    setLogoBusy(true);
    setMessage(null);
    try {
      // A new name each time, so browsers and the PDF never show a cached old logo.
      const path = `${orgId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('org-logos')
        .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
      if (error) {
        throw /bucket not found/i.test(error.message)
          ? new Error('The database is not ready for logo uploads yet — apply supabase-coc-template.sql, then try again.')
          : error;
      }
      await saveLogoUrl(supabase.storage.from('org-logos').getPublicUrl(path).data.publicUrl);
      set('show_logo', true);
      setMessage({ kind: 'ok', text: 'Logo uploaded. Save the template to put it on certificates.' });
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || String(err) });
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    if (!supabase || !orgId || !window.confirm('Remove the company logo? It is also used on your booking pages.')) return;
    setLogoBusy(true);
    setMessage(null);
    try {
      await saveLogoUrl('');
      set('show_logo', false);
      setMessage({ kind: 'ok', text: 'Logo removed. Save the template to update certificates.' });
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || String(err) });
    } finally {
      setLogoBusy(false);
    }
  };

  const downloadSample = async () => {
    const { doc } = await buildCocPdf(SAMPLE_COC_JOB, SAMPLE_COC_DRIVER, SAMPLE_COC_POD, { template: normalizeCocTemplate(tpl) });
    doc.save('COC-template-preview.pdf');
  };

  return (
    <div className="coc-template">
      <div className="coc-template-form">
        <div className="settings-form-grid">
          <label className="field wide">
            <span>Certificate title</span>
            <input type="text" maxLength={60} value={tpl.title} disabled={!canEdit}
              onChange={e => set('title', e.target.value)} placeholder={DEFAULT_COC_TEMPLATE.title} />
          </label>
          <label className="field wide">
            <span>Company details <small>legal name, licence / TRN, address — up to 4 lines</small></span>
            <textarea rows={3} maxLength={300} value={tpl.company_details} disabled={!canEdit}
              onChange={e => set('company_details', e.target.value)}
              placeholder={'Nokael Logistics LLC · Trade licence 123456\nTRN 100000000000003\nBusiness Bay, Dubai, UAE'} />
          </label>
          <label className="field">
            <span>Header colour</span>
            <div className="coc-color">
              <input type="color" value={tpl.header_color} disabled={!canEdit} onChange={e => set('header_color', e.target.value)} />
              <code>{tpl.header_color}</code>
            </div>
          </label>
          <label className="field">
            <span>Accent colour <small>status line, GPS links</small></span>
            <div className="coc-color">
              <input type="color" value={tpl.accent_color} disabled={!canEdit} onChange={e => set('accent_color', e.target.value)} />
              <code>{tpl.accent_color}</code>
            </div>
          </label>
          <label className="field wide">
            <span>Footer note <small>up to 4 lines</small></span>
            <textarea rows={3} maxLength={400} value={tpl.footer_note} disabled={!canEdit}
              onChange={e => set('footer_note', e.target.value)} />
          </label>
        </div>

        <div className="coc-logo">
          <div className="coc-logo-thumb" style={{ background: tpl.header_color }}>
            {hasLogo
              ? <img src={logoUrl} alt="Company logo" referrerPolicy="no-referrer" />
              : <span>No logo</span>}
          </div>
          <div className="coc-logo-body">
            <b>Company logo</b>
            <small>PNG, JPG or WebP, up to 1 MB. A transparent PNG looks best on the header colour. Also shown on your booking pages.</small>
            {canEdit && (
              <div className="coc-logo-actions">
                <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden
                  onChange={e => uploadLogo(e.target.files?.[0])} />
                <button type="button" disabled={logoBusy} onClick={() => fileInput.current?.click()}>
                  <Upload size={13} /> {logoBusy ? 'Working…' : hasLogo ? 'Replace logo' : 'Upload logo'}
                </button>
                {hasLogo && (
                  <button type="button" disabled={logoBusy} onClick={removeLogo}>
                    <Trash2 size={13} /> Remove
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="notification-settings-list">
          <label>
            <span>
              <b>Logo in header</b>
              <small>{hasLogo ? 'Show the logo instead of the company name.' : 'Upload a logo above first.'}</small>
            </span>
            <input type="checkbox" checked={tpl.show_logo && hasLogo} disabled={!canEdit || !hasLogo} onChange={e => set('show_logo', e.target.checked)} />
          </label>
          <label>
            <span><b>Vehicle details</b><small>Make, model and plate under the driver's name</small></span>
            <input type="checkbox" checked={tpl.show_vehicle} disabled={!canEdit} onChange={e => set('show_vehicle', e.target.checked)} />
          </label>
          <label>
            <span><b>Handover GPS</b><small>Where each handover was confirmed, with a map link</small></span>
            <input type="checkbox" checked={tpl.show_gps} disabled={!canEdit} onChange={e => set('show_gps', e.target.checked)} />
          </label>
          <label>
            <span><b>Total time in custody</b><small>Pickup to delivery duration</small></span>
            <input type="checkbox" checked={tpl.show_transit_time} disabled={!canEdit} onChange={e => set('show_transit_time', e.target.checked)} />
          </label>
        </div>

        {message && <p className={`coc-template-msg ${message.kind}`} role="status">{message.text}</p>}

        <div className="settings-form-footer">
          {canEdit && (
            <button type="button" onClick={() => { setTpl(DEFAULT_COC_TEMPLATE); setMessage(null); }}>
              <RotateCcw size={13} /> Reset to default
            </button>
          )}
          <button type="button" onClick={downloadSample}>
            <Download size={13} /> Download sample
          </button>
          {canEdit && (
            <button type="button" className="primary" disabled={!dirty || saving} onClick={save}>
              {saving ? 'Saving…' : 'Save template'}
            </button>
          )}
        </div>
        {!canEdit && <p className="coc-template-msg">Only owners and admins can change the template.</p>}
      </div>

      <div className="coc-template-preview">
        {previewUrl
          ? <iframe title="COC certificate preview" src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`} />
          : <div className="coc-template-loading">Building preview…</div>}
      </div>
    </div>
  );
}
