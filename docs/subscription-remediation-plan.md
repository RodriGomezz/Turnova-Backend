# Plan de remediación: planes, trial y suscripciones

## Objetivo

Evitar que la aplicación mezcle trial, plan efectivo y checkout pendiente como si fueran el mismo estado, y garantizar que el plan solo cambie después de la confirmación real del pago.

## Plan

### 1. Backend

- [x] Crear suscripciones nuevas con `status = pending` al iniciar checkout.
- [x] No cambiar `business.plan` al iniciar checkout.
- [x] Cambiar `business.plan` únicamente cuando el webhook confirma el pago.
- [x] Limpiar `businesses.trial_ends_at` cuando una suscripción paga queda activa.
- [x] Permitir reemplazar un checkout `pending` anterior por uno nuevo.
- [x] Mantener bloqueo si existe una suscripción en `past_due` o `grace_period`.
- [x] Mejorar la conciliación del webhook usando `order_id`, `payment_id` y fallback por negocio.
- [x] Aceptar formatos reales de webhook de dLocal (`id` o `payment_id`) y normalizar estados como `APPROVED`.
- [x] Exponer por API `activeSubscription` y `pendingSubscription`.
- [x] Soportar `starter` como plan válido de suscripción.

### 2. Frontend

- [x] Separar visualmente:
  - plan actual
  - suscripción activa
  - pago en confirmación
- [x] Mostrar `Trial Pro` solo como efecto del trial, no como suscripción paga.
- [x] Evitar que el trial marque `Pro` como plan activo bloqueante en la grilla.
- [x] No cambiar el plan actual mientras el checkout siga `pending`.
- [x] Permitir reintentar un pago pendiente desde la tarjeta del plan.
- [x] Refrescar estado de suscripción y negocio al volver del checkout.
- [x] Hacer polling corto después de `success=true` para esperar la confirmación del webhook.
- [x] Permitir editar nombre, apellido y email del pagador antes de redirigir a dLocal.

### 3. Base de datos

- [x] Agregar `pending` al enum `subscription_status`.
- [x] Agregar `starter` al enum `subscription_plan`.
- [x] Permitir `current_period_start` y `current_period_end` nulos para checkouts no pagados.
- [x] Rehacer la vista `business_subscription` para priorizar estados efectivos sobre `pending`.
- [x] Documentar un SQL de verificación post-migración.

### 4. Rollout y verificación

- [x] Documentar checklist de rollout.
- [x] Documentar SQL para detectar datos heredados del bug anterior.
- [x] Confirmar que el webhook funciona en una URL pública.
- [ ] Ejecutar el SQL de verificación en producción y revisar resultados.
- [ ] Revisar si quedaron suscripciones históricas en `pending` o `active` mal conciliadas por pruebas previas.
- [ ] Confirmar que `API_URL`, `FRONTEND_URL` y `DLOCAL_WEBHOOK_SECRET` estén correctamente configuradas en el entorno final.

### 5. Calidad

- [ ] Agregar tests automáticos del flujo:
  - cuenta nueva en trial
  - checkout `pending`
  - webhook que promueve a `active`
  - cambio de plan con suscripción previa
- [ ] Hacer una prueba end-to-end documentada en sandbox y otra en el entorno final.

### 6. Preventa y landing principal

- [x] Mover la landing comercial anterior a la ruta `/landing`.
- [x] Usar la preventa como nueva portada principal en `/`.
- [x] Integrar la página de fundadores en `/fundadores` dentro del frontend Angular.
- [x] Conectar la página de fundadores al Apps Script real para contar registros y crear altas.
- [x] Parametrizar fecha de lanzamiento, cupos, conteo base y URL del formulario desde `environment`.
- [x] Agregar metadata SEO para `/` y `/fundadores` con `title`, `description`, `canonical`, Open Graph y Twitter cards.
- [ ] Agregar una imagen real para `og:image` y `twitter:image`.
- [ ] Instrumentar eventos de conversión en los CTA principales de preventa y fundadores.
- [ ] Validar en deploy final cómo se ve el preview al compartir `https://dominio.com/` y `https://dominio.com/fundadores`.

## Estado actual

El flujo principal ya quedó corregido:

- El usuario puede elegir un plan durante el trial sin que `Pro` quede marcado como suscripción activa.
- El checkout crea `pending`.
- El plan no cambia hasta que entra el webhook.
- Al llegar el webhook correcto en una URL pública, la suscripción pasa a `active` y el trial deja de mostrarse.
- La portada principal del dominio ahora puede ser la preventa, con captura de leads de fundadores y la landing comercial completa movida a `/landing`.

## Pendientes recomendados

1. Ejecutar `subscription-rollout-checks.sql` sobre la base que va a quedar operativa.
2. Limpiar cualquier dato de pruebas locales que haya quedado en `pending`.
3. Configurar y validar definitivamente las variables de entorno de dLocal y del backend público.
4. Agregar tests para que este flujo no vuelva a romperse.
5. Definir la imagen social y los eventos de conversión para la nueva preventa.
