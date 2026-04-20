import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BusinessService } from '../../core/services/business.service';
import { ToastComponent } from '../../shared/toast';
import { TerminologyService } from '../../core/services/terminology.service';
import { ToastService } from '../../core/services/toast.service';
import { BusinessStatusService } from '../../core/services/business-status.service';
import { PlanBanner } from './plan-banner/plan-banner';

interface NavItem {
  path: string;
  label: string;
  svgPath: string;
  proOnly?: boolean;
}

@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ToastComponent, PlanBanner],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel implements OnInit {
  private readonly authService        = inject(AuthService);
  private readonly terminologyService = inject(TerminologyService);
  private readonly toastService       = inject(ToastService);
  private readonly businessService    = inject(BusinessService);
  readonly statusService              = inject(BusinessStatusService);

  readonly sidebarOpen       = signal(true);
  readonly mobileSidebarOpen = signal(false);

  // En mobile el drawer siempre muestra labels, independiente de sidebarOpen
  readonly showLabels = computed(() => this.sidebarOpen() || this.mobileSidebarOpen());

  readonly isPro = computed(() => this.statusService.isPro());

  readonly allNavItems = computed<NavItem[]>(() => [
    {
      path: '/panel/dashboard',
      label: 'Dashboard',
      svgPath: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
    },
    {
      path: '/panel/reservas',
      label: this.terminologyService.reserva() + 's',
      svgPath: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
    },
    {
      path: '/panel/barberos',
      label: this.terminologyService.profesionalPlural(),
      svgPath: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z',
    },
    {
      path: '/panel/servicios',
      label: this.terminologyService.servicio() + 's',
      svgPath: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
    },
    {
      path: '/panel/horarios',
      label: 'Horarios',
      svgPath: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
    },
    {
      path: '/panel/estadisticas',
      label: 'Estadísticas',
      svgPath: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125z',
      proOnly: true,
    },
    {
      path: '/panel/configuracion',
      label: 'Configuración',
      svgPath: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    },
  ]);

  readonly navItems = computed<NavItem[]>(() =>
    this.allNavItems().filter((item) => !item.proOnly || this.isPro()),
  );

  readonly availableBusinesses = computed(() =>
    this.authService.availableBusinesses(),
  );

  readonly currentBusiness = computed(() => this.authService.currentUser());

  readonly hasMultipleBusinesses = computed(
    () => this.availableBusinesses().length > 1,
  );

  ngOnInit(): void {
    this.terminologyService.load().subscribe({
      error: () => this.toastService.warning('No se pudo cargar la configuración del panel.'),
    });
    this.statusService.load().subscribe();
  }

  // ── Sidebar desktop ───────────────────────────────────────────────────────
  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  // ── Sidebar mobile ────────────────────────────────────────────────────────
  openMobileSidebar(): void {
    this.mobileSidebarOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
    document.body.style.overflow = '';
  }

  // Cerrar con tecla Escape
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mobileSidebarOpen()) this.closeMobileSidebar();
  }

  // ── Acciones ──────────────────────────────────────────────────────────────
  logout(): void {
    this.authService.logout();
  }

  switchBusiness(businessId: string): void {
    this.businessService.switchBusiness(businessId).subscribe({
      next: () => {
        this.authService.me().subscribe({
          next: () => window.location.reload(),
        });
      },
      error: () => this.toastService.error('Error al cambiar de sucursal'),
    });
  }
}