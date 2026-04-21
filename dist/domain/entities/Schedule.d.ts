export interface Schedule {
    id: string;
    business_id: string;
    barber_id: string | null;
    dia_semana: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    hora_inicio: string;
    hora_fin: string;
    activo: boolean;
}
//# sourceMappingURL=Schedule.d.ts.map