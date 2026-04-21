import { Component, computed, OnInit, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params } from '@angular/router';
import { forkJoin } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { BusinessService } from '../../../core/services/business.service';
import { BusinessStatusService } from '../../../core/services/business-status.service';
import { StorageService } from '../../../core/services/storage.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { TerminologyService } from '../../../core/services/terminology.service';
import { DomainService, DomainStatus, DnsInstructions } from '../../../core/services/domain.service';
import {
  calcCanUseCustomDomain,
  SubscriptionPayerInput,
  SubscriptionService,
} from '../../../core/services/subscription.service';
import { Subscription, SubscriptionPlan } from '../../../domain/models/subscription.model';
import { environment } from '../../../../environments/environment';
import { TitleCasePipe } from '@angular/common';
import { of } from 'rxjs';

type ActiveTab = 'negocio' | 'apariencia' | 'pagina' | 'cuenta' | 'planes' | 'sucursales';
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_ASSET_SIZE_MB = 2;

interface BusinessForm {
  nombre: string;
  email: string;
  whatsapp: string;
  direccion: string;
  buffer_minutos: number;
  color_fondo: string;
  color_acento: string;
  color_superficie: string;
  logo_url: string | null;
  auto_confirmar: boolean;
  frase_bienvenida: string;
  hero_imagen_url: string | null;
  instagram: string;
  facebook: string;
  tipografia: 'clasica' | 'moderna' | 'minimalista' | 'bold';
  estilo_cards: 'destacado' | 'minimalista' | 'oscuro';
  termino_profesional: string;
  termino_profesional_plural: string;
  termino_servicio: string;
  termino_reserva: string;
}

interface AccountForm {
  nombre: string;
  password: string;
  passwordConfirm: string;
}

interface SubscriptionPayerForm {
  firstName: string;
  lastName: string;
  email: string;
}

interface ContrastCheck {
  par: string;
  color1: string;
  color2: string;
  ratio: number;
  passAA: boolean;
  passAALarge: boolean;
  passAAA: boolean;
}

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [FormsModule,TitleCasePipe],
  templateUrl: './config.html',
  styleUrl: './config.scss',
})
export class Config implements OnInit {
  private readonly businessService     = inject(BusinessService);
  private readonly statusService       = inject(BusinessStatusService);
  private readonly storageService      = inject(StorageService);
  private readonly authService         = inject(AuthService);
  private readonly toastService        = inject(ToastService);
  private readonly terminologyService  = inject(TerminologyService);
  private readonly domainService       = inject(DomainService);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly route               = inject(ActivatedRoute);
  private readonly destroyRef          = inject(DestroyRef);

  readonly loading          = signal(true);
  readonly saving           = signal(false);
  readonly savingAccount    = signal(false);
  readonly uploadingLogo    = signal(false);
  readonly uploadingHero    = signal(false);
  readonly logoPreview      = signal<string | null>(null);
  readonly heroPreview      = signal<string | null>(null);
  readonly accountEmail     = signal('');
  readonly activeTab        = signal<ActiveTab>('negocio');
  readonly slug             = signal('');

  // plan y trialDaysLeft vienen del servicio central — única fuente de verdad
  readonly plan          = computed(() => this.statusService.business()?.plan ?? 'starter');
  readonly trialDaysLeft = computed(() => this.statusService.trialDaysLeft());

  // ── Subscription signals ───────────────────────────────────────────────────
  readonly subscription      = signal<Subscription | null>(null);
  readonly pendingSubscription = signal<Subscription | null>(null);
  readonly subscribing       = signal<SubscriptionPlan | null>(null);
  readonly confirmingCancel  = signal(false);
  readonly canceling         = signal(false);

  // ── Domain signals ─────────────────────────────────────────────────────────
  readonly domainInput       = signal('');
  readonly domainStatus      = signal<DomainStatus | null>(null);
  readonly savingDomain      = signal(false);
  readonly removingDomain    = signal(false);
  readonly checkingDomain    = signal(false);
  readonly dnsInstructions   = signal<DnsInstructions | null>(null);
  readonly confirmingRemove  = signal(false);

  // ── Branches signals ───────────────────────────────────────────────────────
  readonly branches              = signal<any[]>([]);
  readonly confirmingDeactivate  = signal<string | null>(null);
  readonly confirmingDelete      = signal<string | null>(null);
  readonly processingBranch      = signal(false);
  readonly savingBranch          = signal(false);

