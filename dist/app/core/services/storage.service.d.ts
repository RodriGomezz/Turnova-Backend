import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
export declare class StorageService {
    private readonly http;
    private readonly api;
    constructor(http: HttpClient);
    uploadBarberPhoto(file: File, barberId: string): Observable<string>;
    deleteBarberPhoto(barberId: string): Observable<void>;
    uploadBusinessAsset(file: File, businessId: string, type: 'logo' | 'hero'): Observable<string>;
    deleteBusinessAsset(businessId: string, type: 'logo' | 'hero'): Observable<void>;
}
//# sourceMappingURL=storage.service.d.ts.map