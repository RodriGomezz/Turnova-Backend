import { BookingRepository } from "../../infrastructure/database/BookingRepository";
import { GetAvailableSlotsUseCase } from "./GetAvailableSlotsUseCase";
import { Booking } from "../../domain/entities/Booking";
import { ConflictError } from "../../domain/errors";

interface CreateBookingInput {
  business_id: string;
  barber_id: string;
  service_id: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
  buffer_minutos: number;
  auto_confirmar: boolean;
}

export class CreateBookingUseCase {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly getAvailableSlotsUseCase: GetAvailableSlotsUseCase,
  ) {}

  async execute(input: CreateBookingInput): Promise<Booking> {
    const slots = await this.getAvailableSlotsUseCase.execute({
      barberId: input.barber_id,
      businessId: input.business_id,
      fecha: input.fecha,
      duracionMinutos: input.duracion_minutos,
      bufferMinutos: input.buffer_minutos,
    });

    const slotDisponible = slots.find(
      (s) => s.hora_inicio === input.hora_inicio && s.disponible,
    );

    if (!slotDisponible) {
      throw new ConflictError(
        `El horario ${input.hora_inicio} del ${input.fecha} ya no está disponible`,
      );
    }

    return this.bookingRepository.create({
      business_id: input.business_id,
      barber_id: input.barber_id,
      service_id: input.service_id,
      cliente_nombre: input.cliente_nombre,
      cliente_email: input.cliente_email,
      cliente_telefono: input.cliente_telefono,
      fecha: input.fecha,
      hora_inicio: input.hora_inicio,
      hora_fin: input.hora_fin,
      estado: input.auto_confirmar ? "confirmada" : "pendiente",
    });
  }
}
