import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DomainStatus {
  custom_domain: string | null;
  domain_verified: boolean;
  domain_verified_at: string | null;
  domain_added_at: string | null;
}

export interface DomainCheckResult {
  verified: boolean;
  configured: boolean;
  domain: string;
}

export interface DnsInstructions {
  type: string;
  name: string;
  value: string;
  note: string;
}

export interface AddDomainResponse {
  message: string;
  custom_domain: string;
  dns_instructions: DnsInstructions;
}

@Injectable({ providedIn: 'root' })
export class DomainService {
  private readonly api = environment.apiUrl;
  private readonly http = inject(HttpClient);

  get(): Observable<DomainStatus> {
    return this.http.get<DomainStatus>(`${this.api}/domain`);
  }

  add(domain: string): Observable<AddDomainResponse> {
    return this.http.post<AddDomainResponse>(`${this.api}/domain`, { domain });
  }

  remove(): Observable<void> {
    return this.http.delete<void>(`${this.api}/domain`);
  }

  checkStatus(): Observable<DomainCheckResult> {
    return this.http.get<DomainCheckResult>(`${this.api}/domain/status`);
  }
}
