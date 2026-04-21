import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  PublicService,
  PublicBusiness,
} from '../../../core/services/public.service';
import { SubdomainService } from '../../../core/services/subdomain.service';

type CancelStatus =
  | 'loading'
  | 'confirm'
  | 'cancelling'
  | 'success'
  | 'error'
  | 'too-late'
  | 'already-cancelled';

@Component({
  selector: 'app-cancel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cancel.html',
  styleUrl: './cancel.scss',
})
export class Cancel implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly publicService = inject(PublicService);
  private readonly subdomainService = inject(SubdomainService);

  readonly slug = signal('');
  readonly token = signal('');
  readonly business = signal<PublicBusiness | null>(null);
  readonly status = signal<CancelStatus>('loading');
  readonly errorMsg = signal('');

  readonly homeLink = () => this.subdomainService.buildRouterLink(this.slug());
  readonly reservarLink = () =>
    this.subdomainService.buildRouterLink(this.slug(), 'reservar');

  ngOnInit(): void {
    const slug =
      this.subdomainService.getSlug() ??
      this.route.snapshot.paramMap.get('slug') ??
      '';
    const token = this.route.snapshot.paramMap.get('token') ?? '';

    this.slug.set(slug);
    this.token.set(token);

    this.publicService.getBusiness(slug).subscribe({
      next: (res) => {
        this.business.set(res.business);
        this.status.set('confirm');
      },
      error: () => this.status.set('error'),
    });
  }

  cancel(): void {
    this.status.set('cancelling');
    this.publicService.cancelBooking(this.token()).subscribe({
      next: () => this.status.set('success'),
      error: (err) => {
        const msg = err.error?.error ?? '';
        if (msg.includes('24 horas')) {
          this.status.set('too-late');
        } else if (msg.includes('ya está cancelada')) {
          this.status.set('already-cancelled');
        } else {
          this.errorMsg.set(msg || 'No se pudo cancelar el turno');
          this.status.set('error');
        }
      },
    });
  }
}
