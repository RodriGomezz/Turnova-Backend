interface BookingReminderData {
  clienteNombre: string;
  negocioNombre: string;
  servicioNombre: string;
  barberoNombre: string;
  fecha: string;
  horaInicio: string;
  cancellationToken: string;
  slug: string;
  direccion?: string;
  whatsapp?: string;
}

export function bookingReminderTemplate(data: BookingReminderData): string {
  const fechaFormateada = new Date(data.fecha + 'T00:00:00').toLocaleDateString('es-UY', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const cancelUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:4200'}/${data.slug}/cancelar/${data.cancellationToken}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recordatorio de turno</title>
</head>
<body style="margin:0;padding:0;background:#F5F2EC;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EC;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:#C9A84C;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:rgba(10,10,10,0.6);">
                RECORDATORIO
              </p>
              <h1 style="margin:8px 0 0;font-size:28px;font-weight:400;color:#0A0A0A;letter-spacing:-1px;">
                Tu turno es mañana
              </h1>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#fff;padding:40px;">
              <p style="margin:0 0 24px;font-size:15px;color:#0A0A0A;">
                Hola <strong>${data.clienteNombre}</strong>, te recordamos que mañana tenés turno en <strong>${data.negocioNombre}</strong>.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EC;border-radius:10px;padding:24px;margin-bottom:24px;">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E1D8;">
                    <span style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6B7280;">Servicio</span><br/>
                    <span style="font-size:15px;font-weight:600;color:#0A0A0A;">${data.servicioNombre}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E1D8;">
                    <span style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6B7280;">Barbero</span><br/>
                    <span style="font-size:15px;font-weight:600;color:#0A0A0A;">${data.barberoNombre}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;${data.direccion ? 'border-bottom:1px solid #E5E1D8;' : ''}">
                    <span style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6B7280;">Fecha y hora</span><br/>
                    <span style="font-size:15px;font-weight:600;color:#0A0A0A;">${fechaFormateada} · </span>
                    <span style="font-size:15px;font-weight:600;color:#C9A84C;">${data.horaInicio}</span>
                  </td>
                </tr>
                ${data.direccion ? `
                <tr>
                  <td style="padding:8px 0;">
                    <span style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6B7280;">Dirección</span><br/>
                    <span style="font-size:15px;color:#0A0A0A;">📍 ${data.direccion}</span>
                  </td>
                </tr>` : ''}
              </table>

              ${data.whatsapp ? `
              <p style="margin:0 0 16px;font-size:13px;color:#6B7280;">
                ¿Necesitás cambiar algo? Contactanos por WhatsApp.
              </p>
              <a href="https://wa.me/${data.whatsapp}"
                style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:16px;">
                WhatsApp →
              </a>
              <br/>` : ''}

              <a href="${cancelUrl}"
                style="display:inline-block;background:transparent;color:#6B7280;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:12px;font-weight:500;border:1px solid #E5E1D8;">
                Cancelar reserva
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#F5F2EC;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9CA3AF;">
                Este email fue enviado por <a href="https://turnio.uy" style="color:#C9A84C;text-decoration:none;">Turnio</a> en nombre de ${data.negocioNombre}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}