  private businessId       = '';
  private originalLogoUrl: string | null = null;

  form: BusinessForm = {
    nombre: '', email: '', whatsapp: '', direccion: '',
    buffer_minutos: 0,
    color_fondo: '#0A0A0A', color_acento: '#C9A84C', color_superficie: '#1C1C1E',
    logo_url: null, auto_confirmar: true,
    frase_bienvenida: '', hero_imagen_url: null,
    instagram: '', facebook: '',
    tipografia: 'clasica', estilo_cards: 'destacado',
    termino_profesional: 'Profesional', termino_profesional_plural: 'Profesionales',
    termino_servicio: 'Servicio', termino_reserva: 'Turno',
  };

  accountForm: AccountForm = { nombre: '', password: '', passwordConfirm: '' };
  payerForm: SubscriptionPayerForm = { firstName: '', lastName: '', email: '' };
  branchForm = { nombre: '', slug: '' };

  // ── Opciones estáticas ─────────────────────────────────────────────────────

  readonly paletas = [
    { nombre: 'Carbón + Oro',       grupo: 'Oscuro · Premium',      fondo: '#0A0A0A', superficie: '#1C1C1E', acento: '#C9A84C' },
    { nombre: 'Medianoche + Marfil',grupo: 'Oscuro · Premium',      fondo: '#1A1A2E', superficie: '#16213E', acento: '#E8D5B7' },
    { nombre: 'Espresso + Ámbar',   grupo: 'Oscuro · Premium',      fondo: '#2C1810', superficie: '#3D2218', acento: '#D4954A' },
    { nombre: 'Hielo + Marino',     grupo: 'Fresco · Moderno',      fondo: '#F0F4FF', superficie: '#FFFFFF', acento: '#1A3A6B' },
    { nombre: 'Blanco + Negro',     grupo: 'Fresco · Moderno',      fondo: '#F5F5F5', superficie: '#FFFFFF', acento: '#111111' },
    { nombre: 'Menta + Bosque',     grupo: 'Fresco · Moderno',      fondo: '#F0FBF4', superficie: '#FFFFFF', acento: '#1A4731' },
    { nombre: 'Fuego + Carbón',     grupo: 'Energético · Urbano',   fondo: '#FF4D1C', superficie: '#FF6B3D', acento: '#1A1A1A' },
    { nombre: 'Pitch + Verde',      grupo: 'Energético · Urbano',   fondo: '#0D0D0D', superficie: '#1A1A1A', acento: '#00A374' },
    { nombre: 'Índigo + Violeta',   grupo: 'Energético · Urbano',   fondo: '#1C1C3A', superficie: '#252548', acento: '#B065FF' },
    { nombre: 'Crema + Terracota',  grupo: 'Cálido · Accesible',    fondo: '#FFF8F0', superficie: '#FFFFFF', acento: '#B8431A' },
    { nombre: 'Rosa + Fucsia',      grupo: 'Cálido · Accesible',    fondo: '#FDF0F5', superficie: '#FFFFFF', acento: '#C2366B' },
    { nombre: 'Paper + Azul',       grupo: 'Cálido · Accesible',    fondo: '#F7F5F0', superficie: '#FFFFFF', acento: '#1A4FCC' },
  ];

  readonly brandColors = [
    { nombre: 'Negro',   hex: '#0A0A0A' }, { nombre: 'Acero',  hex: '#1C1C1E' },
    { nombre: 'Oro',     hex: '#C9A84C' }, { nombre: 'Crema',  hex: '#F5F2EC' },
    { nombre: 'Pizarra', hex: '#6B7280' }, { nombre: 'Hueso',  hex: '#E5E1D8' },
    { nombre: 'Verde',   hex: '#22C55E' }, { nombre: 'Rojo',   hex: '#EF4444' },
  ];

  readonly tipografiaOptions = [
    { value: 'clasica',     label: 'Clásica',     fontFamily: "'Playfair Display', serif"  },
    { value: 'moderna',     label: 'Moderna',     fontFamily: "'Inter', sans-serif"         },
    { value: 'minimalista', label: 'Minimalista', fontFamily: "'DM Sans', sans-serif"       },
    { value: 'bold',        label: 'Bold',        fontFamily: "'Montserrat', sans-serif"    },
  ] as const;

  readonly estiloCardsOptions = [
    { value: 'destacado',   label: 'Destacado'   },
    { value: 'minimalista', label: 'Minimalista' },
    { value: 'oscuro',      label: 'Oscuro'      },
  ] as const;

