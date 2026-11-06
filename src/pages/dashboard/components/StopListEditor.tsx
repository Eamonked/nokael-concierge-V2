import React from 'react';
import { ArrowDown, ArrowUp, MapPin, Plus, Trash2, Lock, CornerDownLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { JobKind, JobStop, JobStopInput } from '../../../lib/supabase';
import type { LatLng } from '../../../lib/geo';
import { regionOptions, isoToZonedInput, zonedInputToIso } from '../../../lib/tenant';

// ==========================================
// Multi-stop / round-trip stop list (job form)
// ==========================================
// One card per stop, in the order the driver does them. Each stop has its own
// contact (who hands over or receives, and gets that stop's code), place, pin,
// optional time window and an item note ("signed copy", "2 boxes").
// Rules (also enforced by save_job_stops): first stop is a pickup, last is a
// drop-off. A round trip's last stop is tied to stop 1 (back to the sender).
// Handed-over stops are frozen.

export interface StopDraft {
  key: string;
  id?: string;
  kind: 'pickup' | 'drop';
  contact_name: string;
  contact_phone: string;
  emirate: string;
  address: string;
  pin: LatLng | null;
  building: string;
  company: string;
  notes: string;
  item_note: string;
  window_start: string; // datetime-local in the company's zone
  window_end: string;
  handed: boolean;
  /** Round-trip preset: copies this stop's place and contact until edited directly. */
  mirrorOf?: string;
}

const newKey = () => Math.random().toString(36).slice(2);

export const emptyStop = (kind: 'pickup' | 'drop', emirate: string): StopDraft => ({
  key: newKey(), kind, contact_name: '', contact_phone: '', emirate, address: '', pin: null,
  building: '', company: '', notes: '', item_note: '', window_start: '', window_end: '', handed: false,
});

export const stopFromJobStop = (s: JobStop, keepIdentity: boolean): StopDraft => ({
  key: newKey(),
  id: keepIdentity ? s.id : undefined,
  kind: s.kind,
  contact_name: s.contact_name ?? '',
  contact_phone: s.contact_phone ?? '',
  emirate: s.emirate ?? '',
  address: s.address,
  pin: s.lat != null && s.lng != null ? [s.lat, s.lng] : null,
  building: s.building ?? '',
  company: s.company ?? '',
  notes: s.notes ?? '',
  item_note: s.item_note ?? '',
  window_start: keepIdentity ? isoToZonedInput(s.window_start) : '',
  window_end: keepIdentity ? isoToZonedInput(s.window_end) : '',
  handed: keepIdentity && !!s.handed_at,
});

/** A → B, collect at B, back to A. Stops 3 and 4 copy 2 and 1 until edited. */
export const roundTripPreset = (first: StopDraft, second: StopDraft): StopDraft[] => [
  { ...first, kind: 'pickup' },
  { ...second, kind: 'drop' },
  { ...second, key: newKey(), id: undefined, kind: 'pickup', item_note: '', notes: '', window_start: '', window_end: '', handed: false, mirrorOf: second.key },
  { ...first, key: newKey(), id: undefined, kind: 'drop', item_note: '', notes: '', window_start: '', window_end: '', handed: false },
];

/** A round trip ends back at stop 1: the last stop always mirrors stop 1's place and contact. */
/** Place and contact fields a mirrored stop copies. */
const copyPlace = (to: StopDraft, from: StopDraft): StopDraft => ({
  ...to,
  contact_name: from.contact_name, contact_phone: from.contact_phone, emirate: from.emirate,
  address: from.address, pin: from.pin, building: from.building, company: from.company,
});

export const tieRoundTrip = (input: StopDraft[]): StopDraft[] => {
  // The return pickup (preset stop 3) follows the stop it was copied from until edited.
  const stops = input.map(s => {
    const src = s.mirrorOf && !s.handed ? input.find(x => x.key === s.mirrorOf) : undefined;
    return src ? copyPlace(s, src) : s;
  });
  if (stops.length < 2) return stops;
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (last.handed) return stops;
  const tied: StopDraft = {
    ...last,
    kind: 'drop',
    contact_name: first.contact_name,
    contact_phone: first.contact_phone,
    emirate: first.emirate,
    address: first.address,
    pin: first.pin,
    building: first.building,
    company: first.company,
  };
  return [...stops.slice(0, -1), tied];
};

export const stopsToInput = (stops: StopDraft[]): JobStopInput[] =>
  stops.map(s => ({
    id: s.id,
    kind: s.kind,
    contact_name: s.contact_name.trim() || null,
    contact_phone: s.contact_phone.trim() || null,
    emirate: s.emirate || null,
    address: s.address.trim(),
    lat: s.pin?.[0] ?? null,
    lng: s.pin?.[1] ?? null,
    building: s.building.trim() || null,
    company: s.company.trim() || null,
    notes: s.notes.trim() || null,
    item_note: s.item_note.trim() || null,
    window_start: zonedInputToIso(s.window_start),
    window_end: zonedInputToIso(s.window_end),
  }));

/** First problem with the stop list, in the dispatcher's words, or null. */
export const stopListProblem = (kind: JobKind, stops: StopDraft[]): string | null => {
  if (stops.length < 2 || (kind === 'round_trip' && stops.length < 3)) {
    return kind === 'round_trip' ? 'A round trip needs at least 3 stops.' : 'A multi-stop job needs at least 2 stops.';
  }
  if (stops[0].kind !== 'pickup') return 'The first stop must be a pickup.';
  if (stops[stops.length - 1].kind !== 'drop') return 'The last stop must be a drop-off.';
  const late = stops.findIndex(s => s.window_start && s.window_end && s.window_end < s.window_start);
  if (late >= 0) return `Stop ${late + 1}: the time window ends before it starts.`;
  return null;
};

const Field: React.FC<{ label: string; span2?: boolean; wide?: boolean; required?: boolean; children: React.ReactNode }> = ({ label, span2, wide, required, children }) => (
  <label className={`field${wide ? ' wide' : ''}${span2 ? ' span-2' : ''}`}>
    <span className="field-label" title={label}>{label}{required ? ' *' : ''}</span>
    {children}
  </label>
);

interface Props {
  kind: Exclude<JobKind, 'one_way'>;
  stops: StopDraft[];
  onChange: (stops: StopDraft[]) => void;
  onPickOnMap: (index: number) => void;
}

export const StopListEditor: React.FC<Props> = ({ kind, stops, onChange, onPickOnMap }) => {
  const { t } = useTranslation('dashboard');
  const isRound = kind === 'round_trip';
  const lastIndex = stops.length - 1;
  const commit = (next: StopDraft[]) => onChange(isRound ? tieRoundTrip(next) : next);

  // Editing a mirrored stop's place or contact detaches it from its source.
  const PLACE_KEYS: (keyof StopDraft)[] = ['contact_name', 'contact_phone', 'emirate', 'address', 'pin', 'building', 'company'];
  const update = (i: number, patch: Partial<StopDraft>) =>
    commit(stops.map((s, idx) => (idx === i
      ? { ...s, ...patch, ...(s.mirrorOf && PLACE_KEYS.some(k => k in patch) ? { mirrorOf: undefined } : {}) }
      : s)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j > lastIndex || stops[i].handed || stops[j].handed) return;
    const next = [...stops];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  const remove = (i: number) => commit(stops.filter((_, idx) => idx !== i));

  const add = () => {
    const ref = stops[lastIndex] ?? stops[0];
    const fresh = emptyStop('drop', ref?.emirate ?? '');
    // A round trip's last stop stays the return to the sender: add before it.
    const next = isRound && stops.length >= 2
      ? [...stops.slice(0, -1), fresh, stops[lastIndex]]
      : [...stops, fresh];
    commit(next);
  };

  return (
    <div className="route-form-grid stop-list" data-section="stops">
      <div className="stop-list-intro">
        <b>{isRound
          ? t('stops.roundTitle', { defaultValue: 'Round trip stops' })
          : t('stops.multiTitle', { defaultValue: 'Stops, in order' })}</b>
        <small>{isRound
          ? t('stops.roundHint', { defaultValue: 'The driver collects, delivers, picks up what comes back and returns it to stop 1. Every stop gets its own handover code.' })
          : t('stops.multiHint', { defaultValue: 'The driver does the stops in this order. Every stop gets its own handover code, sent to that stop’s contact.' })}</small>
      </div>

      {stops.map((s, i) => {
        const tiedReturn = isRound && i === lastIndex && !s.handed;
        const locked = s.handed;
        const readOnly = locked || tiedReturn;
        return (
          <section key={s.key} className={`route-form-section stop-card ${s.kind === 'pickup' ? 'pickup' : 'dropoff'}${locked ? ' is-locked' : ''}`}>
            <div className="stop-card-head">
              <span className="stop-card-num">{i + 1}</span>
              {readOnly || i === 0 || i === lastIndex ? (
                <b className="stop-card-kind">
                  {s.kind === 'pickup'
                    ? t('stops.pickup', { defaultValue: 'Pickup' })
                    : tiedReturn
                      ? t('stops.returnToSender', { defaultValue: 'Return to stop 1' })
                      : t('stops.drop', { defaultValue: 'Drop-off' })}
                </b>
              ) : (
                <div className="stop-kind-toggle" role="radiogroup" aria-label={t('stops.kindLabel', { defaultValue: 'Stop type' })}>
                  {(['pickup', 'drop'] as const).map(k => (
                    <button key={k} type="button" role="radio" aria-checked={s.kind === k}
                      className={s.kind === k ? 'selected' : ''} onClick={() => update(i, { kind: k })}>
                      {k === 'pickup' ? t('stops.pickup', { defaultValue: 'Pickup' }) : t('stops.drop', { defaultValue: 'Drop-off' })}
                    </button>
                  ))}
                </div>
              )}
              {locked && <span className="stop-card-flag"><Lock className="w-3 h-3" /> {t('stops.handed', { defaultValue: 'Handed over' })}</span>}
              {tiedReturn && <span className="stop-card-flag"><CornerDownLeft className="w-3 h-3" /> {t('stops.tied', { defaultValue: 'Same place and contact as stop 1' })}</span>}
              <div className="stop-card-actions">
                <button type="button" aria-label={t('stops.moveUp', { defaultValue: 'Move up' })} title={t('stops.moveUp', { defaultValue: 'Move up' })}
                  disabled={i === 0 || locked || stops[i - 1]?.handed || tiedReturn} onClick={() => move(i, -1)}>
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" aria-label={t('stops.moveDown', { defaultValue: 'Move down' })} title={t('stops.moveDown', { defaultValue: 'Move down' })}
                  disabled={i === lastIndex || locked || (isRound && i === lastIndex - 1)} onClick={() => move(i, 1)}>
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button type="button" aria-label={t('stops.remove', { defaultValue: 'Remove stop' })} title={t('stops.remove', { defaultValue: 'Remove stop' })}
                  disabled={locked || stops.length <= (isRound ? 3 : 2) || (isRound && (i === 0 || i === lastIndex))} onClick={() => remove(i)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {s.mirrorOf && !tiedReturn && (
              <p className="stop-card-summary">{t('stops.mirrored', { defaultValue: 'Same place and contact as stop {{n}} until you change them.', n: (stops.findIndex(x => x.key === s.mirrorOf) + 1) || 2 })}</p>
            )}
            {tiedReturn ? (
              <p className="stop-card-summary">
                {s.address || t('stops.tiedEmpty', { defaultValue: 'Fill in stop 1 first.' })}
                {s.contact_name && ` · ${s.contact_name}`}
              </p>
            ) : null}

            <fieldset className="leg-fields leg-fields-3" disabled={locked}>
              {!tiedReturn && (<>
                <Field label={t('jobCreateModal.mapLocation')} span2 required>
                  <div className="location-input">
                    <MapPin className="w-3.5 h-3.5" />
                    <input required type="text" value={s.address} onChange={e => update(i, { address: e.target.value, pin: null })}
                      placeholder={s.kind === 'pickup' ? t('jobCreateModal.pickupAddressPlaceholder') : t('jobCreateModal.deliveryAddressPlaceholder')} />
                    <button type="button" onClick={() => onPickOnMap(i)}>{t('jobCreateModal.pickOnMap')}</button>
                  </div>
                  <span className={`pin-status${s.pin ? ' exact' : ''}`}>
                    {s.pin
                      ? <>{t('jobCreateModal.pinExact', { defaultValue: 'Exact pin set' })} · {s.pin[0].toFixed(5)}, {s.pin[1].toFixed(5)}</>
                      : t('jobCreateModal.pinNone', { defaultValue: 'No pin — the address will be looked up automatically. Use Pick on map for an exact point.' })}
                  </span>
                </Field>
                <Field label={t('jobCreateModal.emirateLabel')} required>
                  <select required value={s.emirate} onChange={e => update(i, { emirate: e.target.value, pin: null })}>
                    {regionOptions(s.emirate).map(em => <option key={em} value={em}>{em}</option>)}
                  </select>
                </Field>
                <Field label={t('jobCreateModal.contactPerson')} required={i === 0}>
                  <input required={i === 0} type="text" value={s.contact_name} onChange={e => update(i, { contact_name: e.target.value })} placeholder={t('jobCreateModal.fullNamePlaceholder')} />
                </Field>
                <Field label={t('jobCreateModal.directMobile')} required={i === 0}>
                  <input required={i === 0} type="tel" value={s.contact_phone} onChange={e => update(i, { contact_phone: e.target.value })} placeholder={t('jobCreateModal.whatsappPlaceholder')} />
                </Field>
                <Field label={t('jobCreateModal.buildingUnitGate')}>
                  <input type="text" value={s.building} onChange={e => update(i, { building: e.target.value })} placeholder={t('jobCreateModal.buildingPlaceholder')} />
                </Field>
                <Field label={t('jobCreateModal.companyEntity')}>
                  <input type="text" value={s.company} onChange={e => update(i, { company: e.target.value })} placeholder={t('jobCreateModal.companyEntityPlaceholder')} />
                </Field>
              </>)}
              <Field label={t('jobCreateModal.windowStart')}>
                <input type="datetime-local" value={s.window_start} onChange={e => update(i, { window_start: e.target.value })} />
              </Field>
              <Field label={t('jobCreateModal.windowEnd')}>
                <input type="datetime-local" value={s.window_end} min={s.window_start || undefined} onChange={e => update(i, { window_end: e.target.value })} />
              </Field>
              <Field label={s.kind === 'pickup'
                ? t('stops.itemCollect', { defaultValue: 'What is collected' })
                : t('stops.itemDrop', { defaultValue: 'What is handed over' })}>
                <input type="text" value={s.item_note} onChange={e => update(i, { item_note: e.target.value })}
                  placeholder={t('stops.itemPlaceholder', { defaultValue: 'e.g. signed contract, 2 boxes' })} />
              </Field>
              <Field label={t('jobCreateModal.gateNotes')} wide>
                <textarea rows={2} value={s.notes} onChange={e => update(i, { notes: e.target.value })} placeholder={t('jobCreateModal.gateNotesPlaceholder')} />
              </Field>
            </fieldset>
          </section>
        );
      })}

      <button type="button" className="route-swap-button stop-add" onClick={add}>
        <Plus className="w-3.5 h-3.5" />
        {isRound
          ? t('stops.addBeforeReturn', { defaultValue: 'Add a stop before the return' })
          : t('stops.add', { defaultValue: 'Add stop' })}
      </button>
    </div>
  );
};
