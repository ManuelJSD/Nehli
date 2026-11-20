import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environments } from 'src/environments/environments';

export interface Invite {
  id: string;
  email: string;
  expiresAt: string;
}

export interface CategoryPolicy {
  pending: boolean;
  deniedCategories: string[];
}

export interface AccessSettings {
  approvalRequired: boolean;
  categories: string[];
  accounts: Partial<Record<number, CategoryPolicy>>;
}

@Injectable({ providedIn: 'root' })
export class AccountAccessService {
  private readonly url = environments.baseURL + '/api/account-access';

  constructor(private http: HttpClient) {}

  settings() { return this.http.get<AccessSettings>(environments.baseURL + '/api/access/settings'); }
  setApproval(approvalRequired: boolean) {
    return this.http.put<void>(environments.baseURL + '/api/access/settings', { approvalRequired });
  }
  updatePolicy(id: number, policy: Partial<CategoryPolicy>) {
    return this.http.patch<void>(environments.baseURL + '/api/access/accounts/' + id, policy);
  }

  listInvites() { return this.http.get<Invite[]>(this.url + '/invites'); }
  invite(email: string) { return this.http.post<{ token: string }>(this.url + '/invites', { email }); }
  revoke(id: string) { return this.http.delete<void>(this.url + '/invites/' + encodeURIComponent(id)); }
  requestReset(email: string) { return this.http.post<void>(this.url + '/request-reset', { email }); }
  reset(token: string, password: string, passwordConfirmation: string) {
    return this.http.post<void>(this.url + '/reset', { token, password, passwordConfirmation });
  }
}
