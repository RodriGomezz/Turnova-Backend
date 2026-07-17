# Patch: tiempo de procesamiento + capacidad de sillas (backend)

Implementa el núcleo de backend para que un barbero con más de una silla
pueda atender a un segundo cliente durante el hueco de "procesamiento" de
un servicio (ej. color fraguando), estilo Fresha/Booksy Processing Time.
Cubre **crear turnos y calcular disponibilidad**. Frontend NO se toca en
este patch (según lo acordado) — tampoco se tocan `AddBookingItemUseCase`
ni `ModifyBookingUseCase` (ver "Qué queda pendiente").

## ✅ Constraint verificado contra la instancia real

Ya confirmamos el nombre y la forma exacta de `bookings_no_overlap` contra
producción — la migración 016 está corregida y actualizada para reflejarlo
(el original también incluye `fecha WITH =`, que yo no había contemplado
en la primera versión). No hace falta correr el `SELECT` de verificación
de nuevo, ya está resuelto.

## 🐛 Tres bugs reales encontrados después de la entrega original

Revisando a fondo antes de que corrieras las migraciones, encontré tres
problemas de la misma familia — todos sobre **bloques activos que quedan
huérfanos** (apuntando a un horario/barbero que ya no es válido), lo que
generaría conflictos fantasma más adelante (una fecha/hora que debería
estar libre, pero la base de datos la sigue considerando ocupada):

1. **El constraint nuevo no incluía `fecha WITH =`** (ver arriba) — ya corregido.
2. **Cancelar una reserva no limpiaba `booking_active_blocks`.** Un
   `EXCLUDE` constraint no puede mirar columnas de otra tabla en su
   `WHERE`, así que aunque `bookings_no_overlap_por_silla` sí se relaja
   correctamente al cancelar (tiene `WHERE estado <> 'cancelada'`),
   `booking_active_blocks_no_overlap` no tenía forma de saber que la
   reserva dueña de esos bloques ya estaba cancelada. Resultado: cancelar
   un turno y después intentar reservar exactamente ese mismo horario con
   el mismo barbero fallaba con un conflicto que no debería existir —
   **esto afectaba a todo barbero**, no solo a los de más de una silla,
   porque los bloques activos se generan siempre. Arreglado en
   `BookingRepository.cancel()`: ahora borra los bloques activos de la
   reserva al cancelarla.
3. **El backfill de la migración 016 no excluía reservas ya canceladas.**
   Directamente relacionado con el punto anterior: si dos turnos
   cancelados alguna vez se superpusieron para el mismo barbero (muy
   probable en cualquier historial real), el `INSERT` masivo del backfill
   iba a chocar contra `booking_active_blocks_no_overlap` **y la migración
   completa iba a fallar al correrla**. Ya está corregido con un filtro
   `WHERE estado <> 'cancelada'` en el backfill.
4. **Reprogramar un turno (cambiar fecha/hora/barbero) sin tocar el combo
   de servicios nunca regeneraba los bloques activos.** `ModifyBookingUseCase`
   solo llamaba a `replaceItems` (que regenera bloques) cuando se
   reemplazaban los servicios — si solo cambiabas el horario, los bloques
   quedaban apuntando al horario y barbero **viejos**. Mismo síntoma que
   el punto 2: conflictos fantasma al reservar el horario que debería
   haber quedado libre. Arreglado con una pieza nueva:
   `regenerate_active_blocks(booking_id)` (migración 018) — una función
   que relee los `booking_items` ya guardados de la reserva (con su orden
   y fases) y regenera sus bloques activos anclados al horario actual.
   `ModifyBookingUseCase` ahora llama a `modify()` primero (para que el
   horario nuevo ya esté confirmado en la fila) y después, si no se
   reemplazaron servicios pero sí cambió fecha/hora/barbero, llama a esta
   función nueva.

Los cuatro son el mismo tipo de error de diseño (generar un recurso
derivado — el bloque activo — sin un plan claro de cuándo invalidarlo), así
que si en algún momento agregás otra operación que toque fecha/hora/barbero/
servicios de una reserva existente, vale la pena preguntarse de entrada:
"¿esto deja algún booking_active_blocks huérfano?".

## Verificación realizada (actualizada)

El usuario corrió `npx tsc --noEmit` en el repo real completo (con
`package.json`/`tsconfig` que yo no tenía) — **compila limpio**, sin
errores. Esto ya reemplaza la verificación manual que había hecho antes;
ya no queda pendiente correrlo.

