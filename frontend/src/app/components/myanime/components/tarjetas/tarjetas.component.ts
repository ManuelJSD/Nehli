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
}
