import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AnimeCard, MyanimeService } from '../../../../services/myanime.service';

@Component({
  selector: 'app-temporada',
  templateUrl: './temporada.component.html',
  styleUrls: ['../anime-page.css']
})
export class TemporadaComponent implements OnInit, OnDestroy {
  Temporadas: AnimeCard[] = [];
  anioSeleccionado = new Date().getFullYear();
  anios = Array.from({ length: this.anioSeleccionado - 1917 + 1 }, (_, index) => this.anioSeleccionado - index);
  selectedSeason = 'winter';
  seasons = [
    { id: 'winter', label: 'Invierno' }, { id: 'spring', label: 'Primavera' },
    { id: 'summer', label: 'Verano' }, { id: 'fall', label: 'Otoño' }
  ];
  isLoading = true;
  isError = false;
  rateLimited = false;
  private request?: Subscription;

  constructor(private animeService: MyanimeService) {}

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.request?.unsubscribe(); }

  selectSeason(season: string): void {
    if (this.selectedSeason === season) return;
    this.selectedSeason = season;
    this.load();
  }

  load(): void {
    this.request?.unsubscribe();
    this.isLoading = true;
    this.isError = false;
    this.request = this.animeService.obtenerSeason(this.selectedSeason, this.anioSeleccionado).subscribe({
      next: data => { this.Temporadas = data; this.isLoading = false; },
      error: error => { this.rateLimited = error.status === 429; this.isError = true; this.isLoading = false; }
    });
  }
}
