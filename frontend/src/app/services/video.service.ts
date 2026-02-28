import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';

import { listVideos, Video } from '../interfaces/video.interface';
import { environments } from 'src/environments/environments';

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private apiUrl: string = environments.baseURL;

  constructor(private http: HttpClient) { }

  getVideos(): Observable<Video> {
    return this.http.get<Video>(`${this.apiUrl}/api/video/videos`)
  }

  getVideosAndThumbnails(subfolder: string, titulo: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/video/videos`).pipe(
      map(response => response[subfolder][titulo]),
      // tap(seriesData => console.log('Contenido de videos:', seriesData.videos)),
    );
  }
}