  readonly planesDisponibles = [
    {
      id: 'starter', nombre: 'Starter', precio: 590, destacado: false,
      porDia: 'Menos de $20 por día.',
      desc: 'Para el profesional independiente.',
      features: [
        { label: '1 profesional',                    incluido: true  },
        { label: 'Turnos ilimitados',                incluido: true  },
        { label: 'Página propia con subdominio',     incluido: true  },
        { label: 'Personalización colores y logo',   incluido: true  },
        { label: 'Email de confirmación automático', incluido: true  },
        { label: 'Recordatorios automáticos',        incluido: false },
      ],
    },
    {
      id: 'pro', nombre: 'Pro', precio: 1390, destacado: true,
      porDia: 'Menos de $50 por día. Menos que un café.',
      desc: 'Para el negocio que tiene equipo.',
      features: [
        { label: 'Hasta 5 profesionales',                incluido: true },
        { label: 'Turnos ilimitados',                    incluido: true },
        { label: 'Todo lo del Starter',                  incluido: true },
        { label: 'Recordatorios automáticos por email',  incluido: true },
        { label: 'Estadísticas completas',               incluido: true },
        { label: 'Bloqueo de fechas y horarios',         incluido: true },
      ],
    },
    {
      id: 'business', nombre: 'Business', precio: 2290, destacado: false,
      porDia: 'Para negocios con volumen.',
      desc: 'Para cadenas y múltiples sucursales.',
      features: [
        { label: 'Profesionales ilimitados',         incluido: true },
        { label: 'Hasta 3 sucursales',               incluido: true },
        { label: 'Todo lo del Pro',                  incluido: true },
        { label: 'Panel unificado',                  incluido: true },
        { label: 'Soporte prioritario por WhatsApp', incluido: true },
        { label: 'Onboarding personalizado',         incluido: true },
      ],
    },
  ];

  // ── Contraste ──────────────────────────────────────────────────────────────
  contrastWarning = false;
  fondoEsOscuro   = false;
  sugerenciaContraste      = '';
  contrastChecksCriticos: ContrastCheck[] = [];

  // ── Computeds ──────────────────────────────────────────────────────────────

  readonly trialActivo = computed(
    () => this.trialDaysLeft() !== null && this.trialDaysLeft()! > 0,
  );

  readonly subscriptionStatusLabel = computed(() => {
    const s = this.subscription();
    if (!s) return '';
    const labels: Record<string, string> = {
      active:       'Activa',
      past_due:     'Pago pendiente',
      grace_period: 'Período de gracia',
      canceled:     'Cancelada',
      expired:      'Expirada',
    };
    return labels[s.status] ?? s.status;
  });

  readonly pendingPlanLabel = computed(() => {
    const pending = this.pendingSubscription();
    if (!pending) return '';
    const nombres: Record<string, string> = {
      starter: 'Starter',
      pro: 'Pro',
      business: 'Business',
    };
    return nombres[pending.plan] ?? pending.plan;
  });

