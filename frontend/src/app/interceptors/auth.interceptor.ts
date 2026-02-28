import { Injectable } from '@angular/core';
import {
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { LoginService } from '../services/login.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    constructor(private loginService: LoginService) { }

    intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        const token = this.loginService.getToken();

        // No inyectar token en rutas externas (ej: api.jikan.moe)
        // para evitar que rechacen la petición por CORS al detectar headers no permitidos 
        const isExternalUrl = request.url.startsWith('http') && !request.url.includes('localhost') && !request.url.includes('192.168.1.12');

        if (token && token !== 'undefined' && !isExternalUrl) {
            const cloned = request.clone({
                headers: request.headers.set('Authorization', `Bearer ${token}`)
            });
            return next.handle(cloned);
        }

        return next.handle(request);
    }
}
