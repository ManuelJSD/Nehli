import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PopularesComponent } from './pages/populares/populares.component';
import { TemporadaComponent } from './pages/temporada/temporada.component';
import { GenerosComponent } from './pages/generos/generos.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimeNgModule } from 'src/app/prime-ng/prime-ng.module';

import { DropdownModule } from 'primeng/dropdown';
import { TarjetasComponent } from './components/tarjetas/tarjetas.component';


@NgModule({
  declarations: [
    PopularesComponent,
    TemporadaComponent,
    GenerosComponent,
    TarjetasComponent,
    // NavbarComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimeNgModule,
    DropdownModule
  ],
  exports: [
    PopularesComponent,
  ],
  providers: [],
})
export class MyanimeModule { }
