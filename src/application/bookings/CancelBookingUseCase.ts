import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { IBookingItemRepository } from "../../domain/interfaces/IBookingItemRepository";
import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";
import { IEmailService } from "../ports/IEmailService";
import { Booking } from "../../domain/entities/Booking";
import { AppError, NotFoundError } from "../../domain/errors";
import { invalidateSlotsCache } from "../../infrastructure/cache/slots.cache";
import { logger } from "../../infrastructure/logger";

export interface CancelBookingInput {
  bookingId:  string;
  businessId: string;
  reason?:    string;
}

export class CancelBookingUseCase {
  constructor(
    private readonly bookingRepository: IBookingRepository,
    private readonly bookingItemRepository: IBookingItemRepository,
    private readonly businessRepository: IBusinessRepository,
    private readonly barberRepository: IBarberRepository,
    private readonly emailService: IEmailService,
  ) {}

  async execute(input: CancelBookingInput): Promise<Booking> {
    const booking = await this.bookingRepository.findById(input.bookingId);

    if (!booking) throw new NotFoundError("Reserva");
    if (booking.business_id !== input.businessId) throw new AppError("Sin acceso", 403);
    if (booking.estado === "cancelada") {
      throw new AppError("La reserva ya está cancelada", 400);
    }

    const updated = await this.bookingRepository.cancel(input.bookingId, {
      cancelled_at:  new Date().toISOString(),
      cancel_reason: input.reason ?? null,
    });

    invalidateSlotsCache(input.businessId);

    logger.info("Reserva cancelada", {
      bookingId:  input.bookingId,
      businessId: input.businessId,
      reason:     input.reason ?? null,
    });

    // El aviso al cliente no debe hacer fallar la cancelación si falla el
    // envío del email (ej: Resend caído) — la reserva ya está cancelada en
    // base, eso es lo que importa. Se loguea el error para poder reintentar
    // manualmente si hace falta.
    this.notifyClient(updated).catch((err) => {
      logger.error("Error enviando email de cancelación al cliente", {
        bookingId: input.bookingId,
        error: err instanceof Error ? err.message : err,
      });
    });

    return updated;
  }

  private async notifyClient(booking: Booking): Promise<void> {
    const [business, barber, items] = await Promise.all([
      this.businessRepository.findById(booking.business_id),
      this.barberRepository.findById(booking.barber_id),
      this.bookingItemRepository.findByBookingId(booking.id),
    ]);

    if (!business) {
      logger.warn("No se pudo enviar email de cancelación: negocio no encontrado", {
        bookingId: booking.id,
        businessId: booking.business_id,
      });
      return;
    }

    const servicioNombre = items.length > 0
      ? items.map((i) => i.nombre).join(" + ")
      : "Servicio";

    await this.emailService.sendBookingCancellation({
      to: booking.cliente_email,
      clienteNombre: booking.cliente_nombre,
      negocioNombre: business.nombre,
      servicioNombre,
      barberoNombre: barber?.nombre ?? "",
      fecha: booking.fecha,
      horaInicio: booking.hora_inicio.slice(0, 5),
      reason: booking.cancel_reason ?? undefined,
    });
  }
}
