import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { ComponentsModule } from './components/components.module';
import { HttpClientModule } from '@angular/common/http';
import { AuthGuard } from './guards/auth-guard.guard';
import { NoAuthGuard } from './guards/no-auth-guard.guard';
import { MyanimeService } from './services/myanime.service';
import { LoginService } from './services/login.service';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    ComponentsModule,
    HttpClientModule
  ],
  providers: [
    AuthGuard,
    NoAuthGuard,
    MyanimeService,
    LoginService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
