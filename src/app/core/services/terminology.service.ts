import { Injectable, signal, computed } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { BusinessService } from './business.service';

export interface Terminology {
  profesional: string;
  profesionalPlural: string;
  servicio: string;
  reserva: string;
}

const CACHE_KEY = 'turnio_terms';

const DEFAULTS: Terminology = {
  profesional: 'Barbero',
  profesionalPlural: 'Barberos',
  servicio: 'Servicio',
  reserva: 'Turno',
};

@Injectable({ providedIn: 'root' })
export class TerminologyService {
  private readonly _terms = signal<Terminology>(this.readCache());

  readonly terms = this._terms.asReadonly();
  readonly profesional = computed(() => this._terms().profesional);
  readonly profesionalPlural = computed(() => this._terms().profesionalPlural);
  readonly servicio = computed(() => this._terms().servicio);
  readonly reserva = computed(() => this._terms().reserva);

  constructor(private readonly businessService: BusinessService) {}

  load(): Observable<void> {
    return this.businessService.get().pipe(
      tap((business) => {
        const terms: Terminology = {
          profesional: business.termino_profesional,
          profesionalPlural: business.termino_profesional_plural,
          servicio: business.termino_servicio,
          reserva: business.termino_reserva,
        };
        this._terms.set(terms);
        this.writeCache(terms);
      }),
      map(() => void 0),
    );
  }

  update(terms: Terminology): void {
    this._terms.set(terms);
    this.writeCache(terms);
  }

  clear(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* storage no disponible */
    }
  }

  private readCache(): Terminology {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) return JSON.parse(raw) as Terminology;
    } catch {
      /* storage no disponible — usar defaults */
    }
    return DEFAULTS;
  }

  private writeCache(terms: Terminology): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(terms));
    } catch {
      /* storage no disponible */
    }
  }
}
