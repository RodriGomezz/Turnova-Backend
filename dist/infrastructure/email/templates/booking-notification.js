"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingNotificationTemplate = bookingNotificationTemplate;
function bookingNotificationTemplate(data) {
    const fechaFormateada = new Date(data.fecha + 'T00:00:00').toLocaleDateString('es-UY', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nueva reserva</title>
</head>
<body style="margin:0;padding:0;background:#F5F2EC;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EC;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:#0A0A0A;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;">
                NUEVA RESERVA
              </p>
              <h1 style="margin:8px 0 0;font-size:24px;font-weight:400;color:#F5F2EC;letter-spacing:-1px;">
                ${data.clienteNombre} reservó un turno
              </h1>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#fff;padding:40px;">

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EC;border-radius:10px;padding:24px;margin-bottom:24px;">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E1D8;">
                    <span style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6B7280;">Cliente</span><br/>
                    <span style="font-size:15px;font-weight:600;color:#0A0A0A;">${data.clienteNombre}</span><br/>
                    <span style="font-size:12px;color:#6B7280;">${data.clienteEmail} · ${data.clienteTelefono}</span>
                  </td>
                </tr>
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
                  <td style="padding:8px 0;">
                    <span style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6B7280;">Fecha y hora</span><br/>
                    <span style="font-size:15px;font-weight:600;color:#0A0A0A;">${fechaFormateada}</span><br/>
                    <span style="font-size:15px;font-weight:600;color:#C9A84C;">${data.horaInicio} → ${data.horaFin}</span>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#F5F2EC;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9CA3AF;">
                <a href="https://turnio.uy" style="color:#C9A84C;text-decoration:none;">Turnio</a> · Sistema de reservas
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
//# sourceMappingURL=booking-notification.js.map