import { OnInit } from '@angular/core';
export declare class Confirm implements OnInit {
    private readonly route;
    private readonly publicService;
    private readonly subdomainService;
    readonly slug: any;
    readonly nombre: any;
    readonly fecha: any;
    readonly hora: any;
    readonly servicio: any;
    readonly barbero: any;
    readonly estado: any;
    readonly business: any;
    readonly homeLink: () => any;
    readonly reservarLink: () => any;
    ngOnInit(): void;
    formatFecha(fecha: string): string;
}
//# sourceMappingURL=confirm.d.ts.map