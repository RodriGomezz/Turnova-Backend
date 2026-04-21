import { OnInit } from '@angular/core';
export declare class Panel implements OnInit {
    private readonly authService;
    private readonly terminologyService;
    private readonly toastService;
    private readonly businessService;
    readonly statusService: any;
    readonly sidebarOpen: any;
    readonly mobileSidebarOpen: any;
    readonly showLabels: any;
    readonly isPro: any;
    readonly allNavItems: any;
    readonly navItems: any;
    readonly availableBusinesses: any;
    readonly currentBusiness: any;
    readonly hasMultipleBusinesses: any;
    ngOnInit(): void;
    toggleSidebar(): void;
    openMobileSidebar(): void;
    closeMobileSidebar(): void;
    onEscape(): void;
    logout(): void;
    switchBusiness(businessId: string): void;
}
//# sourceMappingURL=panel.d.ts.map