import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MenuItem } from 'primeng/api/menuitem';
import { LoginService } from 'src/app/services/login.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  items!: MenuItem[];

  constructor(private loginService: LoginService, private router: Router) {}

  ngOnInit() {
    this.items = [
      {
        label: 'Inicio',
        icon: 'pi pi-fw pi-home',
        routerLink: 'browser'
      },
      {
        label: 'Seguimiento de Anime',
        icon: 'pi pi-desktop',
        items: [
          {
            label: 'Populares',
            icon: 'pi pi-star-fill',
            routerLink: 'populares'
          },
          {
            label: 'Temporada',
            icon: 'pi pi-align-left',
            routerLink: 'temporada'
          },
          {
            label: 'Genero',
            icon: 'pi pi-tag',
            routerLink: 'generos'
          },
        ]
      },
      {
        label: 'Enlaces de interes',
        icon: 'pi pi-desktop',
        items: [
          {
            label: 'FilmAffinity',
            icon: 'pi pi-align-left',
          },
          {
            label: 'MyAnimeList',
            icon: 'pi pi-camera',
          },
          {
            label: 'YouTube',
            icon: 'pi pi-youtube',
          },
        ]
      },
      // {
      //   label: 'Salir',
      //   icon: 'pi pi-fw pi-power-off',
      //   command: () => this.logout()
      // }
    ];
  }

  logout(): void {
    this.loginService.logout();
    this.router.navigate(['']);
  }
}
