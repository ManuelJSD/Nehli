import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-tarjetas',
  templateUrl: './tarjetas.component.html',
  styles: [
    `
    a {
      text-decoration:none;
      text-align: center;
    }
  `
  ]
})
export class TarjetasComponent implements OnInit {

  @Input()data!: {
    imagen: string,
    titulo: string,
    episodios: number | null,
    puntuacion: number,
    url: string
  };

  constructor() { }

  ngOnInit(): void {
  }

}
