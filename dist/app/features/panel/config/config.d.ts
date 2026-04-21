import { OnInit } from '@angular/core';
type ActiveTab = 'negocio' | 'apariencia' | 'pagina' | 'cuenta' | 'planes' | 'sucursales';
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
export declare class Config implements OnInit {
    private readonly businessService;
    private readonly statusService;
    private readonly storageService;
    private readonly authService;
    private readonly toastService;
    private readonly terminologyService;
    private readonly domainService;
    private readonly subscriptionService;
    private readonly route;
    private readonly destroyRef;
    readonly loading: any;
    readonly saving: any;
    readonly savingAccount: any;
    readonly uploadingLogo: any;
    readonly uploadingHero: any;
    readonly logoPreview: any;
    readonly heroPreview: any;
    readonly accountEmail: any;
    readonly activeTab: any;
    readonly slug: any;
    readonly plan: any;
    readonly trialDaysLeft: any;
    readonly subscription: any;
    readonly pendingSubscription: any;
    readonly subscribing: any;
    readonly confirmingCancel: any;
    readonly canceling: any;
    readonly domainInput: any;
    readonly domainStatus: any;
    readonly savingDomain: any;
    readonly removingDomain: any;
    readonly checkingDomain: any;
    readonly dnsInstructions: any;
    readonly confirmingRemove: any;
    readonly branches: any;
    readonly confirmingDeactivate: any;
    readonly confirmingDelete: any;
    readonly processingBranch: any;
    readonly savingBranch: any;
    private businessId;
    private originalLogoUrl;
    form: BusinessForm;
    accountForm: AccountForm;
    payerForm: SubscriptionPayerForm;
    branchForm: {
        nombre: string;
        slug: string;
    };
    readonly paletas: {
        nombre: string;
        grupo: string;
        fondo: string;
        superficie: string;
        acento: string;
    }[];
    readonly brandColors: {
        nombre: string;
        hex: string;
    }[];
    readonly tipografiaOptions: readonly [{
        readonly value: "clasica";
        readonly label: "Clásica";
        readonly fontFamily: "'Playfair Display', serif";
    }, {
        readonly value: "moderna";
        readonly label: "Moderna";
        readonly fontFamily: "'Inter', sans-serif";
    }, {
        readonly value: "minimalista";
        readonly label: "Minimalista";
        readonly fontFamily: "'DM Sans', sans-serif";
    }, {
        readonly value: "bold";
        readonly label: "Bold";
        readonly fontFamily: "'Montserrat', sans-serif";
    }];
    readonly estiloCardsOptions: readonly [{
        readonly value: "destacado";
        readonly label: "Destacado";
    }, {
        readonly value: "minimalista";
        readonly label: "Minimalista";
    }, {
        readonly value: "oscuro";
        readonly label: "Oscuro";
    }];
    readonly planesDisponibles: {
        id: string;
        nombre: string;
        precio: number;
        destacado: boolean;
        porDia: string;
        desc: string;
        features: {
            label: string;
            incluido: boolean;
        }[];
    }[];
    contrastWarning: boolean;
    fondoEsOscuro: boolean;
    sugerenciaContraste: string;
    contrastChecksCriticos: ContrastCheck[];
    readonly trialActivo: any;
    readonly subscriptionStatusLabel: any;
    readonly pendingPlanLabel: any;
    readonly gracePeriodEnd: any;
    readonly canUseCustomDomain: any;
    readonly currentSubscriptionEyebrow: any;
    readonly nextSubscriptionEventLabel: any;
    readonly canCancelCurrentSubscription: any;
    get grupos(): string[];
    get paletaActiva(): string;
    get publicUrl(): string;
    get planNombre(): string;
    get planLabel(): string;
    get trialLabel(): string | null;
    ngOnInit(): void;
    private loadBranches;
    setTab(tab: ActiveTab): void;
    save(): void;
    saveAccount(): void;
    solicitarPlan(p: {
        id: string;
        nombre: string;
        precio: number;
    }): void;
    isCurrentActivePlan(planId: string): boolean;
    hasActiveSubscription(): boolean;
    hasCurrentSubscription(): boolean;
    hasPendingSubscription(): boolean;
    isPendingPlan(planId: string): boolean;
    cancelSubscription(): void;
    confirmCancel(): void;
    closePlanModal(): void;
    getWhatsappMsg(planNombre: string): string;
    addDomain(): void;
    confirmRemoveDomain(): void;
    cancelRemoveDomain(): void;
    removeDomain(): void;
    checkDomainStatus(): void;
    copyDomain(): void;
    copyUrl(): void;
    onLogoSelected(event: Event): void;
    removeLogo(): void;
    onHeroSelected(event: Event): void;
    removeHero(): void;
    generateBranchSlug(): void;
    createBranch(): void;
    deactivateBranch(id: string): void;
    reactivateBranch(id: string): void;
    deleteBranch(id: string): void;
    selectPaleta(paleta: {
        fondo: string;
        superficie: string;
        acento: string;
    }): void;
    onCustomColorChange(): void;
    aplicarSugerenciaContraste(): void;
    getPaletasPorGrupo(grupo: string): {
        nombre: string;
        grupo: string;
        fondo: string;
        superficie: string;
        acento: string;
    }[];
    getMensajeContraste(ratio: number, passAA: boolean, passAALarge: boolean): string;
    esOscuro(hex: string): boolean;
    getRatioContraste(hex1: string, hex2: string): number;
    private validateAsset;
    private getEffectivePlanId;
    private formatSubscriptionDate;
    private buildSubscriptionPayer;
    private extractFirstName;
    private extractLastName;
    private refreshSubscriptionState;
    private refreshBusinessState;
    private scheduleCheckoutConfirmationRefresh;
    private actualizarContraste;
    private buildChecks;
    private calcularSugerencia;
    private ajustarHastaContraste;
    private expandirHex;
    private getLuminancia;
}
export {};
//# sourceMappingURL=config.d.ts.map