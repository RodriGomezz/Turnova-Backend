import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BusinessStatusService } from '../../../core/services/business-status.service';

@Component({
  selector: 'app-plan-banner',
  standalone: true,
  template: `
    @if (banner().type) {
      <div class="plan-banner" [class]="'plan-banner--' + banner().type">
        <span class="plan-banner__msg">{{ banner().message }}</span>
        <button class="plan-banner__cta" (click)="goToPlanes()">
          Ver planes
        </button>
      </div>
    }
  `,
  styles: [`
    .plan-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.625rem 1.5rem;
      font-size: 0.85rem;
      flex-wrap: wrap;
    }
    .plan-banner--info    { background: #dbeafe; color: #1e40af; }
    .plan-banner--warning { background: #fef3c7; color: #92400e; }
    .plan-banner--danger  { background: #fee2e2; color: #991b1b; }

    .plan-banner__cta {
      white-space: nowrap;
      padding: 0.3rem 0.875rem;
      border-radius: 6px;
      border: 1px solid currentColor;
      background: transparent;
      color: inherit;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      opacity: 0.85;
    }
    .plan-banner__cta:hover { opacity: 1; }
  `],
})
export class PlanBanner {
  private readonly statusService = inject(BusinessStatusService);
  private readonly router        = inject(Router);

  readonly banner = computed(() => this.statusService.bannerInfo());

  goToPlanes(): void {
    this.router.navigate(['/panel/configuracion'], {
      queryParams: { tab: 'planes' },
    });
  }
}