## Qué incluye

**Migraciones SQL** (correr en orden, contra Supabase/Postgres):
- `015_add_processing_time_and_chair_capacity.sql` — columnas aditivas,
  sin riesgo, sin cambio de comportamiento para nadie.
- `016_chair_aware_exclusion_and_active_blocks.sql` — el cambio real:
  reemplaza el EXCLUDE de `bookings` por uno consciente de silla (ya
  verificado contra tu instancia — incluye `fecha WITH =` como el
  original), agrega `booking_active_blocks` (con su propio EXCLUDE) para
  proteger la atención activa del barbero, y reescribe
  `create_booking_with_items` para elegir silla automáticamente y generar
  los bloques activos. El backfill excluye reservas canceladas (si no,
  la migración podía fallar al correrla).
- `017_replace_booking_items_active_blocks.sql` — `replace_booking_items`
  (usada por `ModifyBookingUseCase` al cambiar el combo de una reserva)
  también regenera `booking_active_blocks`.
- `018_regenerate_active_blocks_function.sql` — **nuevo**.
  `regenerate_active_blocks(booking_id)`, usada al reprogramar una
  reserva sin cambiar sus servicios (ver hallazgo #4 arriba).

**Backend (TypeScript)** — mismas rutas relativas a `src/`:
- `domain/entities/Service.ts` — agrega `tiempo_activo_inicial_minutos`,
  `tiempo_procesamiento_minutos`.
- `domain/entities/Barber.ts` — agrega `capacidad_sillas`.
- `domain/entities/Booking.ts` — `BookingItem` agrega `orden` y snapshot
  de las fases.
- `domain/booking-scheduling.ts` — **nuevo**. Helper puro
  (`computeActiveBlocks`, `activeBlocksCollide`) que calcula los huecos de
  atención activa de una reserva. Espejo en TS de la lógica SQL de la
  migración 016 — si una cambia, la otra tiene que cambiar igual (nota en
  el propio archivo).
- `domain/interfaces/IBookingRepository.ts` — `CreateBookingItemInput`
  agrega `orden` (requerido) y fases (opcionales); nuevo método
  `findActiveBlocksByBarberAndDate`.
- `infrastructure/database/BookingRepository.ts` — implementa el método nuevo.
- `application/bookings/GetAvailableSlotsUseCase.ts` — **reescrito**.
  Camino rápido sin cambios para `capacidad_sillas <= 1` (el 100% de los
  negocios hoy); camino nuevo (silla + bloques activos) solo si el barbero
  tiene `capacidad_sillas > 1`.
- `application/bookings/CreateBookingUseCase.ts` — pasa los items con sus
  fases a la re-verificación de disponibilidad antes de crear.
- `application/barbers/CreateBarberUseCase.ts` — acepta `capacidad_sillas` opcional.
- `application/services/CreateServiceUseCase.ts` — acepta y valida las
  fases de procesamiento (no pueden superar `duracion_minutos`).
- `application/businesses/CreateBusinessUseCase.ts` — el servicio genérico
  ahora setea explícitamente las fases (decorativas, igual que `duracion_minutos = 1`).
- `presentation/schemas/barber.schema.ts` / `service.schema.ts` — exponen
  los campos nuevos en la API, con la misma validación de rango.
- `presentation/controllers/BookingController.ts` — pasa `orden` y fases
  al armar los items (2 lugares: turno de panel y turno público).
- `container.ts` — inyecta `barberRepository` en `GetAvailableSlotsUseCase`.
- `tests/booking-scheduling.test.ts` — **nuevo**, 7 casos, corridos de verdad.
- `tests/booking-controller.test.ts` — actualizado para el nuevo shape del item.
- `migrations/017_replace_booking_items_active_blocks.sql` — **nuevo**.
  `replace_booking_items` ahora regenera `booking_active_blocks`.
- `domain/interfaces/IBookingItemRepository.ts` — `CreateBookingItemData`
  agrega `orden`/fases opcionales.
- `domain/interfaces/IBookingRepository.ts` — `findActiveBlocksByBarberAndDate`
  ahora acepta `excludeBookingId`; nuevo método `createActiveBlocks`.
- `infrastructure/database/BookingRepository.ts` — implementa `createActiveBlocks`
  y el filtro `excludeBookingId`.
- `application/bookings/AddBookingItemUseCase.ts` — al lograr extender la
  agenda, ahora también inserta los bloques activos del item nuevo.
- `application/bookings/ModifyBookingUseCase.ts` — inyecta `IBarberRepository`;
  su chequeo de colisión propio ahora es consciente de `capacidad_sillas`
  (antes asumía 1 silla a fuego, lo que hubiera bloqueado modificaciones
  válidas para un barbero con más de una); `replaceItems` manda `orden` y fases.
- `container.ts` — inyecta `barberRepository` también en `ModifyBookingUseCase`.
- `infrastructure/database/BookingRepository.ts` — `cancel()` ahora también
  borra los bloques activos de la reserva cancelada (hallazgo #2);
  implementa `regenerateActiveBlocks()` (hallazgo #4).
- `application/bookings/ModifyBookingUseCase.ts` — reordenado: `modify()`
  corre antes que `replaceItems`, y se agrega la llamada a
  `regenerateActiveBlocks()` cuando se reprograma sin reemplazar
  servicios (hallazgo #4).

## Qué queda pendiente (a propósito, no por descuido)

1. ~~`AddBookingItemUseCase` y `ModifyBookingUseCase` no tocan
   `booking_active_blocks`~~ **Cerrado en este mismo patch** (ver
   migración 017 y los cambios en ambos use cases). `ModifyBookingUseCase`
   tenía además su propio chequeo de colisión de rango completo,
   independiente del de `GetAvailableSlotsUseCase` — sin corregirlo, un
   barbero con `capacidad_sillas > 1` hubiera quedado con reservas que no
   se pueden modificar aunque el nuevo horario fuera válido. Ya está
   arreglado (mismo criterio: camino rápido sin cambios si
   `capacidad_sillas <= 1`, camino nuevo si no). Nota menor: en
   `AddBookingItemUseCase`, si la extensión de agenda falla por colisión
   real (`agendaExtendida: false`), el item se registra igual pero sin
   `orden` explícito ni bloque activo — coherente con el diseño existente
   ("la venta nunca se pierde"), pero ese item específico no queda
   protegido en la agenda, ni falta que lo esté porque no hay agenda que
   proteger en ese caso.
2. **`GetAvailableDaysUseCase` / `GetAllSlotsForDaysUseCase`** tienen su
   propio cálculo de ocupación (no reutilizan `GetAvailableSlotsUseCase`)
   y no los toqué — revisar si el calendario mensual necesita el mismo
   tratamiento antes de mostrar días como "completos" incorrectamente.
   (Nota: sí encontré y cerré el mismo problema en el endpoint de slots de
   un día puntual — `BookingController.getAvailableSlots` — que ya resolvía
   los servicios por ID pero no les pasaba las fases al use case; sin eso,
   el buscador de horarios de la página pública iba a subestimar la
   disponibilidad real de un combo con color/tinte para un barbero con
   `capacidad_sillas > 1`.)
3. **Reportes de ocupación** (`GetDaySummaryUseCase.calcularOcupacion`,
   `StatsController`) no contemplan capacidad_sillas > 1 — un barbero con
   2 sillas atendiendo en paralelo podría mostrar métricas raras (>100%
   de ocupación o similar). No es bloqueante para lanzar la feature, pero
   hay que revisarlo antes de que un dueño mire ese número y desconfíe.
4. **Frontend**: falta la UI para que el dueño configure
   `capacidad_sillas` (barbero) y las fases (servicio), y para que el
   flujo de reserva arme el combo con `orden` correcto. Próxima sesión.
5. Validación de zod: al hacer PATCH de un servicio actualizando *solo*
   `tiempo_procesamiento_minutos` sin mandar `duracion_minutos` en el
   mismo request, el chequeo de "no superar la duración" no se aplica
   (mismo patrón preexistente que el chequeo de `precio_hasta`/`precio`
   parcial). No es nuevo, pero ahora hay un segundo campo con la misma
   limitación.

## Cómo aplicar

1. Correr `SELECT conname...` de la advertencia de arriba y confirmarme el resultado.
2. Correr las 4 migraciones SQL en orden.
3. Copiar los archivos `.ts` sobre el repo real, mismas rutas relativas a `src/`.
4. Correr `npx tsc --noEmit` y `node --test` con el repo completo.
5. Probar en un negocio de prueba: subir `capacidad_sillas` a 2 en un
   barbero, configurar un servicio de color con
   `tiempo_activo_inicial_minutos: 20` y `tiempo_procesamiento_minutos: 50`,
   e intentar reservar un corte de 30 min empezando 20 min después del
   inicio del color — debería aparecer disponible.
