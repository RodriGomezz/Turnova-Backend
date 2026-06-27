# Patch: soporte de múltiples servicios por reserva (Fases 1-3 del backend)

Implementa la base de backend para que una reserva pueda tener varios
servicios/productos (Fases 1, 2 y 3 del plan acordado). El frontend
NO se toca en este patch — el endpoint público sigue aceptando
`service_id` singular además del nuevo `service_ids`, así que el
frontend actual sigue funcionando sin cambios.

## Verificación realizada

Se compiló este patch aplicado sobre una copia completa del backend
real (`npx tsc --noEmit`) para confirmar que no rompe nada existente.
Resultado: 0 errores nuevos. Los errores preexistentes que aparecen al
compilar (módulos npm no instalados en el entorno de verificación,
y dos bugs de tipos preexistentes en `ModifyBookingUseCase.ts` y
`subscription.schema.ts` que no se tocaron en este patch) no están
relacionados con este cambio.

Adicionalmente se ejecutó `server.ts` de verdad con `ts-node` (no solo
`tsc --noEmit`), porque un error de arranque reportado reveló que
`tsc --noEmit` solo no alcanza: `ts-node` falla en runtime ante el mismo
error de tipos que `tsc` reporta, y lo hace con un mensaje confuso
("undefined" sin traza) en vez de loguear el error real. Esto encontró
un segundo lugar donde se instanciaba `CreateBusinessUseCase` que la
primera verificación no había detectado porque solo se grepeaba contra
`container.ts` — ver `AuthController.ts` en la lista de archivos.

Una segunda ronda de arranque siguió fallando con el mismo síntoma.
La causa esta vez: volver `Booking.service_id` opcional (necesario para
marcarlo como deprecado durante la transición) rompió un uso preexistente
en `ModifyBookingUseCase.ts` que yo había visto en la verificación inicial
pero descarté incorrectamente como "error preexistente" sin comprobarlo
contra el original — fue un error de proceso, no solo de código. Esta vez
se comparó con `diff` exhaustivo el listado completo de errores de `tsc`
entre el backend original (sin patch) y el backend con el patch aplicado
y corregido: son idénticos (un único error preexistente en
`subscription.schema.ts`, no tocado por este patch, en ambos casos).

## Qué incluye

**Migraciones SQL** (correr en orden, contra Supabase/Postgres):
- `008_create_booking_items_and_tickets.sql` — tablas nuevas, aditivo, sin riesgo.
- `009_backfill_booking_items_and_tickets.sql` — migra datos existentes.
- `010_create_booking_with_items_rpc.sql` — función transaccional de creación.
- `011_replace_booking_items_rpc.sql` — función transaccional para reemplazar el combo de una reserva existente (usada por `ModifyBookingUseCase` al editar servicios antes de que el turno empiece).