  readonly gracePeriodEnd = computed(() => {
    const end = this.subscription()?.grace_period_ends_at;
    if (!end) return null;
    return new Date(end).toLocaleDateString('es-UY', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  });

  readonly canUseCustomDomain = computed(() =>
    calcCanUseCustomDomain(this.plan()),
  );

  readonly currentSubscriptionEyebrow = computed(() => {
    const subscription = this.subscription();
    if (!subscription) return null;

    const labels: Record<Subscription['status'], string> = {
      pending: 'Pago en confirmación',
      active: 'Suscripción actual',
      past_due: 'Pago pendiente',
      grace_period: 'Período de gracia',
      canceled: 'Cancelada al cierre del período',
      expired: 'Expirada',
    };

    return labels[subscription.status] ?? 'Suscripción';
  });

  readonly nextSubscriptionEventLabel = computed(() => {
    const subscription = this.subscription();
    if (!subscription?.current_period_end) return null;

    const date = this.formatSubscriptionDate(subscription.current_period_end);

    if (subscription.status === 'canceled') {
      return `Activo hasta ${date}`;
    }

    if (subscription.status === 'past_due') {
      return `Período actual vence el ${date}`;
    }

    if (subscription.status === 'grace_period') {
      return this.gracePeriodEnd()
        ? `Período de gracia hasta ${this.gracePeriodEnd()}`
        : `Período actual vence el ${date}`;
    }

    return `Próximo cobro el ${date}`;
  });

  readonly canCancelCurrentSubscription = computed(() => {
    const subscription = this.subscription();
    return subscription?.status === 'active';
  });

  get grupos(): string[] {
    return [...new Set(this.paletas.map((p) => p.grupo))];
  }

  get paletaActiva(): string {
    return (
      this.paletas.find(
        (p) => p.fondo === this.form.color_fondo && p.acento === this.form.color_acento,
      )?.nombre ?? 'personalizada'
    );
  }

  get publicUrl(): string {
    if (environment.production) return `${this.slug()}.${environment.baseDomain}`;
    return `${this.slug()}.localhost:4200`;
  }

  get planNombre(): string {
    if (this.trialActivo()) return 'Trial Pro';
    const nombres: Record<string, string> = { starter: 'Starter', pro: 'Pro', business: 'Business' };
    return nombres[this.plan()] ?? 'Starter';
  }

  get planLabel(): string {
    if (this.trialActivo()) return `Acceso Pro completo por ${this.trialDaysLeft()} días más`;
    const labels: Record<string, string> = {
      starter:  '$590/mes · 1 profesional · turnos ilimitados',
      pro:      '$1.390/mes · 5 profesionales · todo incluido',
      business: '$2.290/mes · ilimitados · multi-sucursal',
    };
    return labels[this.plan()] ?? '';
  }

  get trialLabel(): string | null {
    const days = this.trialDaysLeft();
    if (days === null) return null;
    if (days <= 0) return 'Tu período de prueba venció — actualizá tu plan';
    if (days <= 7) return `Trial: quedan ${days} día${days !== 1 ? 's' : ''}`;
    return `Trial activo: ${days} días restantes`;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loading.set(true);

    forkJoin({
      business:     this.businessService.get(),
      user:         this.authService.me(),
      domain:       this.domainService.get(),
      subscriptionState: this.subscriptionService.getState().pipe(
      catchError(() => of(null))
    ),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ business, user, domain, subscriptionState }) => {
          this.businessId = business.id;
          this.slug.set(business.slug);

          this.originalLogoUrl = business.logo_url ?? null;

          this.form = {
            nombre:                    business.nombre ?? '',
            email:                     business.email ?? '',
            whatsapp:                  business.whatsapp ?? '',
            direccion:                 business.direccion ?? '',
            buffer_minutos:            business.buffer_minutos ?? 0,
            color_fondo:               business.color_fondo ?? '#0A0A0A',
            color_acento:              business.color_acento ?? '#C9A84C',
            color_superficie:          business.color_superficie ?? '#1C1C1E',
            logo_url:                  business.logo_url ?? null,
            auto_confirmar:            business.auto_confirmar ?? true,
            frase_bienvenida:          business.frase_bienvenida ?? '',
            hero_imagen_url:           business.hero_imagen_url ?? null,
            instagram:                 business.instagram ?? '',
            facebook:                  business.facebook ?? '',
            tipografia:                business.tipografia ?? 'clasica',
            estilo_cards:              business.estilo_cards ?? 'destacado',
            termino_profesional:       business.termino_profesional ?? 'Profesional',
            termino_profesional_plural: business.termino_profesional_plural ?? 'Profesionales',
            termino_servicio:          business.termino_servicio ?? 'Servicio',
            termino_reserva:           business.termino_reserva ?? 'Turno',
          };

          this.logoPreview.set(business.logo_url ?? null);
          this.heroPreview.set(business.hero_imagen_url ?? null);
          this.accountEmail.set(user.email ?? '');
          this.accountForm.nombre = user.nombre ?? '';
          this.payerForm = {
            firstName: this.extractFirstName(user.nombre),
            lastName: this.extractLastName(user.nombre),
            email: user.email ?? '',
          };
          this.domainStatus.set(domain);
          this.subscription.set(subscriptionState?.activeSubscription ?? null);
          this.pendingSubscription.set(
            subscriptionState?.pendingSubscription ?? null,
          );
          this.actualizarContraste();

          if (this.statusService.isBusiness()) this.loadBranches();
        },
        error: () => this.toastService.error('Error al cargar la configuración'),
      });

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params) => {
        if (params['tab']) this.activeTab.set(params['tab'] as ActiveTab);
        if (params['success']) {
          this.refreshSubscriptionState();
          this.refreshBusinessState();
          this.scheduleCheckoutConfirmationRefresh();
          this.toastService.info('Estamos confirmando tu pago.');
        }
        if (params['canceled']) {
          this.refreshSubscriptionState();
          this.refreshBusinessState();
          this.toastService.info('No se completó el pago.');
        }
      });
  }

  private loadBranches(): void {
    this.businessService.listUserBusinesses().subscribe({
      next: (businesses) => this.branches.set(businesses.filter((b) => !b.esPrincipal)),
      error: () => this.toastService.error('Error al cargar las sucursales'),
    });
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────

  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  // ── Save negocio ───────────────────────────────────────────────────────────

  save(): void {
    if (!this.form.nombre.trim()) {
      this.toastService.error('El nombre del negocio es requerido');
      return;
    }
    this.saving.set(true);

    if (this.originalLogoUrl && !this.form.logo_url) {
      this.storageService.deleteBusinessAsset(this.businessId, 'logo').subscribe();
    }

    this.businessService
      .update(this.form)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.originalLogoUrl = this.form.logo_url ?? null;
          this.toastService.success('Cambios guardados correctamente');
          this.terminologyService.update({
            profesional:       this.form.termino_profesional,
            profesionalPlural: this.form.termino_profesional_plural,
            servicio:          this.form.termino_servicio,
            reserva:           this.form.termino_reserva,
          });
        },
        error: (err) => this.toastService.error(err.error?.error ?? 'Error al guardar'),
      });
  }

  // ── Save cuenta ────────────────────────────────────────────────────────────

  saveAccount(): void {
    if (!this.accountForm.nombre.trim()) {
      this.toastService.error('El nombre es requerido');
      return;
    }
    if (this.accountForm.password && this.accountForm.password.length < 8) {
      this.toastService.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (this.accountForm.password !== this.accountForm.passwordConfirm) {
      this.toastService.error('Las contraseñas no coinciden');
      return;
    }
    this.savingAccount.set(true);

    const payload: { nombre: string; password?: string } = { nombre: this.accountForm.nombre };
    if (this.accountForm.password) payload.password = this.accountForm.password;

    this.authService
      .updateProfile(payload)
      .pipe(finalize(() => this.savingAccount.set(false)))
      .subscribe({
        next: () => {
          this.accountForm.password = '';
          this.accountForm.passwordConfirm = '';
          this.toastService.success('Cuenta actualizada correctamente');
        },
        error: (err) => this.toastService.error(err.error?.error ?? 'Error al actualizar'),
      });
  }

  // ── Planes ─────────────────────────────────────────────────────────────────

solicitarPlan(p: { id: string; nombre: string; precio: number }): void {
  const payer = this.buildSubscriptionPayer();
  if (!payer) return;
  this.subscribing.set(p.id as SubscriptionPlan);
  this.subscriptionService
    .create(p.id as SubscriptionPlan, payer)
    .pipe(finalize(() => this.subscribing.set(null)))
    .subscribe({
      next: (checkoutUrl) => { window.location.href = checkoutUrl; },
      error: (err) =>
        this.toastService.error(err.error?.error ?? 'Error al iniciar el pago'),
    });
}

isCurrentActivePlan(planId: string): boolean {
  if (this.trialActivo() && !this.hasCurrentSubscription()) return false;
  return this.getEffectivePlanId() === planId;
}

hasActiveSubscription(): boolean {
  return this.subscription()?.status === 'active';
}

hasCurrentSubscription(): boolean {
  return this.subscription() !== null;
}

hasPendingSubscription(): boolean {
  return this.pendingSubscription()?.status === 'pending';
}

isPendingPlan(planId: string): boolean {
  return this.pendingSubscription()?.plan === planId;
}

  cancelSubscription(): void {
    this.confirmingCancel.set(true);
  }

  confirmCancel(): void {
    this.canceling.set(true);
    this.confirmingCancel.set(false);
    this.subscriptionService
      .cancel()
      .pipe(finalize(() => this.canceling.set(false)))
      .subscribe({
        next: (res) => {
          this.toastService.success(res.message);
          this.refreshSubscriptionState();
        },
        error: (err) =>
          this.toastService.error(err.error?.error ?? 'Error al cancelar'),
      });
  }

  closePlanModal(): void {
    this.confirmingCancel.set(false);
  }

  getWhatsappMsg(planNombre: string): string {
    return encodeURIComponent(
      `Hola, soy ${this.form.nombre} y quiero actualizar al plan ${planNombre} de Turnio.`,
    );
  }

  // ── Domain ─────────────────────────────────────────────────────────────────

  addDomain(): void {
    if (!this.canUseCustomDomain()) {
      this.toastService.error('Los dominios personalizados están disponibles en los planes Pro y Business.');
      return;
    }
    const domain = this.domainInput().trim().toLowerCase();
    if (!domain) { this.toastService.error('Ingresá un dominio'); return; }
    this.savingDomain.set(true);
    this.domainService
      .add(domain)
      .pipe(finalize(() => this.savingDomain.set(false)))
      .subscribe({
        next: (res) => {
          this.domainStatus.set({ custom_domain: res.custom_domain, domain_verified: false, domain_verified_at: null, domain_added_at: new Date().toISOString() });
          this.dnsInstructions.set(res.dns_instructions);
          this.domainInput.set('');
          this.toastService.success('Dominio agregado. Configurá tu DNS.');
        },
        error: (err) => this.toastService.error(err.error?.error ?? 'Error al agregar el dominio'),
      });
  }

  confirmRemoveDomain(): void { this.confirmingRemove.set(true); }
  cancelRemoveDomain():  void { this.confirmingRemove.set(false); }

  removeDomain(): void {
    this.removingDomain.set(true);
    this.domainService
      .remove()
      .pipe(finalize(() => { this.removingDomain.set(false); this.confirmingRemove.set(false); }))
      .subscribe({
        next: () => {
          this.domainStatus.set({ custom_domain: null, domain_verified: false, domain_verified_at: null, domain_added_at: null });
          this.dnsInstructions.set(null);
          this.toastService.success('Dominio eliminado correctamente');
        },
        error: (err) => this.toastService.error(err.error?.error ?? 'Error al eliminar el dominio'),
      });
  }

  checkDomainStatus(): void {
    this.checkingDomain.set(true);
    this.domainService
      .checkStatus()
      .pipe(finalize(() => this.checkingDomain.set(false)))
      .subscribe({
        next: (res) => {
          if (res.verified) {
            this.domainStatus.update((s) => s ? { ...s, domain_verified: true } : s);
            this.toastService.success('¡Dominio verificado correctamente!');
          } else {
            this.toastService.info('El dominio aún no apunta a Turnio. Verificá tu configuración DNS.');
          }
        },
        error: () => this.toastService.error('Error al verificar el dominio'),
      });
  }

  copyDomain(): void {
    const domain = this.domainStatus()?.custom_domain;
    if (!domain) return;
    navigator.clipboard.writeText(`https://${domain}`);
    this.toastService.success('Link copiado');
  }

  copyUrl(): void {
    navigator.clipboard.writeText(`https://${this.publicUrl}`);
    this.toastService.success('Link copiado');
  }

  // ── Upload logo ────────────────────────────────────────────────────────────

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.validateAsset(file)) return;
    const reader = new FileReader();
    reader.onload = () => this.logoPreview.set(reader.result as string);
    reader.readAsDataURL(file);
    this.uploadingLogo.set(true);
    this.storageService
      .uploadBusinessAsset(file, this.businessId, 'logo')
      .pipe(finalize(() => this.uploadingLogo.set(false)))
      .subscribe({
        next: (url) => { this.form.logo_url = url; },
        error: () => this.toastService.error('Error al subir el logo'),
      });
  }

  removeLogo(): void { this.logoPreview.set(null); this.form.logo_url = null; }

  onHeroSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.validateAsset(file)) return;
    this.uploadingHero.set(true);
    this.storageService
      .uploadBusinessAsset(file, this.businessId, 'hero')
      .pipe(finalize(() => this.uploadingHero.set(false)))
      .subscribe({
        next: (url) => { this.form.hero_imagen_url = url; this.heroPreview.set(`${url}?t=${Date.now()}`); },
        error: () => this.toastService.error('Error al subir la imagen'),
      });
  }

  removeHero(): void { this.heroPreview.set(null); this.form.hero_imagen_url = null; }

  // ── Sucursales ─────────────────────────────────────────────────────────────

  generateBranchSlug(): void {
    this.branchForm.slug = this.branchForm.nombre
      .toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').trim()
      .replace(/\s+/g, '-');
  }

  createBranch(): void {
    if (!this.branchForm.nombre.trim()) { this.toastService.error('El nombre es requerido'); return; }
    if (!this.branchForm.slug.trim())   { this.toastService.error('El link es requerido'); return; }
    this.savingBranch.set(true);
    this.authService
      .createBranch(this.branchForm.nombre, this.branchForm.slug)
      .pipe(finalize(() => this.savingBranch.set(false)))
      .subscribe({
        next: () => {
          this.toastService.success('Sucursal creada correctamente');
          this.branchForm = { nombre: '', slug: '' };
          this.authService.me().subscribe({
            next: () => this.branches.set(
              (this.authService.availableBusinesses() ?? []).filter((b) => b.id !== this.businessId),
            ),
          });
        },
        error: (err) => this.toastService.error(err.error?.error ?? 'Error al crear la sucursal'),
      });
  }

  deactivateBranch(id: string): void {
    this.processingBranch.set(true);
    this.businessService.deactivateBranch(id)
      .pipe(finalize(() => { this.processingBranch.set(false); this.confirmingDeactivate.set(null); }))
      .subscribe({
        next: () => { this.toastService.success('Sucursal desactivada'); this.loadBranches(); },
        error: (err) => this.toastService.error(err.error?.error ?? 'Error al desactivar'),
      });
  }

  reactivateBranch(id: string): void {
    this.processingBranch.set(true);
    this.businessService.reactivateBranch(id)
      .pipe(finalize(() => this.processingBranch.set(false)))
      .subscribe({
        next: () => { this.toastService.success('Sucursal reactivada'); this.loadBranches(); },
        error: (err) => this.toastService.error(err.error?.error ?? 'Error al reactivar'),
      });
  }

  deleteBranch(id: string): void {
    this.processingBranch.set(true);
    this.businessService.deleteBranch(id)
      .pipe(finalize(() => { this.processingBranch.set(false); this.confirmingDelete.set(null); }))
      .subscribe({
        next: () => { this.toastService.success('Sucursal eliminada permanentemente'); this.loadBranches(); },
        error: (err) => this.toastService.error(err.error?.error ?? 'Error al eliminar'),
      });
  }

  // ── Colores ────────────────────────────────────────────────────────────────

  selectPaleta(paleta: { fondo: string; superficie: string; acento: string }): void {
    this.form.color_fondo = paleta.fondo;
    this.form.color_superficie = paleta.superficie;
    this.form.color_acento = paleta.acento;
    this.actualizarContraste();
  }

  onCustomColorChange(): void { this.actualizarContraste(); }

  aplicarSugerenciaContraste(): void {
    this.form.color_acento = this.sugerenciaContraste;
    this.actualizarContraste();
  }

  getPaletasPorGrupo(grupo: string) {
    return this.paletas.filter((p) => p.grupo === grupo);
  }

  getMensajeContraste(ratio: number, passAA: boolean, passAALarge: boolean): string {
    if (passAA) return 'Perfecto';
    if (passAALarge) return 'Solo para textos grandes';
    if (ratio >= 2) return 'Difícil de leer';
    return 'Muy difícil de leer';
  }

  esOscuro(hex: string): boolean {
    if (!hex) return true;
    return this.getLuminancia(hex) < 0.179;
  }

  getRatioContraste(hex1: string, hex2: string): number {
    const l1 = this.getLuminancia(hex1);
    const l2 = this.getLuminancia(hex2);
    const lighter = Math.max(l1, l2);
    const darker  = Math.min(l1, l2);
    return Math.round(((lighter + 0.05) / (darker + 0.05)) * 10) / 10;
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private validateAsset(file: File): boolean {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      this.toastService.error('Solo se permiten imágenes JPG, PNG o WEBP');
      return false;
    }
    if (file.size > MAX_ASSET_SIZE_MB * 1024 * 1024) {
      this.toastService.error(`La imagen no puede superar ${MAX_ASSET_SIZE_MB}MB`);
      return false;
    }
    return true;
  }

  private getEffectivePlanId(): SubscriptionPlan {
    return (this.plan() as SubscriptionPlan) ?? 'starter';
  }

  private formatSubscriptionDate(date: string): string {
    return new Date(date).toLocaleDateString('es-UY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private buildSubscriptionPayer(): SubscriptionPayerInput | null {
    const firstName = this.payerForm.firstName.trim();
    const lastName = this.payerForm.lastName.trim();
    const email = this.payerForm.email.trim().toLowerCase();

    if (!firstName || !lastName || !email) {
      this.toastService.error('Completá nombre, apellido y email para continuar con el pago.');
      return null;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      this.toastService.error('Ingresá un email válido para el checkout.');
      return null;
    }

    return { firstName, lastName, email };
  }

  private extractFirstName(fullName: string | null | undefined): string {
    return fullName?.trim().split(/\s+/)[0] ?? '';
  }

  private extractLastName(fullName: string | null | undefined): string {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    return parts.slice(1).join(' ');
  }

  private refreshSubscriptionState(): void {
    this.subscriptionService.getState().subscribe({
      next: (state) => {
        this.subscription.set(state.activeSubscription);
        this.pendingSubscription.set(state.pendingSubscription);
      },
    });
  }

  private refreshBusinessState(): void {
    // Refresca el BusinessStatusService — única fuente de verdad para plan y trial
    this.statusService.refresh().subscribe();
  }

  private scheduleCheckoutConfirmationRefresh(attempt = 0): void {
    if (attempt >= 6) return;
    window.setTimeout(() => {
      this.refreshSubscriptionState();
      this.refreshBusinessState();
      if (this.pendingSubscription()) {
        this.scheduleCheckoutConfirmationRefresh(attempt + 1);
      }
    }, 3000);
  }

  private actualizarContraste(): void {
    const checks = this.buildChecks();
    this.fondoEsOscuro = this.esOscuro(this.form.color_fondo);
    this.contrastChecksCriticos = this.fondoEsOscuro
      ? checks.filter((c) => c.par === 'Acento sobre fondo')
      : checks.filter((c) => ['Acento sobre crema', 'Acento sobre blanco'].includes(c.par));
    this.contrastWarning = this.contrastChecksCriticos.some((c) => !c.passAA);
    this.sugerenciaContraste = this.contrastWarning ? this.calcularSugerencia() : '';
  }

  private buildChecks(): ContrastCheck[] {
    const f = this.form.color_fondo;
    const a = this.form.color_acento;
    const check = (par: string, c1: string, c2: string): ContrastCheck => {
      const ratio = this.getRatioContraste(c1, c2);
      return { par, color1: c1, color2: c2, ratio, passAA: ratio >= 4.5, passAALarge: ratio >= 3.0, passAAA: ratio >= 7.0 };
    };
    return [
      check('Acento sobre fondo',  f,         a),
      check('Acento sobre crema',  '#F5F2EC', a),
      check('Acento sobre blanco', '#FFFFFF',  a),
    ];
  }

  private calcularSugerencia(): string {
    const fondoEsOscuro = this.esOscuro(this.form.color_fondo);
    const objetivo = fondoEsOscuro ? this.form.color_fondo : '#FFFFFF';
    return this.ajustarHastaContraste(this.form.color_acento, objetivo, 4.5, fondoEsOscuro);
  }

  private ajustarHastaContraste(hex: string, fondo: string, ratioObjetivo: number, fondoEsOscuro: boolean): string {
    const expanded = this.expandirHex(hex);
    let r = parseInt(expanded.slice(1, 3), 16);
    let g = parseInt(expanded.slice(3, 5), 16);
    let b = parseInt(expanded.slice(5, 7), 16);
    const factor = fondoEsOscuro ? 1.1 : 0.9;
    for (let i = 0; i < 40; i++) {
      const actual = '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
      if (this.getRatioContraste(actual, fondo) >= ratioObjetivo) return actual;
      if (fondoEsOscuro && r >= 250 && g >= 250 && b >= 250) break;
      if (!fondoEsOscuro && r <= 5 && g <= 5 && b <= 5) break;
      r = Math.round(Math.min(255, Math.max(0, r * factor)));
      g = Math.round(Math.min(255, Math.max(0, g * factor)));
      b = Math.round(Math.min(255, Math.max(0, b * factor)));
    }
    return fondoEsOscuro ? '#F5F2EC' : '#1C1C1E';
  }

  private expandirHex(hex: string): string {
    if (!hex) return '#000000';
    const h = hex.replace('#', '');
    if (h.length === 3) return '#' + h.split('').map((c) => c + c).join('');
    if (h.length === 6) return '#' + h;
    return '#000000';
  }

  private getLuminancia(hex: string): number {
    const expanded = this.expandirHex(hex);
    const r = parseInt(expanded.slice(1, 3), 16) / 255;
    const g = parseInt(expanded.slice(3, 5), 16) / 255;
    const b = parseInt(expanded.slice(5, 7), 16) / 255;
    const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  }

}
