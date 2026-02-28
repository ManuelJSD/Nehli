import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { WelcomeComponent } from './components/welcome/welcome.component';
import { RegisterComponent } from './components/register/register.component';
import { BrowserComponent } from './components/browser/browser.component';
import { LoginComponent } from './components/login/login.component';

import { NoAuthGuard } from './guards/no-auth-guard.guard';
import { AuthGuard } from './guards/auth-guard.guard';
import { GenerosComponent } from './components/myanime/pages/generos/generos.component';
import { PopularesComponent } from './components/myanime/pages/populares/populares.component';
import { TemporadaComponent } from './components/myanime/pages/temporada/temporada.component';
import { VideoComponent } from './components/video/video.component';

const routes: Routes = [
  {
    path: '',
    component: WelcomeComponent,
    canActivate: [NoAuthGuard]
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [NoAuthGuard]
  },
  {
    path: 'browser',
    component: BrowserComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [NoAuthGuard]
  },
  {
    path: 'generos',
    component: GenerosComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'populares',
    component: PopularesComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'temporada',
    component: TemporadaComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'videos/:category/:subcategory/:video',
    component: VideoComponent,
    canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: ''
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
