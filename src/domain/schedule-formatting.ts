import { Schedule } from "./entities/Schedule";

/**
 * Genera el texto de horario que se muestra en la página pública a partir
 * del horario REAL del negocio (schedules con barber_id null) — reemplaza
 * el viejo horario_texto de carga manual, que podía desincronizarse del
 * horario que efectivamente se usa para calcular disponibilidad.
 *
 * Agrupa días consecutivos (orden Lunes..Domingo, no el orden numérico de
 * dia_semana donde Domingo=0) que comparten exactamente el mismo rango
 * horario, ej: [Lun 9-20, Mar 9-20, Mié 9-20] → "Lun–Mié 9:00–20:00".
 * Con corte de mediodía (break_start/break_end) arma "9:00–13:00 y 14:00–20:00".
 *
 * `schedules` debe venir ya filtrado a los del negocio (barber_id null) —
 * esta función no filtra por eso, solo por `activo`.
 */

const ORDEN_SEMANA: Array<0 | 1 | 2 | 3 | 4 | 5 | 6> = [1, 2, 3, 4, 5, 6, 0]; // Lunes..Domingo

const ABREV_DIA: Record<number, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
};

/** "09:00" / "09:00:00" (Postgres TIME) → "9:00" — sin cero a la izquierda, más legible. */
function formatHora(hora: string): string {
  const [h, m] = hora.slice(0, 5).split(":");
  return `${parseInt(h, 10)}:${m}`;
}

function formatRango(s: Schedule): string {
  if (s.break_start && s.break_end) {
    return `${formatHora(s.hora_inicio)}–${formatHora(s.break_start)} y ${formatHora(
      s.break_end,
    )}–${formatHora(s.hora_fin)}`;
  }
  return `${formatHora(s.hora_inicio)}–${formatHora(s.hora_fin)}`;
}

interface Grupo {
  dias: number[];
  rango: string;
}

export function formatHorarioSemanal(schedules: Schedule[]): string | null {
  const activos = schedules.filter((s) => s.activo);
  if (activos.length === 0) return null;

  // A lo sumo un horario general por día — si hubiera más de uno para el
  // mismo día (no debería pasar), nos quedamos con el primero.
  const porDia = new Map<number, Schedule>();
  for (const s of activos) {
    if (!porDia.has(s.dia_semana)) porDia.set(s.dia_semana, s);
  }

  const diasOrdenados = ORDEN_SEMANA.filter((d) => porDia.has(d));
  if (diasOrdenados.length === 0) return null;

  // Agrupar días consecutivos (en el orden Lunes..Domingo) que comparten
  // exactamente el mismo rango horario.
  const grupos: Grupo[] = [];
  for (const dia of diasOrdenados) {
    const rango = formatRango(porDia.get(dia)!);
    const ultimo = grupos[grupos.length - 1];
    const diaAnterior = ultimo?.dias[ultimo.dias.length - 1];
    const esConsecutivo =
      ultimo !== undefined &&
      diaAnterior !== undefined &&
      ORDEN_SEMANA.indexOf(dia) === ORDEN_SEMANA.indexOf(diaAnterior as 0 | 1 | 2 | 3 | 4 | 5 | 6) + 1;

    if (ultimo && esConsecutivo && ultimo.rango === rango) {
      ultimo.dias.push(dia);
    } else {
      grupos.push({ dias: [dia], rango });
    }
  }

  return grupos
    .map((g) => {
      const etiqueta =
        g.dias.length === 1
          ? ABREV_DIA[g.dias[0]]
          : `${ABREV_DIA[g.dias[0]]}–${ABREV_DIA[g.dias[g.dias.length - 1]]}`;
      return `${etiqueta} ${g.rango}`;
    })
    .join(" · ");
}
