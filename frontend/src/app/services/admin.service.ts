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

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly url = environments.baseURL + '/api/auth';

  constructor(private http: HttpClient) {}

  listAccounts() {
    return this.http.get<{ data: AdminAccount[] }>(this.url + '/listar');
  }

  updateRole(id: number, role: AccountRole) {
    return this.http.patch<void>(this.url + '/accounts/' + id + '/role', { role });
  }
}
