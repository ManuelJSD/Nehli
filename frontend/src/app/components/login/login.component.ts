import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoginService } from 'src/app/services/login.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  username: string = '';
  password: string = '';
  isLoading = false;
  loginError = false;
  errorMessage = '';

  constructor(private loginService: LoginService, private router: Router) { }

  onSubmit() {
    // Evitar envío si ya está cargando o campos vacíos
    if (this.isLoading || !this.username.trim() || !this.password.trim()) {
      return;
    }

    this.isLoading = true;
    this.loginError = false;

    this.loginService.login(this.username, this.password).subscribe({
      next: (response) => {
        if (response.data) {
          this.router.navigate(['/browser']);
        } else {
          this.loginError = true;
          this.errorMessage = 'El usuario o la contraseña son incorrectos.';
        }
        this.isLoading = false;
      },
      error: () => {
        this.loginError = true;
        this.errorMessage = 'Error en la solicitud al servidor. Inténtalo de nuevo.';
        this.isLoading = false;
      }
    });
  }
}
