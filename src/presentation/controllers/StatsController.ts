import { Request, Response, NextFunction } from "express";
import { supabase } from "../../infrastructure/database/supabase.client";
import { AppError } from "../../domain/errors";
import { getPlanLimits } from "../../domain/plan-limits";

export class StatsController {
  get = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const businessId = req.businessId!;
      const now = new Date();
      const year = parseInt(req.query["year"] as string) || now.getFullYear();
      const month =
        parseInt(req.query["month"] as string) || now.getMonth() + 1;

      const from = `${year}-${month.toString().padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${month.toString().padStart(2, "0")}-${lastDay}`;

      // Mes anterior para comparativas
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevFrom = `${prevYear}-${prevMonth.toString().padStart(2, "0")}-01`;
      const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
      const prevTo = `${prevYear}-${prevMonth.toString().padStart(2, "0")}-${prevLastDay}`;

      // Traer todos los turnos del mes actual y anterior en paralelo
      const [currentRes, prevRes] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id, estado, fecha, hora_inicio, barber_id, service_id, cliente_email, services(nombre, precio)",
          )
          .eq("business_id", businessId)
          .gte("fecha", from)
          .lte("fecha", to),
        supabase
          .from("bookings")
          .select("id, estado, services(precio)")
          .eq("business_id", businessId)
          .gte("fecha", prevFrom)
          .lte("fecha", prevTo)
          .neq("estado", "cancelada"),
      ]);

      if (currentRes.error) throw new AppError(currentRes.error.message, 500);
      if (prevRes.error) throw new AppError(prevRes.error.message, 500);

      const bookings = currentRes.data ?? [];
      const prevBookings = prevRes.data ?? [];

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
        (sum, b) => sum + ((b.services as any)?.precio ?? 0),
        0,
      );
      const ingresosPrev = prevBookings.reduce(
        (sum, b) => sum + ((b.services as any)?.precio ?? 0),
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
      const porServicio: Record<string, { nombre: string; count: number }> = {};
      for (const b of activos) {
        const nombre = (b.services as any)?.nombre ?? "Desconocido";
        if (!porServicio[b.service_id]) {
          porServicio[b.service_id] = { nombre, count: 0 };
        }
        porServicio[b.service_id].count++;
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
      const emailsActivos = [...new Set(activos.map((b) => b.cliente_email))];
      let clientesNuevos = 0;
      let clientesRecurrentes = 0;

      if (emailsActivos.length > 0) {
        const { data: prevClients } = await supabase
          .from("bookings")
          .select("cliente_email")
          .eq("business_id", businessId)
          .lt("fecha", from)
          .neq("estado", "cancelada")
          .in("cliente_email", emailsActivos);

        const emailsPrevios = new Set(
          (prevClients ?? []).map((b) => b.cliente_email),
        );

        for (const email of emailsActivos) {
          if (emailsPrevios.has(email)) clientesRecurrentes++;
          else clientesNuevos++;
        }
      }

      // ── Variación de turnos ────────────────────────────────────────────────
      const turnosPrev = prevBookings.length;
      const turnosVariacion =
        turnosPrev > 0
          ? Math.round(((activos.length - turnosPrev) / turnosPrev) * 100)
          : null;

      res.json({
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
