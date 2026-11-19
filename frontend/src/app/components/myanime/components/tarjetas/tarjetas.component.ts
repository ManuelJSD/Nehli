import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-tarjetas',
  templateUrl: './tarjetas.component.html',
  styleUrls: ['./tarjetas.component.css']
})
export class TarjetasComponent {

  @Input() data!: {
    imagen: string,
    titulo: string,
    episodios: number | null,
    puntuacion: number,
    url: string
  };
  useFallbackImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith('/miniatura_default.webp')) {
      image.src = 'assets/images/miniatura_default.webp';
    }
  }
}
