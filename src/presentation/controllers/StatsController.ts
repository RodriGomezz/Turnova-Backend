import { Request, Response, NextFunction } from "express";
import { supabase } from "../../infrastructure/database/supabase.client";
import { AppError } from "../../domain/errors";
import { UserBusinessAccessRepository } from "../../infrastructure/database/UserBusinessAccessRepository";
import { sumPrecioItems } from "../../domain/booking-pricing";

// Tipo local que refleja el shape del join bookings ⟶ booking_items.
// Supabase no puede inferir tipos en selects con string dinámico, así que
// casteamos explícitamente en lugar de usar `as any`.
interface BookingWithItems {
  id:                string;
  estado:            string;
  fecha:             string;
  hora_inicio:       string;
  barber_id:         string;
  cliente_email:     string;
  cliente_telefono:  string;
  booking_items:     { service_id: string; nombre: string; precio: number }[] | null;
}

interface PrevBookingWithItems {
  id:            string;
  estado:        string;
  booking_items: { precio: number }[] | null;
}

export class StatsController {
  private readonly userBusinessAccess = new UserBusinessAccessRepository();

  get = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const businessId = req.businessId!;
      const scope = req.query["scope"] === "network" ? "network" : "branch";
      const now = new Date();
      const year = parseInt(req.query["year"] as string) || now.getFullYear();
      const month =
        parseInt(req.query["month"] as string) || now.getMonth() + 1;
      const businesses = await this.userBusinessAccess.findByUser(req.userId!);
      const currentBusiness = businesses.find((business) => business.id === businessId);
      const canViewNetwork = !!currentBusiness?.esPrincipal && businesses.length > 1;
      const targetBusinessIds =
        scope === "network" && canViewNetwork
          ? businesses.filter((business) => business.activo).map((business) => business.id)
          : [businessId];
      const effectiveScope =
        scope === "network" && canViewNetwork ? "network" : "branch";

      const from = `${year}-${month.toString().padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${month.toString().padStart(2, "0")}-${lastDay}`;

      // Mes anterior para comparativas
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevFrom = `${prevYear}-${prevMonth.toString().padStart(2, "0")}-01`;
      const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
      const prevTo = `${prevYear}-${prevMonth.toString().padStart(2, "0")}-${prevLastDay}`;

