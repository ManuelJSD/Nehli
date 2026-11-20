import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environments } from 'src/environments/environments';

export type AccountRole = 'admin' | 'user';

export interface AdminAccount {
  id: number;
  username: string;
  role: AccountRole;
  createdAt: string;
}

export type ReviewIssue = 'synopsis' | 'cover' | 'match' | 'pending';

export interface ReviewEntry {
  category: string;
  title: string;
  issues: ReviewIssue[];
}

export interface CatalogReview {
  total: number;
  entries: ReviewEntry[];
}

export interface ScanStatus {
  lastScan: number | null;
  files: number;
  added: number;
  failed: boolean;
  available: boolean;
  scanning: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly url = environments.baseURL + '/api/auth';

  constructor(private http: HttpClient) {}

  scanStatus() { return this.http.get<Record<'video' | 'music', ScanStatus>>(environments.baseURL + '/api/access/scans'); }
  startScan(kind: 'video' | 'music') { return this.http.post(environments.baseURL + '/api/access/scans/' + kind, {}); }

  listAccounts() {
    return this.http.get<{ data: AdminAccount[] }>(this.url + '/listar');
  }

  getCatalogReview() {
    return this.http.get<CatalogReview>(environments.baseURL + '/api/video/review');
  }

  updateRole(id: number, role: AccountRole) {
    return this.http.patch<void>(this.url + '/accounts/' + id + '/role', { role });
  }
}
