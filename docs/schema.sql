-- Turnova / Kronu - schema inicial completo para Supabase
-- Uso recomendado:
-- 1. Crear un proyecto nuevo en Supabase.
-- 2. Ejecutar este archivo completo en SQL Editor.
-- 3. Crear luego el bucket `photos` en Storage.
-- 4. Configurar las variables de entorno del backend/frontend.
--
-- Notas:
-- - Este schema esta pensado para la app actual, no para ser una plantilla genérica.
-- - El backend usa SUPABASE_SERVICE_ROLE_KEY para la mayoria de operaciones.
-- - Por eso, la seguridad principal vive en la API; aun asi, subscriptions queda con RLS explicito.

begin;

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'subscription_plan'
  ) then
    create type public.subscription_plan as enum ('starter', 'pro', 'business');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'subscription_status'
  ) then
    create type public.subscription_status as enum (
      'pending',
      'active',
      'past_due',
      'grace_period',
      'canceled',
      'expired'
    );
  end if;
end $$;

create table if not exists public.businesses (
  id uuid primary key default uuid_generate_v4(),
  slug varchar not null unique,
  nombre varchar not null,
  logo_url text,
  color_fondo text not null default '#ffffff',
  color_acento text not null default '#000000',
  color_superficie text not null default '#f5f5f5',
  email varchar,
  whatsapp varchar,
  direccion text,
  timezone varchar not null default 'America/Montevideo',
  buffer_minutos integer not null default 0,
  activo boolean not null default true,
  plan varchar not null default 'starter',
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  auto_confirmar boolean not null default true,
  frase_bienvenida text,
  hero_imagen_url text,
  instagram text,
  facebook text,
  tipografia text not null default 'clasica',
  estilo_cards text not null default 'minimalista',
  tipo_negocio text not null default 'general',
  termino_profesional text not null default 'Profesional',
  termino_profesional_plural text not null default 'Profesionales',
  termino_servicio text not null default 'Servicio',
  termino_reserva text not null default 'Turno',
  custom_domain varchar,
  domain_verified boolean not null default false,
  domain_verified_at timestamptz,
  domain_added_at timestamptz,
  onboarding_completed boolean not null default false,
  constraint businesses_plan_check
    check (plan in ('starter', 'pro', 'business')),
  constraint businesses_buffer_minutos_check
    check (buffer_minutos >= 0)
);

create unique index if not exists ux_businesses_custom_domain
  on public.businesses ((lower(custom_domain)))
  where custom_domain is not null;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  email varchar not null,
  nombre varchar,
  rol varchar not null default 'owner',
  created_at timestamptz not null default now()
);

create index if not exists idx_users_business_id
  on public.users (business_id);

create table if not exists public.user_businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role varchar not null default 'owner',
  created_at timestamptz not null default now()
);

create index if not exists idx_user_businesses_user_id
  on public.user_businesses (user_id);

create index if not exists idx_user_businesses_business_id
  on public.user_businesses (business_id);

create unique index if not exists ux_user_businesses_user_business
  on public.user_businesses (user_id, business_id);

