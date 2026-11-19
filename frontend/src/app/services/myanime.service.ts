import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, timeout } from 'rxjs';
import { Anime } from '../interfaces/anime.interface';

interface AniListPage {
  data: {
    Page: {
      pageInfo: { lastPage: number };
      media: {
        title: { romaji: string; english: string | null };
        coverImage: { large: string };
        episodes: number;
        averageScore: number;
        siteUrl: string;
      }[];
    };
  };
}

const genres: Record<number, string> = {
  1: 'Action', 2: 'Adventure', 4: 'Comedy', 7: 'Mystery', 8: 'Drama', 9: 'Ecchi',
  10: 'Fantasy', 14: 'Horror', 18: 'Mecha', 19: 'Music', 22: 'Romance',
  24: 'Sci-Fi', 30: 'Sports', 36: 'Slice of Life', 37: 'Supernatural',
  40: 'Psychological', 41: 'Thriller'
};
const tags: Record<number, string> = {
  3: 'Cars', 5: 'Surreal Comedy', 6: 'Demons', 11: 'Video Games', 12: 'Hentai',
  13: 'Historical', 15: 'Kids', 16: 'Magic', 17: 'Martial Arts', 20: 'Parody',
  21: 'Samurai', 23: 'School', 25: 'Shoujo', 26: "Girls' Love", 27: 'Shounen',
  28: "Boys' Love", 29: 'Space', 31: 'Super Power', 32: 'Vampire', 33: "Boys' Love",
  34: "Girls' Love", 35: 'Harem', 38: 'Military', 39: 'Police', 42: 'Seinen', 43: 'Josei'
};

export interface AnimeCard {
  title: string;
  images: { jpg: { image_url: string } };
  episodes: number;
  score: number;
  url: string;
}

type AnimePage = { data: AnimeCard[]; pagination: Pick<Anime['pagination'], 'last_visible_page'> };

@Injectable({ providedIn: 'root' })
export class MyanimeService {
  constructor(private http: HttpClient) {}

  obtenerPopulares(): Observable<AnimeCard[]> {
    return this.aniList().pipe(map(response => response.data));
  }

  obtenerSeason(temporada: string, anio: number): Observable<AnimeCard[]> {
    return this.aniList({ season: temporada.toUpperCase(), year: anio }).pipe(map(response => response.data));
  }

  obtenerGeneros(genero: number, paginacion: number): Observable<AnimePage> {
    return this.aniList({ genre: genres[genero], tag: tags[genero], page: paginacion });
  }

  private aniList(variables: Record<string, string | number | undefined> = {}): Observable<AnimePage> {
    const query = 'query ($page: Int = 1, $season: MediaSeason, $year: Int, $genre: String, $tag: String) {' +
      ' Page(page: $page, perPage: 25) { pageInfo { lastPage }' +
      ' media(type: ANIME, sort: POPULARITY_DESC, season: $season, seasonYear: $year, genre: $genre, tag: $tag) {' +
      ' title { romaji english } coverImage { large } episodes averageScore siteUrl } } }';
    return this.http.post<AniListPage>('https://graphql.anilist.co', { query, variables }).pipe(
      timeout(6000),
      map(({ data }) => ({
        data: data.Page.media.map(media => ({
          title: media.title.english || media.title.romaji,
          images: { jpg: { image_url: media.coverImage.large } },
          episodes: media.episodes,
          score: media.averageScore / 10,
          url: media.siteUrl
        })),
        pagination: { last_visible_page: data.Page.pageInfo.lastPage }
      }))
    );
  }
}
