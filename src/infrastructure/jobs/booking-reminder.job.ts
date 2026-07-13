import { BookingRepository } from "../database/BookingRepository";
import { BookingItemRepository } from "../database/BookingItemRepository";
import { BusinessRepository } from "../database/BusinessRepository";
import { BarberRepository } from "../database/BarberRepository";
import { EmailService } from "../../application/email/email.service";
import { Booking } from "../../domain/entities/Booking";
import { Business } from "../../domain/entities/Business";
import { logger } from "../logger";

// El job corre cada 15 minutos. Con recordatorio_horas_antes configurable
// por negocio (1-72hs), necesitamos chequear seguido para que el envío real
// quede razonablemente cerca del horario configurado — con un intervalo de
// 1 hora, un negocio que pide "2hs antes" podía recibir el recordatorio con
// hasta 1hs de atraso sobre lo pedido. Con 15 min el margen de error baja a
// eso mismo, 15 min, contra cualquier configuración.
const INTERVAL_MS = 15 * 60 * 1000;

// Ventana de búsqueda de candidatos: cubre el máximo configurable
// (72hs = 3 días) con un día de margen.
const MAX_DAYS_AHEAD = 4;

const bookingRepository = new BookingRepository();
const bookingItemRepository = new BookingItemRepository();
const businessRepository = new BusinessRepository();
const barberRepository = new BarberRepository();
const emailService = new EmailService();

const EXPECTED_TZ = "America/Montevideo";

function checkServerTimezone(): void {
  const actual = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (actual !== EXPECTED_TZ) {
    logger.warn(
      `ATENCIÓN: el server corre en zona horaria "${actual}", pero fecha/hora_inicio de ` +
      `las reservas se interpretan asumiendo "${EXPECTED_TZ}". Esto desalinea el cálculo de ` +
      `recordatorio_horas_antes (y probablemente otras fechas de la app). Seteá la variable ` +
      `de entorno TZ=${EXPECTED_TZ} en tu hosting.`,
    );
  }
}

function appointmentDateTime(booking: Booking): Date {
  // hora_inicio viene como "HH:mm:ss" o "HH:mm" — new Date() con formato
  // ISO-like "YYYY-MM-DDTHH:mm:ss" lo interpreta en la zona horaria local
  // del proceso. Es la misma asunción que ya usaba el resto del código
  // (ver formatFechaUY en el frontend) — no estamos peor que antes, pero
  // ojo si el server corre en una zona horaria distinta a la del negocio.
  return new Date(`${booking.fecha}T${booking.hora_inicio}`);
}

// Fecha local en formato YYYY-MM-DD, sin pasar por UTC (a diferencia de
// .toISOString(), que corre el día en Montevideo a partir de las 21:00).
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Diferencia en días de calendario entre "hoy" (el momento del envío) y la
// fecha del turno — ignora la hora del día a propósito, para que el texto
// del email diga "mañana" cuando el turno es al día calendario siguiente,
// sin importar si el recordatorio salió a las 8am o a las 11pm.
function diasHastaElTurno(booking: Booking, now: Date): number {
  const hoy = new Date(`${toLocalDateString(now)}T00:00:00`);
  const fechaTurno = new Date(`${booking.fecha}T00:00:00`);
  return Math.round((fechaTurno.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
}


export async function sendPendingReminders(): Promise<void> {
  const candidatos = await bookingRepository.findConfirmedUpcomingWithoutReminder(MAX_DAYS_AHEAD);
  if (candidatos.length === 0) return;

  const now = new Date();

  // Cachear negocios ya resueltos en este ciclo — varios turnos suelen ser
  // del mismo negocio, no tiene sentido pedirlo de nuevo por cada uno.
  const businessCache = new Map<string, Business | null>();
  const getBusiness = async (businessId: string): Promise<Business | null> => {
    if (!businessCache.has(businessId)) {
      businessCache.set(businessId, await businessRepository.findById(businessId));
    }
    return businessCache.get(businessId) ?? null;
  };

  let enviados = 0;

  for (const booking of candidatos) {
    try {
      const business = await getBusiness(booking.business_id);

      if (!business) {
        logger.warn("Recordatorio omitido: negocio no encontrado", {
          bookingId: booking.id,
          businessId: booking.business_id,
        });
        continue;
      }

      const apptTime = appointmentDateTime(booking);
      const horasAntes = business.recordatorio_horas_antes ?? 24;
      const dueAt = new Date(apptTime.getTime() - horasAntes * 60 * 60 * 1000);

      logger.debug("Evaluando candidato a recordatorio", {
        bookingId: booking.id,
        fecha: booking.fecha,
        horaInicio: booking.hora_inicio,
        apptTime: apptTime.toISOString(),
        dueAt: dueAt.toISOString(),
        now: now.toISOString(),
        horasAntes,
        serverTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      // El turno ya pasó y nunca se le mandó recordatorio (el negocio subió
      // el valor de recordatorio_horas_antes después de que ya era tarde,
      // o el turno se creó muy cerca de su propia hora). No tiene sentido
      // mandar un recordatorio de algo que ya ocurrió — se marca como
      // enviado igual para que no quede reprocesándose para siempre.
      if (apptTime.getTime() < now.getTime()) {
        await bookingRepository.markReminderSent(booking.id);
        continue;
      }

      if (now.getTime() < dueAt.getTime()) continue;

      const [barber, items] = await Promise.all([
        barberRepository.findById(booking.barber_id),
        bookingItemRepository.findByBookingId(booking.id),
      ]);

      const servicioNombre = items.length > 0
        ? items.map((i) => i.nombre).join(" + ")
        : "Servicio";

      await emailService.sendBookingReminder({
        to: booking.cliente_email,
        clienteNombre: booking.cliente_nombre,
        negocioNombre: business.nombre,
        servicioNombre,
        barberoNombre: barber?.nombre ?? "",
        fecha: booking.fecha,
        horaInicio: booking.hora_inicio.slice(0, 5),
        cancellationToken: booking.cancellation_token,
        slug: business.slug,
        direccion: business.direccion ?? undefined,
        whatsapp: business.whatsapp ?? undefined,
        diasFaltantes: diasHastaElTurno(booking, now),
        customDomain: business.custom_domain,
      });

      await bookingRepository.markReminderSent(booking.id);
      enviados++;

      logger.info("Recordatorio enviado", { bookingId: booking.id, to: booking.cliente_email });
    } catch (err) {
      // Un turno que falla no debe frenar el resto del lote.
      logger.error("Error enviando recordatorio", {
        bookingId: booking.id,
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  if (enviados > 0) {
    logger.info(`Job de recordatorios: ${enviados} enviado(s) de ${candidatos.length} candidato(s)`);
  }
}

export function startBookingReminderJob(): void {
  checkServerTimezone();
  logger.info(`Job de recordatorios de turnos iniciado (cada ${INTERVAL_MS / 1000 / 60} min)`);

  let isRunning = false;

  const run = (): void => {
    if (isRunning) {
      logger.warn("Job de recordatorios ya en ejecución — omitiendo ciclo");
      return;
    }
    isRunning = true;
    sendPendingReminders()
      .catch((err) => logger.error("Error en job de recordatorios", { err }))
      .finally(() => { isRunning = false; });
  };

  run();
  setInterval(run, INTERVAL_MS);
}