create table if not exists public.barbers (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  nombre varchar not null,
  foto_url text,
  descripcion text,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_barbers_business_id
  on public.barbers (business_id);

create table if not exists public.services (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  nombre varchar not null,
  descripcion text,
  incluye text,
  duracion_minutos integer not null,
  precio integer not null,
  precio_hasta integer,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint services_duracion_check check (duracion_minutos > 0),
  constraint services_precio_check check (precio >= 0),
  constraint services_precio_hasta_check check (precio_hasta is null or precio_hasta >= precio)
);

create index if not exists idx_services_business_id
  on public.services (business_id);

create table if not exists public.services_defaults (
  id uuid primary key default uuid_generate_v4(),
  nombre varchar not null,
  descripcion text,
  incluye text,
  duracion_minutos integer not null,
  precio_sugerido integer not null,
  precio_hasta integer,
  tipo_negocio varchar not null default 'barberia',
  constraint services_defaults_duracion_check check (duracion_minutos > 0),
  constraint services_defaults_precio_check check (precio_sugerido >= 0),
  constraint services_defaults_precio_hasta_check
    check (precio_hasta is null or precio_hasta >= precio_sugerido)
);

create table if not exists public.schedules (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  barber_id uuid references public.barbers(id) on delete cascade,
  dia_semana smallint not null,
  hora_inicio time not null,
  hora_fin time not null,
  activo boolean not null default true,
  constraint schedules_dia_semana_check check (dia_semana between 0 and 6),
  constraint schedules_horas_check check (hora_fin > hora_inicio)
);

create index if not exists idx_schedules_business_id
  on public.schedules (business_id);

create index if not exists idx_schedules_barber_id
  on public.schedules (barber_id);

create table if not exists public.blocked_dates (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  barber_id uuid references public.barbers(id) on delete cascade,
  fecha date not null,
  fecha_fin date not null,
  motivo text,
  created_at timestamptz not null default now(),
  constraint blocked_dates_rango_check check (fecha_fin >= fecha)
);

create index if not exists idx_blocked_dates_business_id
  on public.blocked_dates (business_id);

create index if not exists idx_blocked_dates_barber_id
  on public.blocked_dates (barber_id);

create index if not exists idx_blocked_dates_fecha
  on public.blocked_dates (fecha);

create table if not exists public.bookings (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  barber_id uuid not null references public.barbers(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  cliente_nombre varchar not null,
  cliente_email varchar not null,
  cliente_telefono varchar not null,
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  estado varchar not null default 'pendiente',
  cancellation_token uuid not null default uuid_generate_v4() unique,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bookings_estado_check
    check (estado in ('pendiente', 'confirmada', 'cancelada')),
  constraint bookings_horas_check
    check (hora_fin > hora_inicio)
);

create index if not exists idx_bookings_business_id
  on public.bookings (business_id);

create index if not exists idx_bookings_barber_id
  on public.bookings (barber_id);

create index if not exists idx_bookings_service_id
  on public.bookings (service_id);

create index if not exists idx_bookings_fecha
  on public.bookings (fecha);

create index if not exists idx_bookings_barber_fecha
  on public.bookings (barber_id, fecha);

alter table public.bookings
  drop constraint if exists bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (
    barber_id with =,
    fecha with =,
    tsrange(
      (fecha::timestamp + hora_inicio),
      (fecha::timestamp + hora_fin),
      '[)'
    ) with &&
  )
  where (estado <> 'cancelada');

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan public.subscription_plan not null,
  status public.subscription_status not null default 'pending',
  dlocal_subscription_id text not null unique,
  dlocal_payment_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_period_ends_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint subscriptions_period_check
    check (
      current_period_start is null
      or current_period_end is null
      or current_period_end >= current_period_start
    ),
  constraint subscriptions_grace_check
    check (
      grace_period_ends_at is null
      or current_period_end is null
      or grace_period_ends_at >= current_period_end
    )
);

create index if not exists idx_subscriptions_business_id
  on public.subscriptions (business_id);

create index if not exists idx_subscriptions_status
  on public.subscriptions (status);

create index if not exists idx_subscriptions_business_created_at
  on public.subscriptions (business_id, created_at desc);

create or replace function public.validate_booking_business_consistency()
returns trigger
language plpgsql
as $$
declare
  barber_business_id uuid;
  service_business_id uuid;
begin
  select business_id into barber_business_id
  from public.barbers
  where id = new.barber_id;

  if barber_business_id is null then
    raise exception 'Barber no existe';
  end if;

  if barber_business_id <> new.business_id then
    raise exception 'El barber no pertenece al business de la reserva';
  end if;

  select business_id into service_business_id
  from public.services
  where id = new.service_id;

  if service_business_id is null then
    raise exception 'Service no existe';
  end if;

  if service_business_id <> new.business_id then
    raise exception 'El service no pertenece al business de la reserva';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_booking_business_consistency on public.bookings;

create trigger trg_validate_booking_business_consistency
before insert or update on public.bookings
for each row
execute function public.validate_booking_business_consistency();

create or replace function public.validate_schedule_business_consistency()
returns trigger
language plpgsql
as $$
declare
  barber_business_id uuid;
begin
  if new.barber_id is null then
    return new;
  end if;

  select business_id into barber_business_id
  from public.barbers
  where id = new.barber_id;

  if barber_business_id is null then
    raise exception 'Barber no existe';
  end if;

  if barber_business_id <> new.business_id then
    raise exception 'El barber no pertenece al business del horario';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_schedule_business_consistency on public.schedules;

create trigger trg_validate_schedule_business_consistency
before insert or update on public.schedules
for each row
execute function public.validate_schedule_business_consistency();

create or replace function public.validate_blocked_date_business_consistency()
returns trigger
language plpgsql
as $$
declare
  barber_business_id uuid;
begin
  if new.barber_id is null then
    return new;
  end if;

  select business_id into barber_business_id
  from public.barbers
  where id = new.barber_id;

  if barber_business_id is null then
    raise exception 'Barber no existe';
  end if;

  if barber_business_id <> new.business_id then
    raise exception 'El barber no pertenece al business del bloqueo';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_blocked_date_business_consistency on public.blocked_dates;

create trigger trg_validate_blocked_date_business_consistency
before insert or update on public.blocked_dates
for each row
execute function public.validate_blocked_date_business_consistency();

alter table public.subscriptions enable row level security;

drop policy if exists "service_role_only_subscriptions" on public.subscriptions;

create policy "service_role_only_subscriptions"
on public.subscriptions
for all
to service_role
using (true)
with check (true);

drop view if exists public.business_subscription;

create view public.business_subscription as
select distinct on (s.business_id)
  s.business_id,
  s.plan,
  s.status,
  s.current_period_end,
  s.grace_period_ends_at,
  s.dlocal_subscription_id,
  s.dlocal_payment_id,
  s.created_at
from public.subscriptions s
order by
  s.business_id,
  case
    when s.status in ('active', 'past_due', 'grace_period') then 0
    when s.status = 'canceled' and s.current_period_end > now() then 1
    when s.status = 'pending' then 2
    else 3
  end,
  s.created_at desc;

comment on table public.businesses is
  'Negocios/tenants. custom_domain es unico y el plan efectivo base vive aqui.';

comment on table public.users is
  'Perfil app del usuario autenticado en Supabase Auth. business_id representa el negocio activo actual.';

comment on table public.user_businesses is
  'Acceso del usuario a multiples negocios o sucursales.';

comment on table public.subscriptions is
  'Historial y estado de cobro. business.plan sigue siendo la fuente del plan efectivo actual.';

comment on column public.blocked_dates.fecha_fin is
  'Rango inclusivo de bloqueo. Si es un solo dia, debe repetirse la misma fecha que fecha.';

commit;

-- Pasos manuales despues de correr este schema:
-- 1. Crear bucket `photos` en Supabase Storage.
-- 2. Definir policies de Storage segun tu estrategia de backend/service role.
-- 3. Cargar services_defaults iniciales si queres onboarding con sugerencias.
-- 4. Crear variables de entorno:
--    - BACKEND: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
--    - FRONTEND: SUPABASE_URL, SUPABASE_ANON_KEY, API_URL, BASE_DOMAIN
