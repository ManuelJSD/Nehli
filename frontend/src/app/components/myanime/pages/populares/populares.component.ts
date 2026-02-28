import { Component, OnInit } from '@angular/core';
import { MyanimeService } from '../../../../services/myanime.service';
import { Datum } from '../../../../interfaces/anime.interface';

@Component({
  selector: 'app-populares',
  templateUrl: './populares.component.html',
  styleUrls: ['./populares.component.css']
})
export class PopularesComponent implements OnInit {

  public populares: Datum[] = [];

  constructor(private MyanimeService: MyanimeService) { }

  ngOnInit(): void {
    this.MyanimeService.obtenerPopulares().subscribe(
      (populares: Datum[]) => {
        this.populares = populares;
      },
      (error) => {
        console.log(error);
      }
    );
  }

}
