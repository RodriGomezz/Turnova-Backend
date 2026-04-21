-- Verificación post-migración para el flujo de suscripciones

-- 1. Confirmar enums actualizados
select enumlabel
from pg_enum
where enumtypid = 'subscription_status'::regtype
order by enumsortorder;

select enumlabel
from pg_enum
where enumtypid = 'subscription_plan'::regtype
order by enumsortorder;

-- 2. Detectar negocios con más de una suscripción efectiva
select
  business_id,
  count(*) as effective_subscriptions
from subscriptions
where status in ('active', 'past_due', 'grace_period')
group by business_id
having count(*) > 1;

-- 3. Detectar checkouts pendientes acumulados
select
  business_id,
  count(*) as pending_subscriptions
from subscriptions
where status = 'pending'
group by business_id
having count(*) > 1;

-- 4. Detectar filas activas sin pago conciliado
select
  id,
  business_id,
  plan,
  status,
  dlocal_subscription_id,
  dlocal_payment_id,
  current_period_start,
  current_period_end,
  created_at
from subscriptions
where status = 'active'
  and (
    dlocal_payment_id is null
    or current_period_start is null
    or current_period_end is null
  )
order by created_at desc;

-- 5. Detectar trial todavía activo junto con suscripción efectiva
select
  b.id as business_id,
  b.nombre,
  b.plan as business_plan,
  b.trial_ends_at,
  s.plan as subscription_plan,
  s.status as subscription_status
from businesses b
join subscriptions s
  on s.business_id = b.id
where s.status in ('active', 'past_due', 'grace_period')
  and b.trial_ends_at is not null
order by b.nombre;

-- 6. Vista final esperada por negocio
select
  b.id,
  b.nombre,
  b.plan as business_plan,
  b.trial_ends_at,
  a.plan as active_plan,
  a.status as active_status,
  p.plan as pending_plan,
  p.status as pending_status
from businesses b
left join lateral (
  select plan, status
  from subscriptions
  where business_id = b.id
    and status in ('active', 'past_due', 'grace_period')
  order by created_at desc
  limit 1
) a on true
left join lateral (
  select plan, status
  from subscriptions
  where business_id = b.id
    and status = 'pending'
  order by created_at desc
  limit 1
) p on true
order by b.created_at desc
limit 100;
