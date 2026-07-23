import {
  IBookingRepository,
  CreateBookingItemInput,
} from "../../domain/interfaces/IBookingRepository";
import { Booking } from "../../domain/entities/Booking";
import { ConflictError } from "../../domain/errors";
import {
  GetAvailableSlotsUseCase,
  GetAvailableSlotsInput,
} from "./GetAvailableSlotsUseCase";
import { invalidateSlotsCache } from "../../infrastructure/cache/slots.cache";
import { logger } from "../../infrastructure/logger";

export interface CreateBookingInput {
  business_id: string;
  barber_id: string;
  /** Uno o más servicios de la reserva. duracion_minutos total = suma de items. */
  items: CreateBookingItemInput[];
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
  buffer_minutos: number;
  /** Ver comentario en GetAvailableSlotsInput.intervaloTurnosMinutos. */
  intervalo_turnos_minutos: number;
  auto_confirmar: boolean;
  /**
   * Ver comentario en bookings.idempotency_key (mig. 020). Opcional: si no
   * se manda, la reserva se crea sin protección de idempotencia, igual que
   * antes de esta migración.
   */
  idempotency_key?: string;
}

export interface CreateBookingResult {
  booking: Booking;
  /**
   * false cuando la reserva devuelta ya existía (reintento con la misma
   * idempotency_key) — el caller debe usar esto para NO reenviar el email
   * de confirmación ni invalidar cache de más.
   */
  isNewBooking: boolean;
}

export class CreateBookingUseCase {
  constructor(
    private readonly bookingRepository: IBookingRepository,
    private readonly getAvailableSlotsUseCase: GetAvailableSlotsUseCase,
  ) {}

  async execute(input: CreateBookingInput): Promise<CreateBookingResult> {
    // Chequeo de idempotencia ANTES del slot check: GetAvailableSlotsUseCase
    // lee bookings en vivo, así que en un reintento posterior al éxito del
    // primer intento vería el slot como ocupado (por la reserva que sí se
    // creó) y rechazaría el reintento con un falso "horario no disponible"
    // — hay que cortar acá, antes de llegar a esa consulta.
    if (input.idempotency_key) {
      const existing = await this.bookingRepository.findByIdempotencyKey(input.idempotency_key);
      if (existing) {
        logger.info("Reserva ya existía para esta idempotency_key — reintento detectado, no se crea de nuevo", {
          bookingId: existing.id,
          businessId: input.business_id,
        });
        return { booking: existing, isNewBooking: false };
      }
    }

    const slotsInput: GetAvailableSlotsInput = {
      barberId: input.barber_id,
      businessId: input.business_id,
      fecha: input.fecha,
      duracionMinutos: input.duracion_minutos,
      bufferMinutos: input.buffer_minutos,
      intervaloTurnosMinutos: input.intervalo_turnos_minutos,
      // Necesario para que el barbero con capacidad_sillas > 1 reciba el
      // mismo cálculo de huecos activos que ya vio el buscador de slots —
      // si no se pasa, GetAvailableSlotsUseCase asume un único bloque
      // activo de duracionMinutos completo (sin fases), que es correcto
      // para servicios sin tiempo de procesamiento pero subestimaría la
      // disponibilidad real de un combo con color + corte.
      items: input.items,
    };

    const slots = await this.getAvailableSlotsUseCase.execute(slotsInput);

    const slotDisponible = slots.find(
      (s) => s.hora_inicio === input.hora_inicio && s.disponible,
    );

    if (!slotDisponible) {
      logger.warn("Slot no disponible al crear reserva", {
        businessId: input.business_id,
        barberId: input.barber_id,
        fecha: input.fecha,
        horaInicio: input.hora_inicio,
      });
      throw new ConflictError(
        `El horario ${input.hora_inicio} del ${input.fecha} ya no está disponible`,
      );
    }

    const booking = await this.bookingRepository.createWithItems(
      {
        business_id: input.business_id,
        barber_id: input.barber_id,
        cliente_nombre: input.cliente_nombre,
        cliente_email: input.cliente_email,
        cliente_telefono: input.cliente_telefono,
        fecha: input.fecha,
        hora_inicio: input.hora_inicio,
        hora_fin: input.hora_fin,
        estado: input.auto_confirmar ? "confirmada" : "pendiente",
      },
      input.items,
      input.idempotency_key,
    );

    logger.info("Reserva creada", {
      bookingId:  booking.id,
      businessId: input.business_id,
      barberId:   input.barber_id,
      fecha:      input.fecha,
      horaInicio: input.hora_inicio,
      estado:     booking.estado,
      cantidadServicios: input.items.length,
    });

    // Invalidar cache de slots para que el próximo request refleje
    // la nueva reserva — evita que otro cliente vea el slot como disponible
    // durante el TTL del cache (2 min).
    invalidateSlotsCache(input.business_id);

    return { booking, isNewBooking: true };
  }
}
