-- Pixel Realms — Supabase schema
-- Run this once in Supabase SQL Editor.
--
-- One row per account. Character data is a single JSONB blob (no rigid
-- columns because the game's character shape evolves frequently — adding
-- a new stat shouldn't require a migration).

create table if not exists accounts (
  username text primary key,           -- lowercase, unique identity
  display_name text not null,          -- original-case name
  salt text not null,
  password_hash text not null,         -- SHA-256(password::salt), hex
  character jsonb not null,            -- CharacterData (see apps/server/src/accounts.ts)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_updated_at_idx on accounts (updated_at desc);

-- Row Level Security: this table is only accessed by the game server using
-- the service_role key (bypasses RLS). Clients never talk to Supabase
-- directly. Enabling RLS without policies = locked from public access.
alter table accounts enable row level security;
