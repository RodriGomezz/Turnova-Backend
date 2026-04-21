"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const router_1 = require("@angular/router");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const rxjs_interop_1 = require("@angular/core/rxjs-interop");
const core_2 = require("@angular/core");
const business_service_1 = require("../../../core/services/business.service");
const business_status_service_1 = require("../../../core/services/business-status.service");
const storage_service_1 = require("../../../core/services/storage.service");
const auth_service_1 = require("../../../core/services/auth.service");
const toast_service_1 = require("../../../core/services/toast.service");
const terminology_service_1 = require("../../../core/services/terminology.service");
const domain_service_1 = require("../../../core/services/domain.service");
const subscription_service_1 = require("../../../core/services/subscription.service");
const environment_1 = require("../../../../environments/environment");
const common_1 = require("@angular/common");
const rxjs_2 = require("rxjs");
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_ASSET_SIZE_MB = 2;
let Config = (() => {
    let _classDecorators = [(0, core_1.Component)({
            selector: 'app-config',
            standalone: true,
            imports: [forms_1.FormsModule, common_1.TitleCasePipe],
            templateUrl: './config.html',
            styleUrl: './config.scss',
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var Config = _classThis = class {
        constructor() {
            this.businessService = (0, core_1.inject)(business_service_1.BusinessService);
            this.statusService = (0, core_1.inject)(business_status_service_1.BusinessStatusService);
            this.storageService = (0, core_1.inject)(storage_service_1.StorageService);
            this.authService = (0, core_1.inject)(auth_service_1.AuthService);
            this.toastService = (0, core_1.inject)(toast_service_1.ToastService);
            this.terminologyService = (0, core_1.inject)(terminology_service_1.TerminologyService);
            this.domainService = (0, core_1.inject)(domain_service_1.DomainService);
            this.subscriptionService = (0, core_1.inject)(subscription_service_1.SubscriptionService);
            this.route = (0, core_1.inject)(router_1.ActivatedRoute);
            this.destroyRef = (0, core_1.inject)(core_2.DestroyRef);
            this.loading = (0, core_1.signal)(true);
            this.saving = (0, core_1.signal)(false);
            this.savingAccount = (0, core_1.signal)(false);
            this.uploadingLogo = (0, core_1.signal)(false);
            this.uploadingHero = (0, core_1.signal)(false);
            this.logoPreview = (0, core_1.signal)(null);
            this.heroPreview = (0, core_1.signal)(null);
            this.accountEmail = (0, core_1.signal)('');
            this.activeTab = (0, core_1.signal)('negocio');
            this.slug = (0, core_1.signal)('');
            // plan y trialDaysLeft vienen del servicio central — única fuente de verdad
            this.plan = (0, core_1.computed)(() => this.statusService.business()?.plan ?? 'starter');
            this.trialDaysLeft = (0, core_1.computed)(() => this.statusService.trialDaysLeft());
            // ── Subscription signals ───────────────────────────────────────────────────
            this.subscription = (0, core_1.signal)(null);
            this.pendingSubscription = (0, core_1.signal)(null);
            this.subscribing = (0, core_1.signal)(null);
            this.confirmingCancel = (0, core_1.signal)(false);
            this.canceling = (0, core_1.signal)(false);
            // ── Domain signals ─────────────────────────────────────────────────────────
            this.domainInput = (0, core_1.signal)('');
            this.domainStatus = (0, core_1.signal)(null);
            this.savingDomain = (0, core_1.signal)(false);
            this.removingDomain = (0, core_1.signal)(false);
            this.checkingDomain = (0, core_1.signal)(false);
            this.dnsInstructions = (0, core_1.signal)(null);
            this.confirmingRemove = (0, core_1.signal)(false);
            // ── Branches signals ───────────────────────────────────────────────────────
            this.branches = (0, core_1.signal)([]);
            this.confirmingDeactivate = (0, core_1.signal)(null);
            this.confirmingDelete = (0, core_1.signal)(null);
            this.processingBranch = (0, core_1.signal)(false);
            this.savingBranch = (0, core_1.signal)(false);
            this.businessId = '';
            this.originalLogoUrl = null;
            this.form = {
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
            this.accountForm = { nombre: '', password: '', passwordConfirm: '' };
            this.payerForm = { firstName: '', lastName: '', email: '' };
            this.branchForm = { nombre: '', slug: '' };
            // ── Opciones estáticas ─────────────────────────────────────────────────────
            this.paletas = [
                { nombre: 'Carbón + Oro', grupo: 'Oscuro · Premium', fondo: '#0A0A0A', superficie: '#1C1C1E', acento: '#C9A84C' },
                { nombre: 'Medianoche + Marfil', grupo: 'Oscuro · Premium', fondo: '#1A1A2E', superficie: '#16213E', acento: '#E8D5B7' },
                { nombre: 'Espresso + Ámbar', grupo: 'Oscuro · Premium', fondo: '#2C1810', superficie: '#3D2218', acento: '#D4954A' },
                { nombre: 'Hielo + Marino', grupo: 'Fresco · Moderno', fondo: '#F0F4FF', superficie: '#FFFFFF', acento: '#1A3A6B' },
                { nombre: 'Blanco + Negro', grupo: 'Fresco · Moderno', fondo: '#F5F5F5', superficie: '#FFFFFF', acento: '#111111' },
                { nombre: 'Menta + Bosque', grupo: 'Fresco · Moderno', fondo: '#F0FBF4', superficie: '#FFFFFF', acento: '#1A4731' },
                { nombre: 'Fuego + Carbón', grupo: 'Energético · Urbano', fondo: '#FF4D1C', superficie: '#FF6B3D', acento: '#1A1A1A' },
                { nombre: 'Pitch + Verde', grupo: 'Energético · Urbano', fondo: '#0D0D0D', superficie: '#1A1A1A', acento: '#00A374' },
                { nombre: 'Índigo + Violeta', grupo: 'Energético · Urbano', fondo: '#1C1C3A', superficie: '#252548', acento: '#B065FF' },
                { nombre: 'Crema + Terracota', grupo: 'Cálido · Accesible', fondo: '#FFF8F0', superficie: '#FFFFFF', acento: '#B8431A' },
                { nombre: 'Rosa + Fucsia', grupo: 'Cálido · Accesible', fondo: '#FDF0F5', superficie: '#FFFFFF', acento: '#C2366B' },
                { nombre: 'Paper + Azul', grupo: 'Cálido · Accesible', fondo: '#F7F5F0', superficie: '#FFFFFF', acento: '#1A4FCC' },
            ];
            this.brandColors = [
                { nombre: 'Negro', hex: '#0A0A0A' }, { nombre: 'Acero', hex: '#1C1C1E' },
                { nombre: 'Oro', hex: '#C9A84C' }, { nombre: 'Crema', hex: '#F5F2EC' },
                { nombre: 'Pizarra', hex: '#6B7280' }, { nombre: 'Hueso', hex: '#E5E1D8' },
                { nombre: 'Verde', hex: '#22C55E' }, { nombre: 'Rojo', hex: '#EF4444' },
            ];
            this.tipografiaOptions = [
                { value: 'clasica', label: 'Clásica', fontFamily: "'Playfair Display', serif" },
                { value: 'moderna', label: 'Moderna', fontFamily: "'Inter', sans-serif" },
                { value: 'minimalista', label: 'Minimalista', fontFamily: "'DM Sans', sans-serif" },
                { value: 'bold', label: 'Bold', fontFamily: "'Montserrat', sans-serif" },
            ];
            this.estiloCardsOptions = [
                { value: 'destacado', label: 'Destacado' },
                { value: 'minimalista', label: 'Minimalista' },
                { value: 'oscuro', label: 'Oscuro' },
            ];
            this.planesDisponibles = [
                {
                    id: 'starter', nombre: 'Starter', precio: 590, destacado: false,
                    porDia: 'Menos de $20 por día.',
                    desc: 'Para el profesional independiente.',
                    features: [
                        { label: '1 profesional', incluido: true },
                        { label: 'Turnos ilimitados', incluido: true },
                        { label: 'Página propia con subdominio', incluido: true },
                        { label: 'Personalización colores y logo', incluido: true },
                        { label: 'Email de confirmación automático', incluido: true },
                        { label: 'Recordatorios automáticos', incluido: false },
                    ],
                },
                {
                    id: 'pro', nombre: 'Pro', precio: 1390, destacado: true,
                    porDia: 'Menos de $50 por día. Menos que un café.',
                    desc: 'Para el negocio que tiene equipo.',
                    features: [
                        { label: 'Hasta 5 profesionales', incluido: true },
                        { label: 'Turnos ilimitados', incluido: true },
                        { label: 'Todo lo del Starter', incluido: true },
                        { label: 'Recordatorios automáticos por email', incluido: true },
                        { label: 'Estadísticas completas', incluido: true },
                        { label: 'Bloqueo de fechas y horarios', incluido: true },
                    ],
                },
                {
                    id: 'business', nombre: 'Business', precio: 2290, destacado: false,
                    porDia: 'Para negocios con volumen.',
                    desc: 'Para cadenas y múltiples sucursales.',
                    features: [
                        { label: 'Profesionales ilimitados', incluido: true },
                        { label: 'Hasta 3 sucursales', incluido: true },
                        { label: 'Todo lo del Pro', incluido: true },
                        { label: 'Panel unificado', incluido: true },
                        { label: 'Soporte prioritario por WhatsApp', incluido: true },
                        { label: 'Onboarding personalizado', incluido: true },
                    ],
                },
            ];
            // ── Contraste ──────────────────────────────────────────────────────────────
            this.contrastWarning = false;
            this.fondoEsOscuro = false;
            this.sugerenciaContraste = '';
            this.contrastChecksCriticos = [];
            // ── Computeds ──────────────────────────────────────────────────────────────
            this.trialActivo = (0, core_1.computed)(() => this.trialDaysLeft() !== null && this.trialDaysLeft() > 0);
            this.subscriptionStatusLabel = (0, core_1.computed)(() => {
                const s = this.subscription();
                if (!s)
                    return '';
                const labels = {
                    active: 'Activa',
                    past_due: 'Pago pendiente',
                    grace_period: 'Período de gracia',
                    canceled: 'Cancelada',
                    expired: 'Expirada',
                };
                return labels[s.status] ?? s.status;
            });
            this.pendingPlanLabel = (0, core_1.computed)(() => {
                const pending = this.pendingSubscription();
                if (!pending)
                    return '';
                const nombres = {
                    starter: 'Starter',
                    pro: 'Pro',
                    business: 'Business',
                };
                return nombres[pending.plan] ?? pending.plan;
            });
            this.gracePeriodEnd = (0, core_1.computed)(() => {
                const end = this.subscription()?.grace_period_ends_at;
                if (!end)
                    return null;
                return new Date(end).toLocaleDateString('es-UY', {
                    day: 'numeric', month: 'long', year: 'numeric',
                });
            });
            this.canUseCustomDomain = (0, core_1.computed)(() => (0, subscription_service_1.calcCanUseCustomDomain)(this.plan()));
            this.currentSubscriptionEyebrow = (0, core_1.computed)(() => {
                const subscription = this.subscription();
                if (!subscription)
                    return null;
                const labels = {
                    pending: 'Pago en confirmación',
                    active: 'Suscripción actual',
                    past_due: 'Pago pendiente',
                    grace_period: 'Período de gracia',
                    canceled: 'Cancelada al cierre del período',
                    expired: 'Expirada',
                };
                return labels[subscription.status] ?? 'Suscripción';
            });
            this.nextSubscriptionEventLabel = (0, core_1.computed)(() => {
                const subscription = this.subscription();
                if (!subscription?.current_period_end)
                    return null;
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
            this.canCancelCurrentSubscription = (0, core_1.computed)(() => {
                const subscription = this.subscription();
                return subscription?.status === 'active';
            });
        }
        get grupos() {
            return [...new Set(this.paletas.map((p) => p.grupo))];
        }
        get paletaActiva() {
            return (this.paletas.find((p) => p.fondo === this.form.color_fondo && p.acento === this.form.color_acento)?.nombre ?? 'personalizada');
        }
        get publicUrl() {
            if (environment_1.environment.production)
                return `${this.slug()}.${environment_1.environment.baseDomain}`;
            return `${this.slug()}.localhost:4200`;
        }
        get planNombre() {
            if (this.trialActivo())
                return 'Trial Pro';
            const nombres = { starter: 'Starter', pro: 'Pro', business: 'Business' };
            return nombres[this.plan()] ?? 'Starter';
        }
        get planLabel() {
            if (this.trialActivo())
                return `Acceso Pro completo por ${this.trialDaysLeft()} días más`;
            const labels = {
                starter: '$590/mes · 1 profesional · turnos ilimitados',
                pro: '$1.390/mes · 5 profesionales · todo incluido',
                business: '$2.290/mes · ilimitados · multi-sucursal',
            };
            return labels[this.plan()] ?? '';
        }
        get trialLabel() {
            const days = this.trialDaysLeft();
            if (days === null)
                return null;
            if (days <= 0)
                return 'Tu período de prueba venció — actualizá tu plan';
            if (days <= 7)
                return `Trial: quedan ${days} día${days !== 1 ? 's' : ''}`;
            return `Trial activo: ${days} días restantes`;
        }
        // ── Lifecycle ──────────────────────────────────────────────────────────────
        ngOnInit() {
            this.loading.set(true);
            (0, rxjs_1.forkJoin)({
                business: this.businessService.get(),
                user: this.authService.me(),
                domain: this.domainService.get(),
                subscriptionState: this.subscriptionService.getState().pipe((0, operators_1.catchError)(() => (0, rxjs_2.of)(null))),
            })
                .pipe((0, operators_1.finalize)(() => this.loading.set(false)))
                .subscribe({
                next: ({ business, user, domain, subscriptionState }) => {
                    this.businessId = business.id;
                    this.slug.set(business.slug);
                    this.originalLogoUrl = business.logo_url ?? null;
                    this.form = {
                        nombre: business.nombre ?? '',
                        email: business.email ?? '',
                        whatsapp: business.whatsapp ?? '',
                        direccion: business.direccion ?? '',
                        buffer_minutos: business.buffer_minutos ?? 0,
                        color_fondo: business.color_fondo ?? '#0A0A0A',
                        color_acento: business.color_acento ?? '#C9A84C',
                        color_superficie: business.color_superficie ?? '#1C1C1E',
                        logo_url: business.logo_url ?? null,
                        auto_confirmar: business.auto_confirmar ?? true,
                        frase_bienvenida: business.frase_bienvenida ?? '',
                        hero_imagen_url: business.hero_imagen_url ?? null,
                        instagram: business.instagram ?? '',
                        facebook: business.facebook ?? '',
                        tipografia: business.tipografia ?? 'clasica',
                        estilo_cards: business.estilo_cards ?? 'destacado',
                        termino_profesional: business.termino_profesional ?? 'Profesional',
                        termino_profesional_plural: business.termino_profesional_plural ?? 'Profesionales',
                        termino_servicio: business.termino_servicio ?? 'Servicio',
                        termino_reserva: business.termino_reserva ?? 'Turno',
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
                    this.pendingSubscription.set(subscriptionState?.pendingSubscription ?? null);
                    this.actualizarContraste();
                    if (this.statusService.isBusiness())
                        this.loadBranches();
                },
                error: () => this.toastService.error('Error al cargar la configuración'),
            });
            this.route.queryParams
                .pipe((0, rxjs_interop_1.takeUntilDestroyed)(this.destroyRef))
                .subscribe((params) => {
                if (params['tab'])
                    this.activeTab.set(params['tab']);
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
        loadBranches() {
            this.businessService.listUserBusinesses().subscribe({
                next: (businesses) => this.branches.set(businesses.filter((b) => !b.esPrincipal)),
                error: () => this.toastService.error('Error al cargar las sucursales'),
            });
        }
        // ── Tabs ───────────────────────────────────────────────────────────────────
        setTab(tab) {
            this.activeTab.set(tab);
        }
        // ── Save negocio ───────────────────────────────────────────────────────────
        save() {
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
                .pipe((0, operators_1.finalize)(() => this.saving.set(false)))
                .subscribe({
                next: () => {
                    this.originalLogoUrl = this.form.logo_url ?? null;
                    this.toastService.success('Cambios guardados correctamente');
                    this.terminologyService.update({
                        profesional: this.form.termino_profesional,
                        profesionalPlural: this.form.termino_profesional_plural,
                        servicio: this.form.termino_servicio,
                        reserva: this.form.termino_reserva,
                    });
                },
                error: (err) => this.toastService.error(err.error?.error ?? 'Error al guardar'),
            });
        }
        // ── Save cuenta ────────────────────────────────────────────────────────────
        saveAccount() {
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
            const payload = { nombre: this.accountForm.nombre };
            if (this.accountForm.password)
                payload.password = this.accountForm.password;
            this.authService
                .updateProfile(payload)
                .pipe((0, operators_1.finalize)(() => this.savingAccount.set(false)))
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
        solicitarPlan(p) {
            const payer = this.buildSubscriptionPayer();
            if (!payer)
                return;
            this.subscribing.set(p.id);
            this.subscriptionService
                .create(p.id, payer)
                .pipe((0, operators_1.finalize)(() => this.subscribing.set(null)))
                .subscribe({
                next: (checkoutUrl) => { window.location.href = checkoutUrl; },
                error: (err) => this.toastService.error(err.error?.error ?? 'Error al iniciar el pago'),
            });
        }
        isCurrentActivePlan(planId) {
            if (this.trialActivo() && !this.hasCurrentSubscription())
                return false;
            return this.getEffectivePlanId() === planId;
        }
        hasActiveSubscription() {
            return this.subscription()?.status === 'active';
        }
        hasCurrentSubscription() {
            return this.subscription() !== null;
        }
        hasPendingSubscription() {
            return this.pendingSubscription()?.status === 'pending';
        }
        isPendingPlan(planId) {
            return this.pendingSubscription()?.plan === planId;
        }
        cancelSubscription() {
            this.confirmingCancel.set(true);
        }
        confirmCancel() {
            this.canceling.set(true);
            this.confirmingCancel.set(false);
            this.subscriptionService
                .cancel()
                .pipe((0, operators_1.finalize)(() => this.canceling.set(false)))
                .subscribe({
                next: (res) => {
                    this.toastService.success(res.message);
                    this.refreshSubscriptionState();
                },
                error: (err) => this.toastService.error(err.error?.error ?? 'Error al cancelar'),
            });
        }
        closePlanModal() {
            this.confirmingCancel.set(false);
        }
        getWhatsappMsg(planNombre) {
            return encodeURIComponent(`Hola, soy ${this.form.nombre} y quiero actualizar al plan ${planNombre} de Turnio.`);
        }
        // ── Domain ─────────────────────────────────────────────────────────────────
        addDomain() {
            if (!this.canUseCustomDomain()) {
                this.toastService.error('Los dominios personalizados están disponibles en los planes Pro y Business.');
                return;
            }
            const domain = this.domainInput().trim().toLowerCase();
            if (!domain) {
                this.toastService.error('Ingresá un dominio');
                return;
            }
            this.savingDomain.set(true);
            this.domainService
                .add(domain)
                .pipe((0, operators_1.finalize)(() => this.savingDomain.set(false)))
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
        confirmRemoveDomain() { this.confirmingRemove.set(true); }
        cancelRemoveDomain() { this.confirmingRemove.set(false); }
        removeDomain() {
            this.removingDomain.set(true);
            this.domainService
                .remove()
                .pipe((0, operators_1.finalize)(() => { this.removingDomain.set(false); this.confirmingRemove.set(false); }))
                .subscribe({
                next: () => {
                    this.domainStatus.set({ custom_domain: null, domain_verified: false, domain_verified_at: null, domain_added_at: null });
                    this.dnsInstructions.set(null);
                    this.toastService.success('Dominio eliminado correctamente');
                },
                error: (err) => this.toastService.error(err.error?.error ?? 'Error al eliminar el dominio'),
            });
        }
        checkDomainStatus() {
            this.checkingDomain.set(true);
            this.domainService
                .checkStatus()
                .pipe((0, operators_1.finalize)(() => this.checkingDomain.set(false)))
                .subscribe({
                next: (res) => {
                    if (res.verified) {
                        this.domainStatus.update((s) => s ? { ...s, domain_verified: true } : s);
                        this.toastService.success('¡Dominio verificado correctamente!');
                    }
                    else {
                        this.toastService.info('El dominio aún no apunta a Turnio. Verificá tu configuración DNS.');
                    }
                },
                error: () => this.toastService.error('Error al verificar el dominio'),
            });
        }
        copyDomain() {
            const domain = this.domainStatus()?.custom_domain;
            if (!domain)
                return;
            navigator.clipboard.writeText(`https://${domain}`);
            this.toastService.success('Link copiado');
        }
        copyUrl() {
            navigator.clipboard.writeText(`https://${this.publicUrl}`);
            this.toastService.success('Link copiado');
        }
        // ── Upload logo ────────────────────────────────────────────────────────────
        onLogoSelected(event) {
            const file = event.target.files?.[0];
            if (!file || !this.validateAsset(file))
                return;
            const reader = new FileReader();
            reader.onload = () => this.logoPreview.set(reader.result);
            reader.readAsDataURL(file);
            this.uploadingLogo.set(true);
            this.storageService
                .uploadBusinessAsset(file, this.businessId, 'logo')
                .pipe((0, operators_1.finalize)(() => this.uploadingLogo.set(false)))
                .subscribe({
                next: (url) => { this.form.logo_url = url; },
                error: () => this.toastService.error('Error al subir el logo'),
            });
        }
        removeLogo() { this.logoPreview.set(null); this.form.logo_url = null; }
        onHeroSelected(event) {
            const file = event.target.files?.[0];
            if (!file || !this.validateAsset(file))
                return;
            this.uploadingHero.set(true);
            this.storageService
                .uploadBusinessAsset(file, this.businessId, 'hero')
                .pipe((0, operators_1.finalize)(() => this.uploadingHero.set(false)))
                .subscribe({
                next: (url) => { this.form.hero_imagen_url = url; this.heroPreview.set(`${url}?t=${Date.now()}`); },
                error: () => this.toastService.error('Error al subir la imagen'),
            });
        }
        removeHero() { this.heroPreview.set(null); this.form.hero_imagen_url = null; }
        // ── Sucursales ─────────────────────────────────────────────────────────────
        generateBranchSlug() {
            this.branchForm.slug = this.branchForm.nombre
                .toLowerCase().normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s-]/g, '').trim()
                .replace(/\s+/g, '-');
        }
        createBranch() {
            if (!this.branchForm.nombre.trim()) {
                this.toastService.error('El nombre es requerido');
                return;
            }
            if (!this.branchForm.slug.trim()) {
                this.toastService.error('El link es requerido');
                return;
            }
            this.savingBranch.set(true);
            this.authService
                .createBranch(this.branchForm.nombre, this.branchForm.slug)
                .pipe((0, operators_1.finalize)(() => this.savingBranch.set(false)))
                .subscribe({
                next: () => {
                    this.toastService.success('Sucursal creada correctamente');
                    this.branchForm = { nombre: '', slug: '' };
                    this.authService.me().subscribe({
                        next: () => this.branches.set((this.authService.availableBusinesses() ?? []).filter((b) => b.id !== this.businessId)),
                    });
                },
                error: (err) => this.toastService.error(err.error?.error ?? 'Error al crear la sucursal'),
            });
        }
        deactivateBranch(id) {
            this.processingBranch.set(true);
            this.businessService.deactivateBranch(id)
                .pipe((0, operators_1.finalize)(() => { this.processingBranch.set(false); this.confirmingDeactivate.set(null); }))
                .subscribe({
                next: () => { this.toastService.success('Sucursal desactivada'); this.loadBranches(); },
                error: (err) => this.toastService.error(err.error?.error ?? 'Error al desactivar'),
            });
        }
        reactivateBranch(id) {
            this.processingBranch.set(true);
            this.businessService.reactivateBranch(id)
                .pipe((0, operators_1.finalize)(() => this.processingBranch.set(false)))
                .subscribe({
                next: () => { this.toastService.success('Sucursal reactivada'); this.loadBranches(); },
                error: (err) => this.toastService.error(err.error?.error ?? 'Error al reactivar'),
            });
        }
        deleteBranch(id) {
            this.processingBranch.set(true);
            this.businessService.deleteBranch(id)
                .pipe((0, operators_1.finalize)(() => { this.processingBranch.set(false); this.confirmingDelete.set(null); }))
                .subscribe({
                next: () => { this.toastService.success('Sucursal eliminada permanentemente'); this.loadBranches(); },
                error: (err) => this.toastService.error(err.error?.error ?? 'Error al eliminar'),
            });
        }
        // ── Colores ────────────────────────────────────────────────────────────────
        selectPaleta(paleta) {
            this.form.color_fondo = paleta.fondo;
            this.form.color_superficie = paleta.superficie;
            this.form.color_acento = paleta.acento;
            this.actualizarContraste();
        }
        onCustomColorChange() { this.actualizarContraste(); }
        aplicarSugerenciaContraste() {
            this.form.color_acento = this.sugerenciaContraste;
            this.actualizarContraste();
        }
        getPaletasPorGrupo(grupo) {
            return this.paletas.filter((p) => p.grupo === grupo);
        }
        getMensajeContraste(ratio, passAA, passAALarge) {
            if (passAA)
                return 'Perfecto';
            if (passAALarge)
                return 'Solo para textos grandes';
            if (ratio >= 2)
                return 'Difícil de leer';
            return 'Muy difícil de leer';
        }
        esOscuro(hex) {
            if (!hex)
                return true;
            return this.getLuminancia(hex) < 0.179;
        }
        getRatioContraste(hex1, hex2) {
            const l1 = this.getLuminancia(hex1);
            const l2 = this.getLuminancia(hex2);
            const lighter = Math.max(l1, l2);
            const darker = Math.min(l1, l2);
            return Math.round(((lighter + 0.05) / (darker + 0.05)) * 10) / 10;
        }
        // ── Helpers privados ───────────────────────────────────────────────────────
        validateAsset(file) {
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
        getEffectivePlanId() {
            return this.plan() ?? 'starter';
        }
        formatSubscriptionDate(date) {
            return new Date(date).toLocaleDateString('es-UY', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        }
        buildSubscriptionPayer() {
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
        extractFirstName(fullName) {
            return fullName?.trim().split(/\s+/)[0] ?? '';
        }
        extractLastName(fullName) {
            if (!fullName)
                return '';
            const parts = fullName.trim().split(/\s+/);
            return parts.slice(1).join(' ');
        }
        refreshSubscriptionState() {
            this.subscriptionService.getState().subscribe({
                next: (state) => {
                    this.subscription.set(state.activeSubscription);
                    this.pendingSubscription.set(state.pendingSubscription);
                },
            });
        }
        refreshBusinessState() {
            // Refresca el BusinessStatusService — única fuente de verdad para plan y trial
            this.statusService.refresh().subscribe();
        }
        scheduleCheckoutConfirmationRefresh(attempt = 0) {
            if (attempt >= 6)
                return;
            window.setTimeout(() => {
                this.refreshSubscriptionState();
                this.refreshBusinessState();
                if (this.pendingSubscription()) {
                    this.scheduleCheckoutConfirmationRefresh(attempt + 1);
                }
            }, 3000);
        }
        actualizarContraste() {
            const checks = this.buildChecks();
            this.fondoEsOscuro = this.esOscuro(this.form.color_fondo);
            this.contrastChecksCriticos = this.fondoEsOscuro
                ? checks.filter((c) => c.par === 'Acento sobre fondo')
                : checks.filter((c) => ['Acento sobre crema', 'Acento sobre blanco'].includes(c.par));
            this.contrastWarning = this.contrastChecksCriticos.some((c) => !c.passAA);
            this.sugerenciaContraste = this.contrastWarning ? this.calcularSugerencia() : '';
        }
        buildChecks() {
            const f = this.form.color_fondo;
            const a = this.form.color_acento;
            const check = (par, c1, c2) => {
                const ratio = this.getRatioContraste(c1, c2);
                return { par, color1: c1, color2: c2, ratio, passAA: ratio >= 4.5, passAALarge: ratio >= 3.0, passAAA: ratio >= 7.0 };
            };
            return [
                check('Acento sobre fondo', f, a),
                check('Acento sobre crema', '#F5F2EC', a),
                check('Acento sobre blanco', '#FFFFFF', a),
            ];
        }
        calcularSugerencia() {
            const fondoEsOscuro = this.esOscuro(this.form.color_fondo);
            const objetivo = fondoEsOscuro ? this.form.color_fondo : '#FFFFFF';
            return this.ajustarHastaContraste(this.form.color_acento, objetivo, 4.5, fondoEsOscuro);
        }
        ajustarHastaContraste(hex, fondo, ratioObjetivo, fondoEsOscuro) {
            const expanded = this.expandirHex(hex);
            let r = parseInt(expanded.slice(1, 3), 16);
            let g = parseInt(expanded.slice(3, 5), 16);
            let b = parseInt(expanded.slice(5, 7), 16);
            const factor = fondoEsOscuro ? 1.1 : 0.9;
            for (let i = 0; i < 40; i++) {
                const actual = '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
                if (this.getRatioContraste(actual, fondo) >= ratioObjetivo)
                    return actual;
                if (fondoEsOscuro && r >= 250 && g >= 250 && b >= 250)
                    break;
                if (!fondoEsOscuro && r <= 5 && g <= 5 && b <= 5)
                    break;
                r = Math.round(Math.min(255, Math.max(0, r * factor)));
                g = Math.round(Math.min(255, Math.max(0, g * factor)));
                b = Math.round(Math.min(255, Math.max(0, b * factor)));
            }
            return fondoEsOscuro ? '#F5F2EC' : '#1C1C1E';
        }
        expandirHex(hex) {
            if (!hex)
                return '#000000';
            const h = hex.replace('#', '');
            if (h.length === 3)
                return '#' + h.split('').map((c) => c + c).join('');
            if (h.length === 6)
                return '#' + h;
            return '#000000';
        }
        getLuminancia(hex) {
            const expanded = this.expandirHex(hex);
            const r = parseInt(expanded.slice(1, 3), 16) / 255;
            const g = parseInt(expanded.slice(3, 5), 16) / 255;
            const b = parseInt(expanded.slice(5, 7), 16) / 255;
            const toLinear = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
        }
    };
    __setFunctionName(_classThis, "Config");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Config = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Config = _classThis;
})();
exports.Config = Config;
//# sourceMappingURL=config.js.map