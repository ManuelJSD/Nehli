import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Datum, Anime, Pagination } from '../interfaces/anime.interface';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MyanimeService {

  private servicioURL: string = "https://api.jikan.moe/v4";

  public populares: Datum[] = [];
  public season: Datum[] = [];
  public pagGeneros!: any;

  constructor(private http: HttpClient) { }

  obtenerPopulares(): Observable<Datum[]> {
    return this.http.get<Anime>(`${this.servicioURL}/top/anime`).pipe(
      map((resp) => {
        return resp.data;
      })
    );
  }

  obtenerSeason(temporada: string, anio: number): Observable<Datum[]> {
    return this.http.get<Anime>(`${this.servicioURL}/seasons/${anio}/${temporada}`).pipe(
      map((resp) => {
        return resp.data;
      })
    );
  }

  obtenerGeneros(genero: number, paginacion: number): Observable<Datum[]> {
    return this.http.get<Anime>(`${this.servicioURL}/anime?genre=${genero}&page=${paginacion}`).pipe(
      map((resp) => {
        this.pagGeneros = resp.pagination;
        return resp.data;
      })
    );
  }
}
