export interface BlockedDate {
    id: string;
    business_id: string;
    barber_id: string | null;
    fecha: string;
    fecha_fin: string | null;
    motivo: string | null;
    created_at: string;
    barbers?: {
        nombre: string;
    } | null;
}
//# sourceMappingURL=BlockedDate.d.ts.map