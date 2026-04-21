# Plan de remediacion: planes, trial, dominios y lanzamiento

## Objetivo

Evitar que la aplicacion mezcle trial, plan efectivo y checkout pendiente como si fueran el mismo estado, garantizar que el plan solo cambie despues de la confirmacion real del pago, y dejar lista la experiencia publica tanto por subdominio como por dominio personalizado.

## Plan

### 1. Backend

- [x] Crear suscripciones nuevas con `status = pending` al iniciar checkout.
- [x] No cambiar `business.plan` al iniciar checkout.
- [x] Cambiar `business.plan` unicamente cuando el webhook confirma el pago.
- [x] Limpiar `businesses.trial_ends_at` cuando una suscripcion paga queda activa.
- [x] Permitir reemplazar un checkout `pending` anterior por uno nuevo.
- [x] Mantener bloqueo si existe una suscripcion en `past_due` o `grace_period`.
- [x] Mejorar la conciliacion del webhook usando `order_id`, `payment_id` y fallback por negocio.
- [x] Aceptar formatos reales de webhook de dLocal (`id` o `payment_id`) y normalizar estados como `APPROVED`.
- [x] Exponer por API `activeSubscription` y `pendingSubscription`.
- [x] Soportar `starter` como plan valido de suscripcion.

### 2. Frontend

- [x] Separar visualmente:
  - plan actual
  - suscripcion activa
  - pago en confirmacion
- [x] Mostrar `Trial Pro` solo como efecto del trial, no como suscripcion paga.
- [x] Evitar que el trial marque `Pro` como plan activo bloqueante en la grilla.
- [x] No cambiar el plan actual mientras el checkout siga `pending`.
- [x] Permitir reintentar un pago pendiente desde la tarjeta del plan.
- [x] Refrescar estado de suscripcion y negocio al volver del checkout.
- [x] Hacer polling corto despues de `success=true` para esperar la confirmacion del webhook.
- [x] Permitir editar nombre, apellido y email del pagador antes de redirigir a dLocal.

### 3. Base de datos

- [x] Agregar `pending` al enum `subscription_status`.
- [x] Agregar `starter` al enum `subscription_plan`.
- [x] Permitir `current_period_start` y `current_period_end` nulos para checkouts no pagados.
- [x] Rehacer la vista `business_subscription` para priorizar estados efectivos sobre `pending`.
- [x] Documentar un SQL de verificacion post-migracion.

### 4. Rollout y verificacion

- [x] Documentar checklist de rollout.
- [x] Documentar SQL para detectar datos heredados del bug anterior.
- [x] Confirmar que el webhook funciona en una URL publica.
- [ ] Ejecutar el SQL de verificacion en produccion y revisar resultados.
- [ ] Revisar si quedaron suscripciones historicas en `pending` o `active` mal conciliadas por pruebas previas.
- [ ] Confirmar que `API_URL`, `FRONTEND_URL` y `DLOCAL_WEBHOOK_SECRET` esten correctamente configuradas en el entorno final.

### 5. Calidad

- [x] Agregar tests automaticos de la logica critica de suscripciones en backend:
  - trial activo
  - restriccion de dominios pagos
  - degradacion por `grace_period`
  - degradacion por `canceled`
- [x] Agregar tests automaticos de frontend para:
  - `SubscriptionService`
  - `BusinessStatusService`
  - `AuthService`
  - helpers de suscripcion
  - `Config`
  - `Dashboard`
  - comportamiento base de `SubdomainService`
- [x] Dejar `ng test` estable con `ChromeHeadless`.
- [x] Verificar compilacion de frontend y backend despues de los cambios.
- [ ] Hacer una prueba end-to-end documentada en sandbox y otra en el entorno final con pagos reales o de prueba.

### 6. Dominios personalizados y pagina publica

- [x] Restringir dominios personalizados a usuarios con planes pagos `pro` y `business`.
- [x] Validar duplicados de `custom_domain` correctamente en backend.
- [x] Mejorar errores de integracion con Vercel para identificar problemas de `project/team/token`.
- [x] Mostrar instrucciones DNS concretas en la UI:
  - tipo
  - host/nombre
  - valor/destino
  - fallback para `A 76.76.21.21`
  - pasos de configuracion para el usuario
- [x] Priorizar el dominio verificado como link publico compartible en `Config`.
- [x] Soportar dominio personalizado en rutas publicas del frontend:
  - home
  - booking
  - confirm
  - cancel
- [x] Mantener compatibilidad con subdominios tipo `labarberia.mi-pagina.com`.
- [ ] Probar manualmente en entorno publico un caso real completo:
  - alta de dominio
  - configuracion DNS
  - verificacion
  - acceso por dominio propio
  - acceso por subdominio original
  - confirmacion y cancelacion desde dominio personalizado

### 7. Preventa y landing principal

- [x] Mover la landing comercial anterior a la ruta `/landing`.
- [x] Usar la preventa como nueva portada principal en `/`.
- [x] Integrar la pagina de fundadores en `/fundadores` dentro del frontend Angular.
- [x] Conectar la pagina de fundadores al Apps Script real para contar registros y crear altas.
- [x] Parametrizar fecha de lanzamiento, cupos, conteo base y URL del formulario desde `environment`.
- [x] Agregar metadata SEO para `/` y `/fundadores` con `title`, `description`, `canonical`, Open Graph y Twitter cards.
- [ ] Agregar una imagen real para `og:image` y `twitter:image`.
- [ ] Instrumentar eventos de conversion en los CTA principales de preventa y fundadores.
- [ ] Validar en deploy final como se ve el preview al compartir `https://dominio.com/` y `https://dominio.com/fundadores`.

## Estado actual

El flujo principal ya quedo corregido:

- El usuario puede elegir un plan durante el trial sin que `Pro` quede marcado como suscripcion activa.
- El checkout crea `pending`.
- El plan no cambia hasta que entra el webhook.
- Al llegar el webhook correcto en una URL publica, la suscripcion pasa a `active` y el trial deja de mostrarse.
- Los dominios personalizados ya estan restringidos a planes pagos y muestran instrucciones DNS guiadas en la UI.
- La web publica ya soporta tanto subdominios tipo `labarberia.mi-pagina.com` como dominios personalizados tipo `labarberia.com`.
- `booking`, `confirm` y `cancel` tambien resuelven correctamente el negocio cuando se entra por dominio personalizado.
- El link publico compartible prioriza el dominio verificado cuando existe.
- La portada principal del dominio ahora puede ser la preventa, con captura de leads de fundadores y la landing comercial completa movida a `/landing`.
- La cobertura automatica ya incluye backend, servicios criticos de frontend y componentes clave como `Config` y `Dashboard`.

## Pendientes recomendados

1. Ejecutar `subscription-rollout-checks.sql` sobre la base que va a quedar operativa.
2. Limpiar cualquier dato de pruebas locales que haya quedado en `pending`.
3. Configurar y validar definitivamente las variables de entorno de dLocal, del backend publico y del frontend.
4. Hacer una prueba manual end-to-end en entorno publico del flujo completo de dominio personalizado y de suscripcion.
5. Definir la imagen social y los eventos de conversion para la nueva preventa.
