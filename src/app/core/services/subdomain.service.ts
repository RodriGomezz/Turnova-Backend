// src/app/core/services/subdomain.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SubdomainService {
  private readonly baseDomain = environment.baseDomain;

  getSlug(): string | null {
    const hostname = window.location.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
    if (hostname === this.baseDomain) return null;

    // Subdominio de localhost: kevin-barberia.localhost
    if (hostname.endsWith('.localhost')) {
      return hostname.replace('.localhost', '').split('.')[0];
    }

    // Subdominio de producción: kevin-barberia.turnio.pro
    if (hostname.endsWith('.' + this.baseDomain)) {
      return hostname.split('.')[0];
    }

    // Dominio personalizado: tu-negocio.com
    // En este caso el slug no está en el hostname — el backend lo resuelve
    return null;
  }

  isSubdomain(): boolean {
    return this.getSlug() !== null;
  }

  isCustomDomain(): boolean {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
    if (hostname === this.baseDomain) return false;
    if (hostname.endsWith('.localhost')) return false;
    if (hostname.endsWith('.' + this.baseDomain)) return false;
    // Es un dominio que no es subdominio de turnio.pro
    return true;
  }

  buildRouterLink(slug: string, ...segments: string[]): string[] {
    if (this.isSubdomain() || this.isCustomDomain()) {
      return ['/', ...segments];
    }
    return ['/b', slug, ...segments];
  }

  buildPublicUrl(slug: string, path: string = ''): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    if (environment.production) {
      return `https://${slug}.${this.baseDomain}${cleanPath}`;
    }

    // En desarrollo usar http — no hay certificado SSL local
    return `http://${slug}.${this.baseDomain}:4200${cleanPath}`;
  }
}
