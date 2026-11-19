import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AnimeCard, MyanimeService } from '../../../../services/myanime.service';

@Component({
  selector: 'app-populares',
  templateUrl: './populares.component.html',
  styleUrls: ['../anime-page.css']
})
export class PopularesComponent implements OnInit, OnDestroy {
  populares: AnimeCard[] = [];
  isLoading = true;
  isError = false;
  private request?: Subscription;

  constructor(private animeService: MyanimeService) {}

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.request?.unsubscribe(); }

  load(): void {
    this.request?.unsubscribe();
    this.isLoading = true;
    this.isError = false;
    this.request = this.animeService.obtenerPopulares().subscribe({
      next: data => { this.populares = data; this.isLoading = false; },
      error: () => { this.isError = true; this.isLoading = false; }
    });
  }
}
