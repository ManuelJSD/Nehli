import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environments } from 'src/environments/environments';

@Injectable({
  providedIn: 'root'
})
export class LoginService {
  private apiUrl: string = environments.baseURL;
  private loginUrl = `${this.apiUrl}/api/auth/login`; // URL del endpoint de login en el backend
  private registroUrl = `${this.apiUrl}/api/auth/register`;

  constructor(private http: HttpClient) { }

  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(this.loginUrl, { username, password })
      .pipe(
        catchError(error => {
          // Aquí puedes manejar el error de acuerdo a tus necesidades
          console.log('Error de servidor:', error);
          // Puedes lanzar un nuevo error para interrumpir el flujo y evitar que se ejecute localStorage.setItem
          return throwError(error);
        }),
        tap(response => {
          // Almacenar el token en el localStorage del navegador
          localStorage.setItem('token', response.data.token);
        })
      );
  }

  getRegistrationChallenge() {
    return this.http.get<{ id: string; image: string }>(this.registroUrl + '/challenge');
  }

  register(username: string, password: string, email: string, passwordConfirmation: string,
           challengeId: string, challengeAnswer: string, invitation: string) {
    return this.http.post<any>(this.registroUrl, { username, email, password, passwordConfirmation, challengeId, challengeAnswer, invitation })
      .pipe(
        catchError(error => {
          // Manejar el error en caso de que ocurra.
          console.error('Ocurrió un error en el registro:', error);
          return throwError(error);
        })
      );
  }

  getProfile() {
    return this.http.get<{ username: string; email: string }>(this.apiUrl + '/api/auth/profile');
  }

  updateProfile(profile: { username: string; email: string; currentPassword: string;
                           newPassword?: string; passwordConfirmation?: string }) {
    return this.http.put<{ username: string; email: string; token: string }>(this.apiUrl + '/api/auth/profile', profile)
      .pipe(tap(response => localStorage.setItem('token', response.token)));
  }

  get username(): string {
    return this.sessionPayload()?.username || '';
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  get accountId(): number | undefined {
    return this.sessionPayload()?.id;
  }

  private sessionPayload(): { id?: number; exp: number; username?: string; role?: string } | undefined {
    try {
      const payload = this.getToken()?.split('.')[1];
      if (!payload) return;
      const bytes = Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), value => value.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return undefined;
    }
  }

  isLoggedIn(): boolean {
    const payload = this.sessionPayload();
    if (!payload) return false;
    if (Date.now() >= payload.exp * 1000) {
      this.logout();
      return false;
    }
    return true;
  }

  isAdmin(): boolean {
    return this.sessionPayload()?.role === 'admin';
  }

  logout(): void {
    // Eliminar el token del localStorage
    localStorage.removeItem('token');
    this.http.post<void>(this.apiUrl + '/api/access/logout', {}, { withCredentials: true }).subscribe({ error: () => {} });
  }

}
