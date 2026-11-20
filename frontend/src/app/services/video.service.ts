import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';

import { AnimeMatch, CatalogEdit, Video, VideoMetadata } from '../interfaces/video.interface';
import { environments } from 'src/environments/environments';

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private apiUrl: string = environments.baseURL;

  constructor(private http: HttpClient) { }

  getVideos(): Observable<Video> {
    return this.http.get<Video>(`${this.apiUrl}/api/video/videos`, { withCredentials: true })
  }

  getVideosAndThumbnails(subfolder: string, titulo: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/video/videos`, { withCredentials: true }).pipe(
      map(response => response[subfolder][titulo]),
      // tap(seriesData => console.log('Contenido de videos:', seriesData.videos)),
    );
  }

  getVideoMetadata(path: string): Observable<VideoMetadata> {
    return this.http.get<VideoMetadata>(`${this.apiUrl}/api/stream/metadata?path=${encodeURIComponent(path)}`);
  }

  getVideoInfo(category: string, title: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/video/info?category=${encodeURIComponent(category)}&title=${encodeURIComponent(title)}`);
  }

  getVideoDuration(path: string): Observable<{ duration: number }> {
    return this.http.get<{ duration: number }>(`${this.apiUrl}/api/stream/duration?path=${encodeURIComponent(path)}`);
  }

  getCatalogEdit(category: string, title: string) {
    return this.http.get<CatalogEdit>(this.apiUrl + '/api/video/editor', { params: { category, title } });
  }

  searchAnimeMatch(category: string, title: string, q: string) {
    return this.http.get<AnimeMatch[]>(this.apiUrl + '/api/video/editor/anime', { params: { category, title, q } });
  }

  saveCatalogEdit(category: string, title: string, edit: { displayTitle: string; synopsis: string; animeId: number | null; image?: string | null }) {
    return this.http.put<void>(this.apiUrl + '/api/video/editor', edit, { params: { category, title } });
  }
}
