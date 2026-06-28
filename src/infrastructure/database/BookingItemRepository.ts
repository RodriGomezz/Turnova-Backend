import { supabase } from "./supabase.client";
import { AppError } from "../../domain/errors";
import { BookingItem } from "../../domain/entities/Booking";
import {
  IBookingItemRepository,
  CreateBookingItemData,
} from "../../domain/interfaces/IBookingItemRepository";

export class BookingItemRepository implements IBookingItemRepository {
  private readonly table = "booking_items";

  async findByBookingId(bookingId: string): Promise<BookingItem[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return (data ?? []) as BookingItem[];
  }

  async findById(id: string): Promise<BookingItem | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500);
    return (data as BookingItem) ?? null;
  }

  async create(data: CreateBookingItemData): Promise<BookingItem> {
    const { data: created, error } = await supabase
      .from(this.table)
      .insert(data)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return created as BookingItem;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from(this.table).delete().eq("id", id);
    if (error) throw new AppError(error.message, 500);
  }
}
