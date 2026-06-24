import { Request, Response, NextFunction } from "express";

/**
 * Evita que Express (ETag automático) y el navegador cacheen la respuesta.
 *
 * Sin esto, dos pestañas/navegadores con la misma sesión pueden ver datos
 * desincronizados: el que hizo la mutación (crear/cancelar reserva) recibe
 * el body fresco, pero el otro sigue mandando un If-None-Match con un ETag
 * viejo y el navegador sirve su respuesta cacheada en vez de pedir datos
 * nuevos al servidor.
 *
 * Usar en endpoints GET que devuelven datos mutables consultados desde
 * múltiples sesiones/pestañas (paneles, listados). No usar en endpoints
 * públicos que ya tienen su propio cache intencional con invalidación
 * explícita (ver infrastructure/cache/slots.cache.ts y public.cache.ts).
 */
export const noCache = (req: Request, res: Response, next: NextFunction): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  next();
};
