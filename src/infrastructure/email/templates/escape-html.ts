/**
 * Escapa HTML antes de interpolar texto de usuario en un template de email.
 * Sin esto, cualquier campo controlado por el usuario (motivo de cancelación,
 * nombre de cliente, etc.) que contenga < > & " ' se inyecta tal cual en el
 * HTML del email — desde un simple <b>negrita</b> hasta contenido más dañino
 * si alguien lo hace a propósito.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
