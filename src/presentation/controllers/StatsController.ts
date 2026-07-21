import { Request, Response, NextFunction } from "express";
import { supabase } from "../../infrastructure/database/supabase.client";
import { AppError } from "../../domain/errors";
import { UserBusinessAccessRepository } from "../../infrastructure/database/UserBusinessAccessRepository";
import { sumPrecioItems } from "../../domain/booking-pricing";

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
      const year  = parseInt(req.query["year"]  as string) || now.getFullYear();
      const month = parseInt(req.query["month"] as string) || now.getMonth() + 1;

      // ── Cutoff por timezone del cliente ────────────────────────────────────
      // El backend corre en UTC. Sin corrección, los KPIs del mes en curso
      // incluyen reservas de días futuros (timezone local del cliente ≠ UTC).
      // El frontend envía `today` como YYYY-MM-DD en su timezone local, y
      // `only_past=true` cuando el usuario quiere ver solo lo ya realizado.
      // Si alguno falta (mes pasado, toggle "con futuras"), usamos el último
      // día del mes como cutoff → todas las reservas del mes son visibles.
      const onlyPast  = req.query["only_past"] === "true";
      const todayParam = (req.query["today"] as string) ?? null;
      const lastDay = new Date(year, month, 0).getDate();
      const to    = `${year}-${month.toString().padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`;
      const from  = `${year}-${month.toString().padStart(2, "0")}-01`;
      const cutoff = onlyPast && todayParam ? todayParam : to;

      const businesses = await this.userBusinessAccess.findByUser(req.userId!);
      const currentBusiness = businesses.find((b) => b.id === businessId);
      const canViewNetwork  = !!currentBusiness?.esPrincipal && businesses.length > 1;
      const targetBusinessIds =
        scope === "network" && canViewNetwork
          ? businesses.filter((b) => b.activo).map((b) => b.id)
          : [businessId];
      const effectiveScope =
        scope === "network" && canViewNetwork ? "network" : "branch";

      // Mes anterior para comparativas
      const prevMonth   = month === 1 ? 12 : month - 1;
      const prevYear    = month === 1 ? year - 1 : year;
      const prevFrom    = `${prevYear}-${prevMonth.toString().padStart(2, "0")}-01`;
      const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
      const prevTo      = `${prevYear}-${prevMonth.toString().padStart(2, "0")}-${prevLastDay.toString().padStart(2, "0")}`;

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
          .not("estado", "in", '("cancelada","no_show")'),
      ]);

      if (currentRes.error) throw new AppError(currentRes.error.message, 500);
      if (prevRes.error)    throw new AppError(prevRes.error.message,    500);

      const bookings     = (currentRes.data ?? []) as unknown as BookingWithItems[];
      const prevBookings = (prevRes.data   ?? []) as unknown as PrevBookingWithItems[];

      // ── Filtro por cutoff ─────────────────────────────────────────────────
      // Aplicamos el cutoff a TODAS las métricas para que cuando el usuario
      // ve "realizadas" (onlyPast=true), ningún KPI incluya días futuros.
      // Cuando el toggle es "con futuras" (onlyPast=false), cutoff = fin del
      // mes y no se filtra nada — el comportamiento original.
      const activosFiltrados = bookings.filter(
        (b) => b.fecha <= cutoff && b.estado !== "cancelada" && b.estado !== "no_show",
      );
      const canceladosFiltrados = bookings.filter(
        (b) => b.fecha <= cutoff && b.estado === "cancelada",
      );
      const noShowsFiltrados = bookings.filter(
        (b) => b.fecha <= cutoff && b.estado === "no_show",
      );
      const totalFiltrado =
        activosFiltrados.length + canceladosFiltrados.length + noShowsFiltrados.length;

      // ── Métricas base ──────────────────────────────────────────────────────
      const tasaCancelacion =
        totalFiltrado > 0
          ? Math.round((canceladosFiltrados.length / totalFiltrado) * 100)
          : 0;
      const tasaNoShow =
        totalFiltrado > 0
          ? Math.round((noShowsFiltrados.length / totalFiltrado) * 100)
          : 0;

      // ── Ingresos ───────────────────────────────────────────────────────────
      const ingresosMes = activosFiltrados.reduce(
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

      // ── Turnos por día ────────────────────────────────────────────────────
      // Se inicializan TODOS los días del mes a 0, pero solo se cuentan los
      // que pasan el cutoff. Resultado: días futuros quedan en 0 cuando
      // onlyPast=true, sin necesitar filtrado adicional en el frontend.
      const porDia: Record<string, number> = {};
      for (let d = 1; d <= lastDay; d++) {
        const key = `${year}-${month.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
        porDia[key] = 0;
      }
      for (const b of activosFiltrados) {
        if (porDia[b.fecha] !== undefined) porDia[b.fecha]++;
      }

      // ── Variación de turnos ────────────────────────────────────────────────
      const turnosPrev = prevBookings.length;
      const turnosVariacion =
        turnosPrev > 0
          ? Math.round(
              ((activosFiltrados.length - turnosPrev) / turnosPrev) * 100,
            )
          : null;

      // ── Profesional más solicitado ─────────────────────────────────────────
      const porBarbero: Record<string, number> = {};
      for (const b of activosFiltrados) {
        porBarbero[b.barber_id] = (porBarbero[b.barber_id] ?? 0) + 1;
      }
      const topBarberoId =
        Object.entries(porBarbero).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      // ── Servicio más solicitado ────────────────────────────────────────────
      // Los ítems libres (service_id null: productos/adicionales ad-hoc sin
      // catálogo) no entran acá — no son comparables entre sí como si fueran
      // "un mismo servicio", y agruparlos falsearía cuál es el servicio top.
      const porServicio: Record<string, { nombre: string; count: number }> = {};
      for (const b of activosFiltrados) {
        for (const item of b.booking_items ?? []) {
          if (!item.service_id) continue;
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
      for (const b of activosFiltrados) {
        const hora = b.hora_inicio.slice(0, 2) + ":00";
        porHoraMap[hora] = (porHoraMap[hora] ?? 0) + 1;
      }
      const distribucionHoras = Object.entries(porHoraMap)
        .filter(([, count]) => count > 0)
        .map(([hora, count]) => ({ hora, count }));

      const horaPico =
        distribucionHoras.length > 0
          ? distribucionHoras.reduce((max, h) =>
              h.count > max.count ? h : max,
            ).hora
          : null;

      // ── Clientes nuevos vs recurrentes ─────────────────────────────────────
      const activeClients = Array.from(
        new Map(
          activosFiltrados.map((b) => [
            `${b.cliente_email}::${b.cliente_telefono}`,
            { cliente_email: b.cliente_email, cliente_telefono: b.cliente_telefono },
          ]),
        ).values(),
      );

      let clientesNuevos = 0;
      let clientesRecurrentes = 0;

      if (activeClients.length > 0) {
        const emailsActivos = [...new Set(activeClients.map((c) => c.cliente_email))];
        const phonesActivos = [...new Set(activeClients.map((c) => c.cliente_telefono))];
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

      res.json({
        scope: effectiveScope,
        canViewNetwork,
        businessIds: targetBusinessIds,
        periodo: { year, month, from, to },
        resumen: {
          totalTurnos:       activosFiltrados.length,
          turnosVariacion,
          cancelados:        canceladosFiltrados.length,
          tasaCancelacion,
          noShows:           noShowsFiltrados.length,
          tasaNoShow,
          ingresosMes,
          ingresosVariacion,
          clientesNuevos,
          clientesRecurrentes,
        },
        topProfesionalId: topBarberoId,
        topServicio,
        horaPico,
        distribucionHoras,
        porDia: Object.entries(porDia).map(([fecha, total]) => ({ fecha, total })),
      });
    } catch (error) {
      next(error);
    }
  };
}