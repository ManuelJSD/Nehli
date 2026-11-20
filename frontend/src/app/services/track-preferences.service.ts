import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { defer, firstValueFrom, switchMap, timeout } from 'rxjs';
import { TrackPreferences } from '../interfaces/track-preferences';
import { LoginService } from './login.service';
import { environments } from 'src/environments/environments';

@Injectable({ providedIn: 'root' })
export class TrackPreferencesService {
  private readonly url = environments.baseURL + '/api/preferences';
  private readonly pending = new Map<string, Promise<boolean>>();

  constructor(private http: HttpClient, private login: LoginService) {}

  get(category: string, title: string) {
    return defer(() => Promise.all([
      this.pending.get(this.key(category, title, 'audio')),
      this.pending.get(this.key(category, title, 'subtitle'))
    ])).pipe(switchMap(() => this.http.get<TrackPreferences>(this.url, { params: { category, title } })));
  }

  save<K extends keyof TrackPreferences>(category: string, title: string, kind: K,
                                         preference: NonNullable<TrackPreferences[K]>): Promise<boolean> {
    const token = this.login.getToken();
    const key = this.key(category, title, kind);
    const previous = this.pending.get(key) ?? Promise.resolve(true);
    const request = previous.then(() => {
      if (!token || this.login.getToken() !== token) return false;
      return firstValueFrom(this.http.put<void>(this.url, { kind, preference }, {
        params: { category, title }
      }).pipe(timeout(5000))).then(() => true, () => false);
    });
    this.pending.set(key, request);
    void request.then(() => {
      if (this.pending.get(key) === request) this.pending.delete(key);
    });
    return request;
  }

  private key(category: string, title: string, kind: keyof TrackPreferences): string {
    return JSON.stringify([this.login.accountId, category, title, kind]);
  }
}
