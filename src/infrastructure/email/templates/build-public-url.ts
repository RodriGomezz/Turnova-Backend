const BASE_DOMAIN = process.env.BASE_DOMAIN ?? "kronu.pro";

// Antes: `const IS_PROD = process.env.NODE_ENV === "production"`.
// Mismo problema que SEC-007 (ver errorHandler.middleware.ts): si NODE_ENV
// no está seteado (o tiene cualquier otro valor, p.ej. "staging") en el
// deploy, el default caía silenciosamente en la rama de desarrollo y el
// link de cancelación/confirmación que le llega al cliente por email queda
// roto (http://slug.dominio:4200/...), sin que nadie se entere hasta que
// un cliente hace click. Se invierte el default: el fallback seguro es la
// URL pública real; el modo dev con :4200 requiere opt-in explícito.
const IS_LOCAL_DEV = process.env.LOCAL_DEV === "true";

/**
 * Arma la URL pública de un negocio (página de reserva, cancelación, etc).
 * Espejo de SubdomainService.buildPublicUrl del frontend — misma lógica,
 * mismo esquema, para que los links de los emails apunten exactamente a
 * donde el cliente espera llegar.
 *
 * OJO: esto NO es lo mismo que FRONTEND_URL. FRONTEND_URL es el panel del
 * dueño (app.kronu.pro). Las páginas públicas de cada negocio viven en un
 * subdominio propio ({slug}.kronu.pro) o en el dominio propio del negocio
 * si tiene uno configurado (plan Business). Confundir los dos genera links
 * rotos en los emails — ya pasó una vez, por eso este comentario.
 */
export function buildPublicUrl(
  business: { slug: string; custom_domain?: string | null },
  path: string,
): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (business.custom_domain) {
    return `https://${business.custom_domain}${cleanPath}`;
  }

  if (IS_LOCAL_DEV) {
    return `http://${business.slug}.${BASE_DOMAIN}:4200${cleanPath}`;
  }

  return `https://${business.slug}.${BASE_DOMAIN}${cleanPath}`;
}
