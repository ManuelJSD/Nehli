import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environments } from 'src/environments/environments';

export interface MusicTrack {
  artworkId?: string;
  filename?: string;
  folders?: string[];
  id: string;
  title: string;
  artist: string;
  disc: number;
  number: number | null;
  duration: number | null;
  mime: string;
}

export interface MusicAlbum {
  id: string;
  title: string;
  artist: string;
  hasArtwork: boolean;
  tracks: MusicTrack[];
}

export interface MusicPlaylist {
  id: string;
  name: string;
  tracks: string[];
}

@Injectable({ providedIn: 'root' })
export class MusicService {
  private readonly url = environments.baseURL + '/api/musica';

  constructor(private http: HttpClient) {}

  collection() { return this.http.get<{ favorites: string[]; playlists: MusicPlaylist[] }>(this.url + '/collection'); }
  favorite(id: string, favorite: boolean) { return this.http.put<void>(this.url + '/favorites/' + id, { favorite }); }
  savePlaylist(id: string, name: string, tracks: string[]) {
    return this.http.put<MusicPlaylist>(this.url + '/playlists/' + id, { name, tracks });
  }

  access() { return this.http.get<{ allowed: boolean }>(this.url + '/access'); }

  catalog() {
    return this.http.get<{ albums: MusicAlbum[]; scanning: boolean }>(this.url + '/catalog', { withCredentials: true });
  }

  artwork(id: string) { return this.url + '/artwork/' + encodeURIComponent(id); }

  stream(id: string, convert: boolean) {
    return this.url + '/track/' + encodeURIComponent(id) + (convert ? '?convert=1' : '');
  }
}
