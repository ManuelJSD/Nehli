import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { BrowserComponent } from './browser/browser.component';
import { FooterComponent } from './footer/footer.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { VideoComponent } from './video/video.component';
import { WelcomeComponent } from './welcome/welcome.component';
import { MyanimeModule } from './myanime/myanime.module';

import { PrimeNgModule } from '../prime-ng/prime-ng.module';
import { SharedModule } from 'primeng/api';
import { NavbarComponent } from './navbar/navbar.component';

@NgModule({
  declarations: [
    BrowserComponent,
    LoginComponent,
    RegisterComponent,
    WelcomeComponent,
    VideoComponent,
    FooterComponent,
    NavbarComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    FormsModule,
    MyanimeModule,
    PrimeNgModule,
  ],
  exports: [
    BrowserComponent,
    LoginComponent,
    RegisterComponent,
    WelcomeComponent,
    MyanimeModule,
    VideoComponent,
    FooterComponent,
    NavbarComponent,
  ]
})
export class ComponentsModule { }
