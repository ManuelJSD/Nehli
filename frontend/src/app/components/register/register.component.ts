import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoginService } from 'src/app/services/login.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {

  username: string = '';
  password: string = '';
  email: string = '';
  isLoading = false;
  registerError = false;
  errorMessage = '';

  constructor(private loginService: LoginService, private router: Router) { }

  onSubmit() {
    // Evitar envío si ya está cargando o campos vacíos
    if (this.isLoading || !this.username.trim() || !this.password.trim() || !this.email.trim()) {
      return;
    }

    this.isLoading = true;
    this.registerError = false;

    this.loginService.register(this.username, this.password, this.email).subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (error) => {
        this.registerError = true;
        this.errorMessage = error?.error?.error || 'Error al crear la cuenta. Inténtalo de nuevo.';
        this.isLoading = false;
      }
    });
  }
}
