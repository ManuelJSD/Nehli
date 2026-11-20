import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AnimeCard, MyanimeService } from '../../../../services/myanime.service';

interface Genre {
  name: string;
  id: number;
}

@Component({
  selector: 'app-generos',
  templateUrl: './generos.component.html',
  styleUrls: ['../anime-page.css']
})
export class GenerosComponent implements OnInit, OnDestroy {
  generos: Genre[] = [
      { name: "Acción", id: 1 },
      { name: "Aventuras", id: 2 },
      { name: "Carreras", id: 3 },
      { name: "Comedia", id: 4 },
      { name: "Demencia", id: 5 },
      { name: "Demonios", id: 6 },
      { name: "Misterio", id: 7 },
      { name: "Drama", id: 8 },
      { name: "Ecchi", id: 9 },
      { name: "Fantasia", id: 10 },
      { name: "Juegos", id: 11 },
      { name: "Hentai", id: 12 },
      { name: "Historia", id: 13 },
      { name: "Terror", id: 14 },
      { name: "Infantil", id: 15 },
      { name: "Magia", id: 16 },
      { name: "Artes Marciales", id: 17 },
      { name: "Mechas", id: 18 },
      { name: "Música", id: 19 },
      { name: "Parodias", id: 20 },
      { name: "Samurai", id: 21 },
      { name: "Romance", id: 22 },
      { name: "Escolares", id: 23 },
      { name: "Ciencia Ficción", id: 24 },
      { name: "Shoujo", id: 25 },
      { name: "Shoujo Ai", id: 26 },
      { name: "Shounen", id: 27 },
      { name: "Shounen Ai", id: 28 },
      { name: "Espacio", id: 29 },
      { name: "Deportes", id: 30 },
      { name: "Super Poderes", id: 31 },
      { name: "Vampiros", id: 32 },
      { name: "Yaoi", id: 33 },
      { name: "Yuri", id: 34 },
      { name: "Harem", id: 35 },
      { name: "Recuentos de la vida", id: 36 },
      { name: "Sobrenatural", id: 37 },
      { name: "Militar", id: 38 },
      { name: "Policia", id: 39 },
      { name: "Psicológico", id: 40 },
      { name: "Thriller", id: 41 },
      { name: "Seinen", id: 42 },
      { name: "Josei", id: 43 }
    ];
  selectedGenero = this.generos[0];
  paginaActual = 1;
  pageCount = 1;
  generosAnime: AnimeCard[] = [];
  isLoading = true;
  isError = false;
  rateLimited = false;
  private request?: Subscription;

  constructor(private animeService: MyanimeService) {}

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.request?.unsubscribe(); }

  selectGenre(genre: Genre): void {
    this.selectedGenero = genre;
    this.paginaActual = 1;
    this.load();
  }

  selectPage(page: number): void {
    if (page < 1 || page > this.pageCount) return;
    this.paginaActual = page;
    this.load();
  }

  load(): void {
    this.request?.unsubscribe();
    this.isLoading = true;
    this.isError = false;
    this.request = this.animeService.obtenerGeneros(this.selectedGenero.id, this.paginaActual).subscribe({
      next: result => {
        this.generosAnime = result.data;
        this.pageCount = result.pagination.last_visible_page;
        this.isLoading = false;
      },
      error: error => { this.rateLimited = error.status === 429; this.isError = true; this.isLoading = false; }
    });
  }
}
