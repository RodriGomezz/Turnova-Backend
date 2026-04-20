import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  PublicService,
  PublicBusiness,
} from '../../../core/services/public.service';
import { SubdomainService } from '../../../core/services/subdomain.service';
import { Barber } from '../../../domain/models/barber.model';
import { Service } from '../../../domain/models/service.model';
import { esOscuro, colorTextoSobre } from '../../../core/utils/color.utils';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './public-home.html',
  styleUrl: './public-home.scss',
})
export class PublicHome implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly publicService = inject(PublicService);
  private readonly subdomainService = inject(SubdomainService);

  readonly business = signal<PublicBusiness | null>(null);
  readonly barbers = signal<Barber[]>([]);
  readonly services = signal<Service[]>([]);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly slug = signal('');

  // ── Computeds de color ─────────────────────────────────────────────────────

  readonly colorTexto = computed(() =>
    colorTextoSobre(this.business()?.color_fondo ?? '#0A0A0A'),
  );

  readonly colorTextoSuave = computed(() =>
    esOscuro(this.business()?.color_fondo ?? '#0A0A0A')
      ? 'rgba(245,242,236,0.6)'
      : 'rgba(10,10,10,0.5)',
  );

  readonly colorSuperficie = computed(() =>
    esOscuro(this.business()?.color_fondo ?? '#0A0A0A')
      ? 'color-mix(in srgb, var(--bg) 80%, white)'
      : '#FFFFFF',
  );

  readonly colorSobreAccento = computed(() =>
    colorTextoSobre(this.business()?.color_acento ?? '#C9A84C'),
  );

  readonly heroImageUrl = computed(() => {
    const url = this.business()?.hero_imagen_url;
    return url ? `${url}?t=${Date.now()}` : null;
  });

  readonly colorAcentoSobreSuperficie = computed(() => {
    const acento = this.business()?.color_acento ?? '#C9A84C';
    const r = parseInt(acento.slice(1, 3), 16);
    const g = parseInt(acento.slice(3, 5), 16);
    const b = parseInt(acento.slice(5, 7), 16);
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    if (lum > 180) return '#1C1C1E';
    if (lum > 190) {
      const f = 0.65;
      return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
    }
    return acento;
  });

  readonly colorSeccionDark = computed(() => {
    const bg = this.business()?.color_fondo ?? '#0A0A0A';
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    return lum < 60 ? bg : '#0A0A0A';
  });

  readonly colorOnAcentoSobreSuperficie = computed(() => {
    const acentoSup = this.colorAcentoSobreSuperficie();
    if (acentoSup === '#1C1C1E' || acentoSup.startsWith('rgb('))
      return '#F5F2EC';
    return colorTextoSobre(acentoSup);
  });

  readonly isDisponible = computed(() => {
    const s = this.business()?.status;
    return s === 'active' || s === 'trial';
  });

  readonly reservarLink = computed(() =>
    this.subdomainService.buildRouterLink(this.slug(), 'reservar'),
  );

  readonly onDarkSection = '#F5F2EC';
  readonly onDarkSectionSoft = 'rgba(245,242,236,0.6)';

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    let slug =
      this.subdomainService.getSlug() ??
      this.route.snapshot.paramMap.get('slug') ??
      '';

    // Si es dominio personalizado, resolver por hostname
    if (!slug && this.subdomainService.isCustomDomain()) {
      const domain = window.location.hostname;
      this.publicService.getBusinessByDomain(domain).subscribe({
        next: (res) => {
          this.slug.set(res.business.slug);
          this.business.set(res.business);
          this.barbers.set(res.barbers);
          this.services.set(res.services);
          this.loading.set(false);
        },
        error: () => {
          this.notFound.set(true);
          this.loading.set(false);
        },
      });
      return;
    }

    this.slug.set(slug);
    this.publicService.getBusiness(slug).subscribe({
      next: (res) => {
        this.business.set(res.business);
        this.barbers.set(res.barbers);
        this.services.set(res.services);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  esOscuro(hex: string): boolean {
    return esOscuro(hex);
  }

  formatPrecio(service: Service): string {
    const base = `$${service.precio.toLocaleString('es-UY')}`;
    return service.precio_hasta
      ? `${base} – $${service.precio_hasta.toLocaleString('es-UY')}`
      : base;
  }
}
