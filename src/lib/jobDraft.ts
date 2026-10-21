import type { Job } from './supabase';

// ==========================================
// Starting a new job from an old one
// ==========================================
// Used by "Duplicate job" and by converting a client-app re-booking (quote
// with rebook_of_job_id). Copies only the reusable commercial/route details:
// driver, internal notes, quote link, status, schedule time, time windows,
// attachments and every token/OTP are NOT carried over — the create path
// issues fresh ones.

export function jobToDraft(job: Job): Partial<Job> {
  return {
    sender_name: job.sender_name,
    sender_phone: job.sender_phone,
    recipient_name: job.recipient_name,
    recipient_phone: job.recipient_phone,
    pickup_emirate: job.pickup_emirate,
    pickup_location: job.pickup_location,
    pickup_lat: job.pickup_lat,
    pickup_lng: job.pickup_lng,
    delivery_emirate: job.delivery_emirate,
    delivery_location: job.delivery_location,
    delivery_lat: job.delivery_lat,
    delivery_lng: job.delivery_lng,
    item_type: job.item_type,
    urgency: job.urgency,
    company_name: job.company_name,
    // Same account and campaign: duplicating is how dispatch books the next
    // recipient of a multi-drop campaign. The delivery slot is NOT copied.
    business_id: job.business_id,
    client_reference: job.client_reference,
    service_tier: job.service_tier,
    price_aed: job.price_aed,
    special_instructions: job.special_instructions,
    confirmation_mode: job.confirmation_mode,
    // Stop details, cargo and payment carry over; time windows and attachments don't.
    pickup_building: job.pickup_building,
    pickup_company: job.pickup_company,
    pickup_notes: job.pickup_notes,
    delivery_building: job.delivery_building,
    delivery_company: job.delivery_company,
    delivery_notes: job.delivery_notes,
    payment_mode: job.payment_mode,
    vehicle_required: job.vehicle_required,
    quantity: job.quantity,
    weight_kg: job.weight_kg,
    length_cm: job.length_cm,
    width_cm: job.width_cm,
    height_cm: job.height_cm,
    handling_flags: job.handling_flags,
  };
}

/** The same draft the other way round: each stop's address, details and contact swap sides. */
export function reverseDraft(d: Partial<Job>): Partial<Job> {
  return {
    ...d,
    sender_name: d.recipient_name, recipient_name: d.sender_name,
    sender_phone: d.recipient_phone, recipient_phone: d.sender_phone,
    pickup_emirate: d.delivery_emirate, delivery_emirate: d.pickup_emirate,
    pickup_location: d.delivery_location, delivery_location: d.pickup_location,
    pickup_lat: d.delivery_lat, delivery_lat: d.pickup_lat,
    pickup_lng: d.delivery_lng, delivery_lng: d.pickup_lng,
    pickup_building: d.delivery_building, delivery_building: d.pickup_building,
    pickup_company: d.delivery_company, delivery_company: d.pickup_company,
    pickup_notes: d.delivery_notes, delivery_notes: d.pickup_notes,
  };
}

/** Loose address comparison (case, spaces) for "is this the same stop?". */
export const sameAddress = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();
