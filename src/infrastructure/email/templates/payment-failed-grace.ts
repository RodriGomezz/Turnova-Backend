interface PaymentFailedGraceData {
  negocioNombre: string;
  plan: string;
  gracePeriodEndsAt: string;
  updatePaymentUrl?: string;
}

export function paymentFailedGraceTemplate(data: PaymentFailedGraceData): string {
  const fechaFormateada = new Date(data.gracePeriodEndsAt).toLocaleDateString('es-UY', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Acción requerida</title>
</head>
<body style="margin:0;padding:0;background:#F5F2EC;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EC;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:#8B3A3A;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#F5F2EC;">
                KRONU
              </p>
              <h1 style="margin:8px 0 0;font-size:28px;font-weight:400;color:#F5F2EC;letter-spacing:-1px;">
                Acción requerida
              </h1>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#fff;padding:40px;">
              <p style="margin:0 0 24px;font-size:15px;color:#0A0A0A;">
                Hola <strong>${data.negocioNombre}</strong>, no pudimos procesar el pago de tu plan <strong>${data.plan}</strong>
                y los reintentos automáticos se agotaron.
              </p>

              <!-- DETALLE -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EC;border-radius:10px;padding:24px;margin-bottom:24px;">
                <tr>
                  <td style="padding:8px 0;">
                    <span style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6B7280;">Tu cuenta pasa a Starter el</span><br/>
                    <span style="font-size:15px;font-weight:600;color:#8B3A3A;">${fechaFormateada}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:13px;color:#6B7280;line-height:1.6;">
                Para mantener tu plan actual, actualizá tu método de pago antes de esa fecha.
              </p>

              ${data.updatePaymentUrl ? `
              <a href="${data.updatePaymentUrl}"
                style="display:inline-block;background:#0A0A0A;color:#F5F2EC;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:13px;font-weight:600;">
                Actualizar método de pago
              </a>` : ''}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#F5F2EC;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9CA3AF;">
                Este email fue enviado por <a href="https://kronu.pro" style="color:#C9A84C;text-decoration:none;">Kronu</a> en nombre de ${data.negocioNombre}.
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
