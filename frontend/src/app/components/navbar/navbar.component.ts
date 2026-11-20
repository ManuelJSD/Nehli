import { Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api/menuitem';
import { MusicService } from 'src/app/services/music.service';
import { LoginService } from 'src/app/services/login.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnDestroy {
  @ViewChild('accountMenu') private menu!: ElementRef<HTMLDetailsElement>;
  @ViewChild('accountDialog') private dialog!: ElementRef<HTMLDialogElement>;
  items!: MenuItem[];
  profileName = '';
  email = '';
  currentPassword = '';
  newPassword = '';
  passwordConfirmation = '';
  loadingProfile = false;
  savingProfile = false;
  profileReady = false;
  errorMessage = '';
  statusMessage = '';
  private profileRequest?: Subscription;
  private musicRequest?: Subscription;

  get canAdminister(): boolean {
    return this.loginService.isAdmin();
  }

  get username(): string {
    return this.loginService.username || 'Cuenta';
  }

  constructor(private loginService: LoginService, private router: Router, private music: MusicService) { }

  ngOnInit(): void {
    const musicItem: MenuItem = { label: 'Música', icon: 'pi pi-volume-up', routerLink: '/musica', visible: false };
    this.items = [
      {
        label: 'Biblioteca',
        icon: 'pi pi-fw pi-home',
        routerLink: '/browser'
      },
      musicItem,
      {
        label: 'Anime',
        icon: 'pi pi-desktop',
        items: [
          {
            label: 'Populares',
            icon: 'pi pi-star-fill',
            routerLink: '/populares'
          },
          {
            label: 'Temporadas',
            icon: 'pi pi-align-left',
            routerLink: '/temporada'
          },
          {
            label: 'Géneros',
            icon: 'pi pi-tag',
            routerLink: '/generos'
          },
        ]
      },
      {
        label: 'Enlaces de interés',
        icon: 'pi pi-link',
        items: [
          {
            label: 'FilmAffinity',
            icon: 'pi pi-star',
            url: 'https://www.filmaffinity.com',
            target: '_blank'
          },
          {
            label: 'MyAnimeList',
            icon: 'pi pi-list',
            url: 'https://myanimelist.net',
            target: '_blank'
          },
          {
            label: 'YouTube',
            icon: 'pi pi-youtube',
            url: 'https://www.youtube.com',
            target: '_blank'
          },
        ]
      },
    ];
    this.musicRequest = this.music.access().subscribe({
      next: ({ allowed }) => {
        musicItem.visible = allowed;
        this.items = [...this.items];
      },
      error: () => {}
    });
  }

  @HostListener('document:click', ['$event'])
  closeMenuFromOutside(event: MouseEvent): void {
    const menu = this.menu.nativeElement;
    if (menu.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
  }

  closeMenuWithKeyboard(event: Event): void {
    const menu = this.menu.nativeElement;
    if (!menu.open) return;
    event.stopPropagation();
    menu.open = false;
    menu.querySelector('summary')?.focus();
  }

  openProfile(): void {
    const dialog = this.dialog.nativeElement;
    if (!dialog.open) dialog.showModal();
    this.menu.nativeElement.open = false;
    this.loadProfile();
  }

  loadProfile(): void {
    this.profileRequest?.unsubscribe();
    this.loadingProfile = true;
    this.profileReady = false;
    this.errorMessage = '';
    this.statusMessage = '';
    this.profileRequest = this.loginService.getProfile().subscribe({
      next: profile => {
        this.profileName = profile.username;
        this.email = profile.email;
        this.loadingProfile = false;
        this.profileReady = true;
      },
      error: () => {
        this.loadingProfile = false;
        this.errorMessage = 'No se pudieron cargar los datos de tu cuenta.';
      }
    });
  }

  saveProfile(): void {
    if (!this.profileReady || this.savingProfile) return;
    this.errorMessage = '';
    this.statusMessage = '';
    if (this.newPassword !== this.passwordConfirmation) {
      this.errorMessage = 'Las contraseñas nuevas deben coincidir.';
      return;
    }
    this.savingProfile = true;
    this.profileRequest = this.loginService.updateProfile({
      username: this.profileName,
      email: this.email,
      currentPassword: this.currentPassword,
      newPassword: this.newPassword || undefined,
      passwordConfirmation: this.newPassword ? this.passwordConfirmation : undefined
    }).subscribe({
      next: profile => {
        this.profileName = profile.username;
        this.email = profile.email;
        this.currentPassword = this.newPassword = this.passwordConfirmation = '';
        this.savingProfile = false;
        this.statusMessage = 'Cambios guardados.';
      },
      error: response => {
        this.savingProfile = false;
        this.errorMessage = response.error?.error || response.error?.errors?.[0]?.msg || 'No se pudieron guardar los cambios.';
      }
    });
  }

  resetProfile(): void {
    this.profileRequest?.unsubscribe();
    this.currentPassword = this.newPassword = this.passwordConfirmation = '';
    this.loadingProfile = this.savingProfile = this.profileReady = false;
    this.errorMessage = this.statusMessage = '';
    this.menu.nativeElement.querySelector('summary')?.focus();
  }

  ngOnDestroy(): void {
    this.musicRequest?.unsubscribe();
    this.profileRequest?.unsubscribe();
  }

  logout(): void {
    this.loginService.logout();
    this.router.navigate(['']);
  }
}
