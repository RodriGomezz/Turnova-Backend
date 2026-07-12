import { BookingRepository } from "../database/BookingRepository";
import { BookingItemRepository } from "../database/BookingItemRepository";
import { BusinessRepository } from "../database/BusinessRepository";
import { BarberRepository } from "../database/BarberRepository";
import { EmailService } from "../../application/email/email.service";
import { logger } from "../logger";

// Cada 1 hora es suficiente: findPendingReminders() sólo trae turnos de
// "mañana" (fecha calendario) sin reminder_sent_at, así que no hay riesgo
// de mandar duplicados aunque el job corra varias veces en el día — el
// primero que encuentra el turno lo marca y los siguientes lo saltean.
const INTERVAL_MS = 60 * 60 * 1000; // 1 hora

const bookingRepository = new BookingRepository();
const bookingItemRepository = new BookingItemRepository();
const businessRepository = new BusinessRepository();
const barberRepository = new BarberRepository();
const emailService = new EmailService();

export async function sendPendingReminders(): Promise<void> {
  const pendientes = await bookingRepository.findPendingReminders();
  if (pendientes.length === 0) return;

  logger.info(`Job de recordatorios: ${pendientes.length} turno(s) pendiente(s)`);

  for (const booking of pendientes) {
    try {
      const [business, barber, items] = await Promise.all([
        businessRepository.findById(booking.business_id),
        barberRepository.findById(booking.barber_id),
        bookingItemRepository.findByBookingId(booking.id),
      ]);

      if (!business) {
        logger.warn("Recordatorio omitido: negocio no encontrado", {
          bookingId: booking.id,
          businessId: booking.business_id,
        });
        continue;
      }

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
      });

      await bookingRepository.markReminderSent(booking.id);

      logger.info("Recordatorio enviado", { bookingId: booking.id, to: booking.cliente_email });
    } catch (err) {
      // Un turno que falla no debe frenar el resto del lote.
      logger.error("Error enviando recordatorio", {
        bookingId: booking.id,
        error: err instanceof Error ? err.message : err,
      });
    }
  }
}

export function startBookingReminderJob(): void {
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
