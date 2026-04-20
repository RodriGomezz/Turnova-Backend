import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

interface UploadResponse {
  url: string;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly api = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  uploadBarberPhoto(file: File, barberId: string): Observable<string> {
    const formData = new FormData();
    formData.append('photo', file);
    return this.http
      .post<UploadResponse>(
        `${this.api}/upload/barber-photo/${barberId}`,
        formData,
      )
      .pipe(map((res) => res.url));
  }

  deleteBarberPhoto(barberId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.api}/upload/barber-photo/${barberId}`,
    );
  }

  uploadBusinessAsset(
    file: File,
    businessId: string,
    type: 'logo' | 'hero',
  ): Observable<string> {
    const formData = new FormData();
    formData.append('photo', file);
    return this.http
      .post<UploadResponse>(
        `${this.api}/upload/business/${businessId}/${type}`,
        formData,
      )
      .pipe(map((res) => res.url));
  }

  deleteBusinessAsset(
    businessId: string,
    type: 'logo' | 'hero',
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.api}/upload/business/${businessId}/${type}`,
    );
  }
}
