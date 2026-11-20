import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AccountAccessService } from '../../services/account-access.service';

@Component({
  selector: 'app-recovery',
  templateUrl: './recovery.component.html',
  styleUrls: ['../auth.css']
})
export class RecoveryComponent {
  readonly token = this.route.snapshot.fragment;
  readonly resetting = this.route.snapshot.routeConfig?.path === 'restablecer';
  email = '';
  password = '';
  confirmation = '';
  busy = false;
  message = '';
  error = '';

  constructor(private route: ActivatedRoute, private access: AccountAccessService) {}

  submit(): void {
    if (this.busy || this.message) return;
    if (this.resetting && this.password !== this.confirmation) {
      this.error = 'Las contraseñas deben coincidir.';
      return;
    }
    const request = this.resetting
      ? this.access.reset(this.token || '', this.password, this.confirmation)
      : this.access.requestReset(this.email);
    this.busy = true;
    this.error = '';
    request.subscribe({
      next: () => {
        this.busy = false;
        this.password = this.confirmation = '';
        this.message = this.resetting ? 'Contraseña actualizada. Ya puedes iniciar sesión.'
          : 'Si hay una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.';
      },
      error: response => {
        this.busy = false;
        this.error = response.error?.error || (response.status === 503
          ? 'La recuperación de contraseña aún no está configurada.' : 'No se pudo completar la solicitud.');
      }
    });
  }
}