      // Traer todos los turnos del mes actual y anterior en paralelo.
      // booking_items reemplaza el JOIN a services: nombre/precio son
      // snapshots tomados al crear la reserva, no el precio actual del
      // catálogo (evita que un cambio de precio mute reportes históricos).
      const [currentRes, prevRes] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id, estado, fecha, hora_inicio, barber_id, cliente_email, cliente_telefono, booking_items(service_id, nombre, precio)",
          )
          .in("business_id", targetBusinessIds)
          .gte("fecha", from)
          .lte("fecha", to),
        supabase
          .from("bookings")
          .select("id, estado, booking_items(precio)")
          .in("business_id", targetBusinessIds)
          .gte("fecha", prevFrom)
          .lte("fecha", prevTo)
          .neq("estado", "cancelada"),
      ]);

      if (currentRes.error) throw new AppError(currentRes.error.message, 500);
      if (prevRes.error) throw new AppError(prevRes.error.message, 500);

      const bookings     = (currentRes.data ?? []) as unknown as BookingWithItems[];
      const prevBookings = (prevRes.data   ?? []) as unknown as PrevBookingWithItems[];

      const activos = bookings.filter((b) => b.estado !== "cancelada");

      // ── Métricas base ──────────────────────────────────────────────────────
      const totalMes = bookings.length;
      const cancelados = bookings.filter(
        (b) => b.estado === "cancelada",
      ).length;
      const tasaCancelacion =
        totalMes > 0 ? Math.round((cancelados / totalMes) * 100) : 0;

      // ── Ingresos ───────────────────────────────────────────────────────────
      const ingresosMes = activos.reduce(
        (sum, b) => sum + sumPrecioItems(b.booking_items),
        0,
      );
      const ingresosPrev = prevBookings.reduce(
        (sum, b) => sum + sumPrecioItems(b.booking_items),
        0,
      );
      const ingresosVariacion =
        ingresosPrev > 0
          ? Math.round(((ingresosMes - ingresosPrev) / ingresosPrev) * 100)
          : null;

      // ── Turnos por día ─────────────────────────────────────────────────────
      const porDia: Record<string, number> = {};
      for (let d = 1; d <= lastDay; d++) {
        const key = `${year}-${month.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
        porDia[key] = 0;
      }
      for (const b of activos) {
        if (porDia[b.fecha] !== undefined) porDia[b.fecha]++;
      }

      // ── Profesional más solicitado ─────────────────────────────────────────
      const porBarbero: Record<string, number> = {};
      for (const b of activos) {
        porBarbero[b.barber_id] = (porBarbero[b.barber_id] ?? 0) + 1;
      }
      const topBarberoId =
        Object.entries(porBarbero).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      // ── Servicio más solicitado ────────────────────────────────────────────
      // Cuenta por booking_item, no por booking: una reserva con 2 servicios
      // suma 1 a cada uno, no 1 al combo como unidad. Esto refleja mejor qué
      // servicio puntual es más pedido, en vez de qué combinación de servicios.
      const porServicio: Record<string, { nombre: string; count: number }> = {};
      for (const b of activos) {
        for (const item of b.booking_items ?? []) {
          if (!porServicio[item.service_id]) {
            porServicio[item.service_id] = { nombre: item.nombre, count: 0 };
          }
          porServicio[item.service_id].count++;
        }
      }
      const topServicio =
        Object.values(porServicio).sort((a, b) => b.count - a.count)[0] ?? null;

      // ── Hora pico ──────────────────────────────────────────────────────────
      const porHoraMap: Record<string, number> = {};
      for (let h = 0; h < 24; h++) {
        porHoraMap[`${h.toString().padStart(2, "0")}:00`] = 0;
      }
      for (const b of activos) {
        const hora = b.hora_inicio.slice(0, 2) + ":00";
        porHoraMap[hora] = (porHoraMap[hora] ?? 0) + 1;
      }

      // Filtrar solo horas con actividad para el gráfico
      const distribucionHoras = Object.entries(porHoraMap)
        .filter(([, count]) => count > 0)
        .map(([hora, count]) => ({ hora, count }));

      const horaPico =
        distribucionHoras.length > 0
          ? distribucionHoras.reduce((max, h) => (h.count > max.count ? h : max))
              .hora
          : null;

      // ── Clientes nuevos vs recurrentes ─────────────────────────────────────
      // Clientes que reservaron antes del mes actual
      const activeClients = Array.from(
        new Map(
          activos.map((booking) => [
            `${booking.cliente_email}::${booking.cliente_telefono}`,
            {
              cliente_email: booking.cliente_email,
              cliente_telefono: booking.cliente_telefono,
            },
          ]),
        ).values(),
      );
      let clientesNuevos = 0;
      let clientesRecurrentes = 0;

      if (activeClients.length > 0) {
        const emailsActivos = [...new Set(activeClients.map((client) => client.cliente_email))];
        const phonesActivos = [...new Set(activeClients.map((client) => client.cliente_telefono))];

        const requests = [];

        if (emailsActivos.length > 0) {
          requests.push(
            supabase
              .from("bookings")
              .select("cliente_email, cliente_telefono")
              .in("business_id", targetBusinessIds)
              .lt("fecha", from)
              .neq("estado", "cancelada")
              .in("cliente_email", emailsActivos),
          );
        }

        if (phonesActivos.length > 0) {
          requests.push(
            supabase
              .from("bookings")
              .select("cliente_email, cliente_telefono")
              .in("business_id", targetBusinessIds)
              .lt("fecha", from)
              .neq("estado", "cancelada")
              .in("cliente_telefono", phonesActivos),
          );
        }

        const results = await Promise.all(requests);
        const previousEmailSet = new Set<string>();
        const previousPhoneSet = new Set<string>();

        for (const result of results) {
          if (result.error) throw new AppError(result.error.message, 500);
          for (const client of result.data ?? []) {
            previousEmailSet.add(client.cliente_email);
            previousPhoneSet.add(client.cliente_telefono);
          }
        }

        for (const client of activeClients) {
          if (
            previousEmailSet.has(client.cliente_email) ||
            previousPhoneSet.has(client.cliente_telefono)
          ) {
            clientesRecurrentes++;
          } else {
            clientesNuevos++;
          }
        }
      }

      // ── Variación de turnos ────────────────────────────────────────────────
      const turnosPrev = prevBookings.length;
      const turnosVariacion =
        turnosPrev > 0
          ? Math.round(((activos.length - turnosPrev) / turnosPrev) * 100)
          : null;

      res.json({
        scope: effectiveScope,
        canViewNetwork,
        businessIds: targetBusinessIds,
        periodo: { year, month, from, to },
        resumen: {
          totalTurnos: activos.length,
          turnosVariacion,
          cancelados,
          tasaCancelacion,
          ingresosMes,
          ingresosVariacion,
          clientesNuevos,
          clientesRecurrentes,
        },
        topProfesionalId: topBarberoId,
        topServicio,
        horaPico,
        porDia: Object.entries(porDia).map(([fecha, total]) => ({
          fecha,
          total,
        })),
      });
    } catch (error) {
      next(error);
    }
  };
}