**Backend (TypeScript)** — copiar manteniendo la estructura de carpetas,
sobrescribiendo los archivos existentes y agregando los nuevos:
- `domain/entities/Booking.ts` — agrega `BookingItem`, `BookingTicket`; `service_id` pasa a opcional y deprecado.
- `domain/entities/Service.ts` — agrega `es_generico`.
- `domain/interfaces/IBookingRepository.ts` — agrega `createWithItems`, `findItemsByBookingId`.
- `domain/interfaces/IBookingItemRepository.ts` — nueva.
- `domain/interfaces/IBookingTicketRepository.ts` — nueva.
- `domain/interfaces/IServiceRepository.ts` — agrega `findByIds`, `findGenerico`.
- `infrastructure/database/BookingRepository.ts` — implementa lo nuevo, no rompe lo existente.
- `infrastructure/database/BookingItemRepository.ts` — nueva.
- `infrastructure/database/BookingTicketRepository.ts` — nueva.
- `infrastructure/database/ServiceRepository.ts` — implementa lo nuevo.
- `application/bookings/CreateBookingUseCase.ts` — `service_id` → `items[]`.
- `application/bookings/AddBookingItemUseCase.ts` — nueva: agregar servicio/producto in-situ.
- `application/businesses/CreateBusinessUseCase.ts` — crea el servicio genérico al alta.
- `application/services/CreateServiceUseCase.ts` — fix de tipos (`es_generico: false` explícito).
- `presentation/controllers/AuthController.ts` — fix: este controller instancia su propio `CreateBusinessUseCase` (no usa el composition root de `container.ts`), y necesitaba el tercer argumento (`ServiceRepository`) igual que `container.ts`. Sin este archivo, el backend no arranca — `ts-node` falla al type-check todo el árbol de imports.
- `application/bookings/ModifyBookingUseCase.ts` — fix: al volver `Booking.service_id` opcional, esta línea preexistente (`input.serviceId ?? booking.service_id`) dejó de tipar correctamente. Se agrega un fallback explícito a `booking_items[0].service_id` para el caso de reservas creadas vía multi-servicio.
- `presentation/controllers/StatsController.ts` — fix de lógica (no de tipos): el agrupamiento "servicio más solicitado" usaba `b.service_id` como clave de objeto sin chequear `undefined`. No rompía la compilación, pero agrupaba mal en runtime (todas las reservas multi-servicio bajo la clave literal `"undefined"`). Ahora se omiten de ese agrupamiento — centralizar el cálculo sobre `booking_items` queda como pendiente (ver más abajo).
- `presentation/schemas/booking.schema.ts` — acepta `service_id` y `service_ids`.
- `presentation/controllers/BookingController.ts` — `createPanel`/`createPublic` multi-servicio; nuevos `addItem`, `listItems`, `cerrarCuenta`; `modifyBooking` acepta `service_ids` opcional.
- `presentation/routes/booking.routes.ts` — nuevas rutas; oculta el servicio genérico de la página pública.
- `container.ts` — registra los nuevos repos/use cases; inyecta `serviceRepository` en `ModifyBookingUseCase`.
- `domain/booking-pricing.ts` — nueva: helpers centralizados (`sumPrecioItems`, `sumDuracionItems`) para no triplicar el cálculo de ingresos/duración sobre `booking_items`.
- `application/bookings/GetDaySummaryUseCase.ts` — `ingresoDia` e `ingreso` por barbero ahora leen `booking_items` (precio snapshot) en vez de `services` (precio actual, mutaba reportes históricos). `calcularOcupacion` y `calcularPrimerTurnoLibre` usan la duración real de cada reserva en vez de un slot fijo de 30 min — antes un combo largo contaba como "1 turno" igual que un corte corto, subestimando la ocupación real.
- `presentation/controllers/StatsController.ts` — `ingresosMes`/`ingresosPrev` leen `booking_items`. "Servicio más solicitado" ahora cuenta por ítem, no por reserva (una reserva con 2 servicios suma 1 a cada uno, no 1 al combo) — esta es una decisión de producto, no solo técnica, márquenmela si prefieren la interpretación anterior.
- `migrations/011_replace_booking_items_rpc.sql` — nueva función transaccional para reemplazar el combo completo de una reserva (usada por `ModifyBookingUseCase`).
- `application/bookings/ModifyBookingUseCase.ts` — acepta `serviceIds?: string[]` opcional: si se pasa, reemplaza el combo completo de la reserva (vía `replaceItems`) y recalcula `hora_fin` antes de verificar colisión. Solo válido para reservas que todavía no empezaron — para agregar un servicio a una reserva en curso o pasada, usar `AddBookingItemUseCase`.

## Pasos para aplicar

1. Correr las 3 migraciones SQL en Supabase, en orden.
2. Copiar los archivos `.ts` sobre el repo del backend (mismas rutas relativas a `src/`).
3. Verificar que el negocio de prueba tenga su servicio "Otros / Varios"
   (lo crea el backfill de la migración 009 para negocios existentes).
4. Correr `npm run build` / `tsc` del proyecto real para confirmar
   contra las dependencias completas (este patch se verificó con un
   subconjunto de tipos, no con el `package.json` real del proyecto,
   que no estaba incluido en el zip).
5. Deploy. El frontend actual sigue funcionando sin cambios (manda
   `service_id` singular, que el backend sigue aceptando).

## Decisiones que tomé y quiero que confirmes

- **Servicio genérico oculto en la página pública**: agregué
  `.eq('es_generico', false)` al query de servicios públicos en
  `booking.routes.ts`, para que "Otros / Varios" no aparezca como
  opción elegible por el cliente al reservar online. Si prefieren
  que sí aparezca (por ejemplo, para que el cliente pueda reservar
  un genérico "consulta"), es una línea para sacar.
- **`modify()` reutilizado dentro de `AddBookingItemUseCase`** para
  extender `hora_fin`: usa el método existente de `IBookingRepository`,
  que ya tiene la verificación de colisión duplicada que se documentó
  en la sesión de diseño. No se tocó esa lógica.
- **`findGenerico` lanza error 500 si no existe**: decisión deliberada
  para que un negocio sin servicio genérico (por ejemplo, si la
  migración 009 no corrió) falle de forma ruidosa en vez de silenciosa.

## Lo que falta (fuera de alcance de este patch)

- Frontend: wizard multi-select (Fase 4), panel con UI de "agregar a
  la cuenta" y botón de cerrar cuenta (Fase 5), actualización de
  `stats.ts`/`bookings.ts`/`dashboard.ts` que hoy leen `booking.services?.nombre`.
- Migración 6 (limpieza de `bookings.service_id`): recién cuando se
  confirme que ningún consumidor lo sigue leyendo.

Ya resuelto en esta ronda (antes figuraba como pendiente):
reportes de ingresos centralizados sobre `booking_items`
(`StatsController`, `GetDaySummaryUseCase`); ocupación y "próximo turno
libre" usando duración real en vez de slot fijo de 30 min; endpoint de
reemplazo de combo completo en `ModifyBookingUseCase`.
