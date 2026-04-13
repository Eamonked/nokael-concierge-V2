-- ==========================================
-- SUPABASE REPAIR SCRIPT
-- ==========================================
-- Run this in your Supabase SQL Editor to ensure
-- the table exists and RLS policies are correct.

-- 1. Create the table (if it doesn't exist)
create table if not exists public.quote_requests (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  pickup_location text not null,
  delivery_location text not null,
  emirate text not null,
  item_type text not null,
  urgency text not null,
  name text not null,
  phone text not null,
  whatsapp_opt_in boolean not null default true,
  status text not null default 'pending'::text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  gclid text,
  constraint quote_requests_pkey primary key (id),
  constraint quote_requests_item_type_check check (
    (
      item_type = any (
        array[
          'document'::text,
          'parcel'::text,
          'spare_part'::text,
          'other'::text
        ]
      )
    )
  ),
  constraint quote_requests_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'contacted'::text,
          'completed'::text
        ]
      )
    )
  ),
  constraint quote_requests_urgency_check check (
    (
      urgency = any (
        array[
          'immediate'::text,
          'today'::text,
          'scheduled'::text
        ]
      )
    )
  )
);

-- 2. Enable Row Level Security (RLS)
-- This is ON by default in many Supabase projects, but we ensure it here.
alter table public.quote_requests enable row level security;

-- 3. Create RLS Policies
-- IMPORTANT: Without these, the frontend cannot save or read data.

-- Allow anyone to submit a quote (Public INSERT)
drop policy if exists "Enable insert for all users" on public.quote_requests;
create policy "Enable insert for all users" on public.quote_requests
  for insert with check (true);

-- Allow authenticated users (Admins) to read all requests
drop policy if exists "Enable read for authenticated users only" on public.quote_requests;
create policy "Enable read for authenticated users only" on public.quote_requests
  for select using (auth.role() = 'authenticated');

-- Allow authenticated users (Admins) to update status
drop policy if exists "Enable update for authenticated users only" on public.quote_requests;
create policy "Enable update for authenticated users only" on public.quote_requests
  for update using (auth.role() = 'authenticated');

-- Allow authenticated users (Admins) to delete requests
drop policy if exists "Enable delete for authenticated users only" on public.quote_requests;
create policy "Enable delete for authenticated users only" on public.quote_requests
  for delete using (auth.role() = 'authenticated');

-- ==========================================
-- MIGRATION: Add UTM Attribution Columns
-- ==========================================
-- Run this block if the table already exists and you are getting 400 errors
-- on form submission (columns not found).
alter table public.quote_requests
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content  text,
  add column if not exists utm_term     text,
  add column if not exists gclid        text;
