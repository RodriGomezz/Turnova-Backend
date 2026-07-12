interface PaymentConfirmationData {
  negocioNombre: string;
  amount: number;
  currency: string;
  plan: string;
  nextBillingDate: string;
}

export function paymentConfirmationTemplate(data: PaymentConfirmationData): string {
  const fechaFormateada = new Date(data.nextBillingDate).toLocaleDateString('es-UY', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const montoFormateado = data.amount.toLocaleString('es-UY');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pago recibido</title>
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
                KRONU
              </p>
              <h1 style="margin:8px 0 0;font-size:28px;font-weight:400;color:#F5F2EC;letter-spacing:-1px;">
                Pago recibido
              </h1>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#fff;padding:40px;">
              <p style="margin:0 0 24px;font-size:15px;color:#0A0A0A;">
                Hola <strong>${data.negocioNombre}</strong>, tu pago fue procesado correctamente.
              </p>

              <!-- DETALLE -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EC;border-radius:10px;padding:24px;margin-bottom:24px;">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E1D8;">
                    <span style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6B7280;">Plan</span><br/>
                    <span style="font-size:15px;font-weight:600;color:#0A0A0A;">${data.plan}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #E5E1D8;">
                    <span style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6B7280;">Monto</span><br/>
                    <span style="font-size:15px;font-weight:600;color:#0A0A0A;">${data.currency} ${montoFormateado}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <span style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6B7280;">Próximo cobro</span><br/>
                    <span style="font-size:15px;font-weight:600;color:#C9A84C;">${fechaFormateada}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">
                Gracias por confiar en Kronu.
              </p>
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
