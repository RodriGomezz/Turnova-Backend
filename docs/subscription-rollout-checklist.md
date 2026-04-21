# Rollout de suscripciones

## 1. Aplicar migraciones

Ejecutar en orden:

1. `001_create_subscriptions.sql`
2. `002_update_subscriptions_for_pending_checkout.sql`

## 2. Verificar datos existentes

Ejecutar `docs/subscription-rollout-checks.sql` en Supabase SQL Editor.

Objetivos:

- Confirmar que el enum `subscription_status` ya incluye `pending`.
- Confirmar que el enum `subscription_plan` ya incluye `starter`.
- Detectar negocios con más de una suscripción efectiva al mismo tiempo.
- Detectar filas heredadas del bug anterior donde una suscripción pudo quedar activa sin pago conciliado.

## 3. Corregir datos heredados si aparecen

Si el SQL reporta filas sospechosas:

- Revisar primero el negocio afectado y el último pago en dLocal.
- Si el checkout nunca se pagó, mover esa fila a `canceled`.
- Si el checkout sí se pagó pero no concilió, completar `dlocal_payment_id`, `current_period_start`, `current_period_end` y dejar `status = active`.
- Si quedó trial activo junto con una suscripción paga confirmada, limpiar `businesses.trial_ends_at`.

## 4. Probar flujo completo

1. Crear cuenta nueva.
2. Confirmar que `business.plan = starter` y que la UI muestre `Trial Pro`.
3. Iniciar checkout de un plan.
4. Confirmar que la UI muestre `Pago en confirmación` y que el plan actual no cambie.
5. Confirmar webhook `PAID`.
6. Verificar que:
   - `subscriptions.status = active`
   - `businesses.plan = plan pagado`
   - `businesses.trial_ends_at = null`
   - la UI muestre un solo plan efectivo

## 5. Casos para smoke test

- Trial activo sin suscripción.
- Checkout iniciado y cancelado.
- Checkout iniciado y pagado.
- Cambio de `pro` a `starter`.
- Pago fallido sobre suscripción ya activa.
