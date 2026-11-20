import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { defer, switchMap } from 'rxjs';
import { WatchProgress } from '../interfaces/video.interface';
import { LoginService } from './login.service';
import { environments } from 'src/environments/environments';

@Injectable({ providedIn: 'root' })
export class WatchProgressService {
  private readonly url = environments.baseURL + '/api/progress';

  private readonly pending = new Set<Promise<boolean>>();

  constructor(private http: HttpClient, private login: LoginService) {}

  list() {
    return defer(() => Promise.all(this.pending)).pipe(switchMap(() => this.http.get<WatchProgress[]>(this.url)));
  }

  watched(category: string, title: string) {
    return this.http.get<string[]>(this.url + '/series', { params: { category, title } });
  }

  mark(category: string, title: string, path: string, completed: boolean) {
    return this.http.patch<void>(this.url + '/series', { path, completed }, { params: { category, title } });
  }

  get(path: string) {
    return this.http.get<WatchProgress | null>(this.url, { params: { path } });
  }

  save(progress: WatchProgress, observedAt: number): Promise<boolean> {
    const request = this.send(progress, observedAt);
    this.pending.add(request);
    void request.finally(() => this.pending.delete(request));
    return request;
  }

  private async send(progress: WatchProgress, observedAt: number): Promise<boolean> {
    try {
      const token = this.login.getToken();
      if (!token) return false;
      const response = await fetch(this.url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ ...progress, observedAt }),
        keepalive: true,
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
