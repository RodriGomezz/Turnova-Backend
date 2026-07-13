const BASE_DOMAIN = process.env.BASE_DOMAIN ?? "kronu.pro";
const IS_PROD = process.env.NODE_ENV === "production";

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

  if (!IS_PROD) {
    return `http://${business.slug}.${BASE_DOMAIN}:4200${cleanPath}`;
  }

  return `https://${business.slug}.${BASE_DOMAIN}${cleanPath}`;
}
