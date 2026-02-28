import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MyanimeService } from '../../../../services/myanime.service';
import { FormControl } from '@angular/forms';
import { Datum } from 'src/app/interfaces/anime.interface';
import { Message } from 'primeng/api/message';

@Component({
  selector: 'app-temporada',
  templateUrl: './temporada.component.html',
  styleUrls: ['./temporada.component.css']
})
export class TemporadaComponent implements OnInit, OnDestroy {

  Temporadas: Datum[] = [];
  anioActual: number = new Date().getFullYear();
  temporada!: string;
  tempActual: string;
  anios: number[] = [];
  anioSeleccionado: number;

  isLoading = false;
  isError = false;
  messages: Message[] = [];

  selected: FormControl = new FormControl(null);
  opc: any;

  subscription: Subscription = new Subscription();

  constructor(private MyanimeService: MyanimeService) {
    this.anioSeleccionado = this.anioActual;
    this.tempActual = 'winter';

    // Rellenamos el p-dropdown con los anios
    const ANIO_INICIAL = 1917;
    for (let i = this.anioActual; i >= ANIO_INICIAL; i--) {
      this.anios.push(i);
    }

    // Obtenemos los animes
    this.obtenerAnimes();
  }

  ngOnInit(): void {
    this.subscription = this.selected.valueChanges.subscribe(changes => {
      this.obtenerAnimes();
    });
  }

  obtenerAnimes() {
    this.MyanimeService.obtenerSeason(this.tempActual, this.anioSeleccionado).subscribe(
      (datos) => {
        this.Temporadas = datos
        this.isLoading = false;
      },
      (error) => {
        this.messages.push({ severity: 'error', summary: 'Error', detail: error });
        this.isError = true;
        this.isLoading = false;
      }
    );
  }

  recibirTemp(temp: string) {

    this.tempActual = temp;

    this.obtenerAnimes();

    const tempMap: {
      [key: string]: string;
    } = {
      winter: 'Invierno',
      spring: 'Primavera',
      summer: 'Verano',
      fall: 'Otoño'
    };

    this.temporada = tempMap[temp];
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

}
