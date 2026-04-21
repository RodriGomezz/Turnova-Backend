import { IBusinessRepository } from "../../domain/interfaces/IBusinessRepository";
import { IUserRepository } from "../../domain/interfaces/IUserRepository";
import { Business, BusinessPlan } from "../../domain/entities/Business";
export interface CreateBusinessInput {
    nombre: string;
    slug: string;
    userId: string;
    email: string;
    nombre_usuario?: string;
    tipo_negocio?: string;
    termino_profesional?: string;
    termino_profesional_plural?: string;
    termino_servicio?: string;
    termino_reserva?: string;
    /**
     * Si es `true`, el usuario ya existe en BD (caso sucursal).
     * Solo se actualiza su `business_id` activo.
     */
    existingUser?: boolean;
    plan?: BusinessPlan;
    /** `null` para sucursales (sin trial). `undefined` para calcular automáticamente. */
    trial_ends_at?: string | null;
}
export declare class CreateBusinessUseCase {
    private readonly businessRepository;
    private readonly userRepository;
    constructor(businessRepository: IBusinessRepository, userRepository: IUserRepository);
    execute(input: CreateBusinessInput): Promise<Business>;
    /**
     * Resuelve cuándo vence el trial:
     * - `null` explícito → sin trial (sucursales)
     * - `string` → fecha ya calculada por el caller
     * - `undefined` → calcular: hoy + TRIAL_DAYS
     */
    private resolveTrialEndsAt;
}
//# sourceMappingURL=CreateBusinessUseCase.d.ts.map