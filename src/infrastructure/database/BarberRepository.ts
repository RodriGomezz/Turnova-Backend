import { supabase } from "./supabase.client";
import { Barber } from "../../domain/entities/Barber";
import { AppError } from "../../domain/errors";
import { IBarberRepository } from "../../domain/interfaces/IBarberRepository";

export class BarberRepository implements IBarberRepository {
  private readonly table = "barbers";

  async findById(id: string): Promise<Barber | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .single();

    if (error?.code === "PGRST116") return null;
    if (error) throw new AppError(error.message, 500);
    return data as Barber;
  }

async findByBusiness(businessId: string): Promise<Barber[]> {
  const { data, error } = await supabase
    .from(this.table)
    .select('*')
    .eq('business_id', businessId)
    .order('activo', { ascending: false })
    .order('orden', { ascending: true });


    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as Barber[];
  }

  async countByBusiness(businessId: string): Promise<number> {
    const { count, error } = await supabase
      .from(this.table)
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("activo", true);

    if (error) throw new AppError(error.message, 500);
    return count ?? 0;
  }

  async create(data: Partial<Barber>): Promise<Barber> {
    const { data: created, error } = await supabase
      .from(this.table)
      .insert(data)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return created as Barber;
  }

// BarberRepository.ts

async update(id: string, businessId: string, data: Partial<Barber>): Promise<Barber> {
  if (Object.keys(data).length === 0) {
    throw new AppError('No se enviaron campos para actualizar', 400);
  }

  const { data: updated, error } = await supabase
    .from(this.table)
    .update(data)
    .eq('id', id)
    .eq('business_id', businessId)  // ← agregar esto
    .select()
    .single();

  if (error?.code === 'PGRST116') throw new AppError('Profesional no encontrado', 404);
  if (error) throw new AppError(error.message, 500);
  return updated as Barber;
}

async deactivate(id: string): Promise<void> {
  const { error } = await supabase
    .from(this.table)
    .update({ activo: false })
    .eq('id', id)
    .eq('activo', true); 

  if (error) throw new AppError(error.message, 500);
}

// BarberRepository.ts — agregar logs en hardDelete
async hardDelete(id: string): Promise<void> {
  // Paso 1: cancelar reservas futuras del barbero
  // No podemos nullificar barber_id (NOT NULL constraint)
  // Cancelamos las pendientes/confirmadas para liberar los slots
  const today = new Date().toISOString().split('T')[0];
  
  const { error: cancelError } = await supabase
    .from('bookings')
    .update({ estado: 'cancelada' })
    .eq('barber_id', id)
    .gte('fecha', today)
    .in('estado', ['pendiente', 'confirmada']);

  if (cancelError) throw new AppError(cancelError.message, 500);

  // Paso 2: eliminar schedules y blocked_dates propios del barbero
  const { error: schedError } = await supabase
    .from('schedules').delete().eq('barber_id', id);
  if (schedError) throw new AppError(schedError.message, 500);

  const { error: blockedError } = await supabase
    .from('blocked_dates').delete().eq('barber_id', id);
  if (blockedError) throw new AppError(blockedError.message, 500);

  // Paso 3: eliminar el barbero
  // Las reservas históricas quedan con barber_id apuntando a un barbero
  // eliminado — la FK debe ser ON DELETE SET NULL o ON DELETE CASCADE
  // Si la FK es RESTRICT, primero hay que eliminar todas las bookings
  const { error } = await supabase
    .from(this.table)
    .delete()
    .eq('id', id);

  if (error) throw new AppError(error.message, 500);
}
}
