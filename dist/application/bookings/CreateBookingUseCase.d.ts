import { IBookingRepository } from "../../domain/interfaces/IBookingRepository";
import { Booking } from "../../domain/entities/Booking";
import { GetAvailableSlotsUseCase } from "./GetAvailableSlotsUseCase";
export interface CreateBookingInput {
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
export declare class CreateBookingUseCase {
    private readonly bookingRepository;
    private readonly getAvailableSlotsUseCase;
    constructor(bookingRepository: IBookingRepository, getAvailableSlotsUseCase: GetAvailableSlotsUseCase);
    execute(input: CreateBookingInput): Promise<Booking>;
}
//# sourceMappingURL=CreateBookingUseCase.d.ts.map