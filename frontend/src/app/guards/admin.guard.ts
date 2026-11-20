import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { LoginService } from '../services/login.service';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private login: LoginService, private router: Router) {}

  canActivate() {
    if (!this.login.isLoggedIn()) return this.router.createUrlTree(['/login']);
    return this.login.isAdmin() || this.router.createUrlTree(['/browser']);
  }
}
