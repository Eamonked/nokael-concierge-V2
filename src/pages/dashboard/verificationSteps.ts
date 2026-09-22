import type { Job } from '../../lib/supabase';

// Chain-of-custody columns the dashboard can force-confirm or reset.
export type CocStepKey =
  | 'client_pickup_at'
  | 'driver_pickup_at'
  | 'driver_delivery_at'
  | 'client_delivery_at';

export type TokenKey =
  | 'token_client_pickup'
  | 'token_driver_pickup'
  | 'token_driver_delivery'
  | 'token_client_delivery';

type OtpKey = 'otp_sender' | 'otp_driver_pickup' | 'otp_driver_delivery' | 'otp_recipient';

export interface VerificationStepDef {
  stepKey: CocStepKey;
  /** Key under `jobDetailModal.verification.steps.*` for this step's label/desc. */
  i18nKey: string;
  /** Portal link token. null when the step has no portal page (driver_only). */
  tokenKey: TokenKey | null;
  /** Which job column holds the code dispatch may need to read out for this step. */
  otpKey: OtpKey;
  /** Key under `jobDetailModal.verification.*` for the "waiting" line. */
  waitingKey: 'waiting' | 'waitingSender' | 'waitingRecipient';
}

// four_step (legacy): sender + driver + driver + recipient, portal steps required.
const FOUR_STEP: VerificationStepDef[] = [
  { stepKey: 'client_pickup_at',   i18nKey: 'senderHandover',    tokenKey: 'token_client_pickup',   otpKey: 'otp_sender',          waitingKey: 'waiting' },
  { stepKey: 'driver_pickup_at',   i18nKey: 'driverPickup',      tokenKey: 'token_driver_pickup',   otpKey: 'otp_driver_pickup',   waitingKey: 'waiting' },
  { stepKey: 'driver_delivery_at', i18nKey: 'driverArrived',     tokenKey: 'token_driver_delivery', otpKey: 'otp_driver_delivery', waitingKey: 'waiting' },
  { stepKey: 'client_delivery_at', i18nKey: 'recipientReceived', tokenKey: 'token_client_delivery', otpKey: 'otp_recipient',       waitingKey: 'waiting' },
];

// driver_only (default): the driver alone confirms both hand-offs in the app.
// Pickup takes the SENDER's code, delivery takes the RECIPIENT's code, and
// otp_driver_pickup / otp_driver_delivery are not used. There are no portal
// pages, so no tokens. Accepting the delivery code completes the job.
const DRIVER_ONLY: VerificationStepDef[] = [
  { stepKey: 'driver_pickup_at',   i18nKey: 'pickupCode',   tokenKey: null, otpKey: 'otp_sender',    waitingKey: 'waitingSender' },
  { stepKey: 'driver_delivery_at', i18nKey: 'deliveryCode', tokenKey: null, otpKey: 'otp_recipient', waitingKey: 'waitingRecipient' },
];

/**
 * True only when the job is explicitly driver_only. A job with no
 * confirmation_mode loaded falls back to the four-step view, which is a
 * superset (shows every step and code) rather than hiding information.
 */
export const isDriverOnly = (job: Pick<Job, 'confirmation_mode'>): boolean =>
  job.confirmation_mode === 'driver_only';

export const getVerificationSteps = (job: Pick<Job, 'confirmation_mode'>): VerificationStepDef[] =>
  isDriverOnly(job) ? DRIVER_ONLY : FOUR_STEP;

/** i18n key for a step's label, used for on-screen text and the English audit log. */
export const stepI18nKey = (job: Pick<Job, 'confirmation_mode'>, stepKey: CocStepKey): string =>
  getVerificationSteps(job).find(s => s.stepKey === stepKey)?.i18nKey ?? stepKey;
