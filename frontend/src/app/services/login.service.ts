import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environments } from 'src/environments/environments';

@Injectable({
  providedIn: 'root'
})
export class LoginService {
  private apiUrl: string = environments.baseURL;
  private loginUrl = `${this.apiUrl}/api/auth/login`; // URL del endpoint de login en el backend
  private registroUrl = `${this.apiUrl}/api/auth/register`;

  constructor(private http: HttpClient, private router: Router) { }

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

  register(username: string, password: string, email: string) {
    return this.http.post<any>(this.registroUrl, {username, email, password})
      .pipe(
        tap(() => {
          this.router.navigate(['/welcome']);
        }),
        catchError(error => {
          // Manejar el error en caso de que ocurra.
          console.error('Ocurrió un error en el registro:', error);
          return throwError(error);
        })
      );
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {

    const token = this.getToken();

    //Comprobamos que el token tenga contenido.
    if (token == "undefined") {
      return false;
    }

    // Devuelve true si el token existe, de lo contrario devuelve false
    return !!this.getToken();
  }

  logout(): void {
    // Eliminar el token del localStorage
    localStorage.removeItem('token');
  }

}
