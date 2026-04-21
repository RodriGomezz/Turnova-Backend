import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import {
  PublicService,
  PublicBusiness,
} from '../../../core/services/public.service';
import { SubdomainService } from '../../../core/services/subdomain.service';

@Component({
  selector: 'app-confirm',
  standalone: true,
  imports: [RouterLink, TitleCasePipe],
  templateUrl: './confirm.html',
  styleUrl: './confirm.scss',
})
export class Confirm implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly publicService = inject(PublicService);
  private readonly subdomainService = inject(SubdomainService);

  readonly slug = signal('');
  readonly nombre = signal('');
  readonly fecha = signal('');
  readonly hora = signal('');
  readonly servicio = signal('');
  readonly barbero = signal('');
  readonly estado = signal<string>('confirmada');
  readonly business = signal<PublicBusiness | null>(null);

  readonly homeLink = () => this.subdomainService.buildRouterLink(this.slug());
  readonly reservarLink = () =>
    this.subdomainService.buildRouterLink(this.slug(), 'reservar');

  ngOnInit(): void {
    const slug =
      this.subdomainService.getSlug() ??
      this.route.snapshot.paramMap.get('slug') ??
      '';
    this.slug.set(slug);

    const q = this.route.snapshot.queryParamMap;
    this.nombre.set(q.get('nombre') ?? '');
    this.fecha.set(q.get('fecha') ?? '');
    this.hora.set(q.get('hora') ?? '');
    this.servicio.set(q.get('servicio') ?? '');
    this.barbero.set(q.get('barbero') ?? '');
    this.estado.set(q.get('estado') ?? 'confirmada');

    this.publicService.getBusiness(slug).subscribe({
      next: (res) => this.business.set(res.business),
    });
  }

  formatFecha(fecha: string): string {
    if (!fecha) return '';
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-UY', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }
}
