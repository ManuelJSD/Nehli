import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LoginService } from 'src/app/services/login.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['../auth.css']
})
export class RegisterComponent implements OnInit, OnDestroy {
  readonly invitation = this.route.snapshot.fragment || '';
  username = '';
  password = '';
  passwordConfirmation = '';
  email = '';
  challenge?: { id: string; image: string };
  challengeAnswer = '';
  challengeError = '';
  loadingChallenge = false;
  isLoading = false;
  errorMessage = '';
  pendingApproval = false;

  private challengeRequest?: Subscription;
  private registerRequest?: Subscription;

  constructor(private loginService: LoginService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    if (this.invitation) this.refreshChallenge();
  }

  ngOnDestroy(): void {
    this.challengeRequest?.unsubscribe();
    this.registerRequest?.unsubscribe();
  }

  refreshChallenge(): void {
    this.challengeRequest?.unsubscribe();
    this.challenge = undefined;
    this.challengeAnswer = '';
    this.challengeError = '';
    this.loadingChallenge = true;
    this.challengeRequest = this.loginService.getRegistrationChallenge().subscribe({
      next: challenge => {
        this.challenge = challenge;
        this.loadingChallenge = false;
      },
      error: response => {
        this.loadingChallenge = false;
        this.challengeError = response.error?.error || 'No se pudo cargar el código. Vuelve a intentarlo.';
      }
    });
  }

  onSubmit(): void {
    if (this.isLoading || !this.username.trim() || !this.password.trim() || !this.email.trim() || !this.challenge) return;
    if (this.password !== this.passwordConfirmation) {
      this.errorMessage = 'Las contraseñas deben coincidir.';
      return;
    }
    if (!/^\d{5}$/.test(this.challengeAnswer)) {
      this.errorMessage = 'Escribe los cinco dígitos de la imagen.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.registerRequest = this.loginService.register(
      this.username, this.password, this.email, this.passwordConfirmation, this.challenge.id, this.challengeAnswer, this.invitation
    ).subscribe({
      next: response => {
        this.isLoading = false;
        if (response.data?.pendingApproval) this.pendingApproval = true;
        else this.router.navigate(['/login']);
      },
      error: response => {
        this.errorMessage = response.error?.error || response.error?.errors?.[0]?.msg || 'No se pudo crear la cuenta.';
        this.isLoading = false;
        if (this.invitation) this.refreshChallenge();
      }
    });
  }
}
