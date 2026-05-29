import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
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

    return updated;
  }
}