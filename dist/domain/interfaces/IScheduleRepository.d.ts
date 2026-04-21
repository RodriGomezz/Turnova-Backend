import { Schedule } from "../entities/Schedule";
export interface IScheduleRepository {
    findById(id: string): Promise<Schedule | null>;
    findForBarber(businessId: string, barberId: string, diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6): Promise<Schedule | null>;
    /**
     * Retorna horarios resolviendo precedencia barbero > negocio por día.
     * Sin `barberId` devuelve solo los horarios del negocio.
     */
    findAllByBusiness(businessId: string, barberId?: string): Promise<Schedule[]>;
    create(data: Omit<Schedule, "id">): Promise<Schedule>;
    update(id: string, data: Partial<Schedule>): Promise<Schedule>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=IScheduleRepository.d.ts.map