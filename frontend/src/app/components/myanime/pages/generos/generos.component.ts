import { Component, OnInit } from '@angular/core';
import { MyanimeService } from '../../../../services/myanime.service';
import { Message } from 'primeng/api/message';
import { Datum } from 'src/app/interfaces/anime.interface';

interface Gen {
  name: string,
  id: number
}

@Component({
  selector: 'app-generos',
  templateUrl: './generos.component.html',
  styleUrls: ['./generos.component.css']
})
export class GenerosComponent implements OnInit {

  generos: any[];
  paginaActual: number = 1;
  selectedGenero: Gen;
  generosAnime: Datum[] = [];

  isLoading = false;
  isError = false;
  messages: Message[] = [];

  constructor(private MyanimeService: MyanimeService) {
    this.generos = [
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

    this.selectedGenero = this.generos[0];

    this.obtenerGenero();
  }

  ngOnInit(): void { }

  obtenerGenero() {
     this.MyanimeService.obtenerGeneros(this.selectedGenero.id, this.paginaActual).subscribe(
      (datos) => {
        this.generosAnime = datos
        this.isLoading = false;
      },
      (error) => {
        this.messages.push({ severity: 'error', summary: 'Error', detail: error });
        this.isError = true;
        this.isLoading = false;
      }
    );
  }

  get PagGenero() {
    return (this.MyanimeService.pagGeneros / 100);
  }

  cambioPagina(avanzar: boolean) {
    if (avanzar) {
      if (this.paginaActual != this.PagGenero) {
        this.paginaActual += 1;
      }

    } else {
      if (this.paginaActual > 1) {
        this.paginaActual -= 1;

      }
    }

    this.obtenerGenero();
  }

  especificarPagina(numero: number) {

    this.MyanimeService.obtenerGeneros(this.selectedGenero.id, numero);
    this.paginaActual = numero;

  }

}
