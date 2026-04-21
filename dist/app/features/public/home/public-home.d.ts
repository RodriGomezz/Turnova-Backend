import { OnInit } from '@angular/core';
import { Service } from '../../../domain/models/service.model';
export declare class PublicHome implements OnInit {
    private readonly route;
    private readonly publicService;
    private readonly subdomainService;
    readonly business: any;
    readonly barbers: any;
    readonly services: any;
    readonly loading: any;
    readonly notFound: any;
    readonly slug: any;
    readonly colorTexto: any;
    readonly colorTextoSuave: any;
    readonly colorSuperficie: any;
    readonly colorSobreAccento: any;
    readonly heroImageUrl: any;
    readonly colorAcentoSobreSuperficie: any;
    readonly colorSeccionDark: any;
    readonly colorOnAcentoSobreSuperficie: any;
    readonly isDisponible: any;
    readonly reservarLink: any;
    readonly onDarkSection = "#F5F2EC";
    readonly onDarkSectionSoft = "rgba(245,242,236,0.6)";
    ngOnInit(): void;
    esOscuro(hex: string): boolean;
    formatPrecio(service: Service): string;
}
//# sourceMappingURL=public-home.d.ts.map