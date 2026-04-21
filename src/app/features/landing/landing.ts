import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  openFaq = signal<string | null>(null);

  faqItems = signal([
    {
      q: '¿Necesito saber de tecnología para configurarlo?',
      a: 'No. Si sabe usar Instagram, sabe usar Turnio. El proceso de configuración toma menos de 10 minutos y no requiere ningún conocimiento técnico.',
    },
    {
      q: '¿Mis clientes necesitan crear una cuenta para reservar?',
      a: 'No. Sus clientes entran a su página, eligen servicio, profesional y horario, ingresan su nombre y email, y listo. Sin registros, sin contraseñas.',
    },
    {
      q: '¿Qué pasa si quiero cancelar mi suscripción?',
      a: 'Puede cancelar en cualquier momento desde su panel, sin penalizaciones ni trámites. Su cuenta pasa al plan Starter automáticamente.',
    },
    {
      q: '¿Puedo cambiar de plan cuando quiera?',
      a: 'Sí. Puede subir o bajar de plan en cualquier momento desde la configuración de su cuenta.',
    },
    {
      q: '¿Los pagos online están incluidos?',
      a: 'Todavía no. Los pagos con MercadoPago Uruguay estarán disponibles próximamente. Por ahora, el cobro se realiza en el local al momento del servicio.',
    },
    {
      q: '¿Turnio funciona en el celular?',
      a: 'Sí. Tanto el panel del dueño como la página de reservas están optimizados para celular. No hay app que descargar.',
    },
  ]);

  toggleFaq(q: string): void {
    this.openFaq.set(this.openFaq() === q ? null : q);
  }
}
