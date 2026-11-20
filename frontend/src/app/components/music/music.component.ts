import { Component, OnDestroy, OnInit } from '@angular/core';
import { exhaustMap, Subscription, takeWhile, timer } from 'rxjs';
import { MusicAlbum, MusicService, MusicTrack } from '../../services/music.service';
import { MusicPlayerService } from '../../services/music-player.service';

interface MusicFolder {
  name: string;
  artworkId?: string;
  folders: Map<string, MusicFolder>;
  tracks: MusicTrack[];
}

@Component({
  selector: 'app-music',
  templateUrl: './music.component.html',
  styleUrls: ['./music.component.css']
})
export class MusicComponent implements OnInit, OnDestroy {
  albums: MusicAlbum[] = [];
  artists: string[] = [];
  results: MusicAlbum[] = [];
  resultsLimit = 36;
  trackResults: { album: MusicAlbum; track: MusicTrack; index: number }[] = [];
  trackLimit = 20;
  album?: MusicAlbum;
  search = '';
  artist = '';
  view: 'albums' | 'folders' = 'albums';
  folderPath: MusicFolder[] = [];
  folderQueue?: MusicAlbum;
  private readonly folderOrder = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
  loading = true;
  scanning = false;
  error = '';
  denied = false;
  queueStatus = '';
  private request?: Subscription;

  constructor(public music: MusicService, public player: MusicPlayerService) {}

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.request?.unsubscribe(); }

  load(): void {
    this.request?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.denied = false;
    this.request = timer(0, 2000).pipe(
      exhaustMap(() => this.music.catalog()),
      takeWhile(response => response.scanning, true)
    ).subscribe({
      next: response => {
        this.loading = false;
        this.scanning = response.scanning;
        this.albums = response.albums.map(album => ({
          ...album,
          tracks: album.tracks.map(track => ({ ...track, artworkId: album.hasArtwork ? album.id : undefined }))
        }));
        this.buildFolders();
        this.artists = Array.from(new Set(this.albums.map(album => album.artist)));
        this.filter();
      },
      error: response => {
        this.loading = this.scanning = false;
        this.denied = response.status === 403;
        this.error = response.error?.error || 'No se pudo cargar Música.';
      }
    });
  }

  get subfolders(): MusicFolder[] {
    const current = this.folderPath.at(-1);
    return [...(current?.folders.values() || [])].sort((a, b) => this.folderOrder.compare(a.name, b.name));
  }

  openFolder(folder: MusicFolder, depth = this.folderPath.length): void {
    this.folderPath = [...this.folderPath.slice(0, depth), folder];
    const tracks = [...folder.tracks].sort((a, b) => this.folderOrder.compare(a.filename || a.title, b.filename || b.title));
    this.folderQueue = {
      id: JSON.stringify(this.folderPath.map(item => item.name)), title: folder.name,
      artist: '', hasArtwork: false, tracks
    };
  }

  private buildFolders(): void {
    const root: MusicFolder = { name: 'Música', folders: new Map(), tracks: [] };
    for (const album of this.albums) {
      for (const track of album.tracks) {
        let parent = root;
        for (const name of track.folders || []) {
          let folder = parent.folders.get(name);
          if (!folder) {
            folder = { name, folders: new Map(), tracks: [] };
            parent.folders.set(name, folder);
          }
          folder.artworkId ??= track.artworkId;
          parent = folder;
        }
        parent.tracks.push(track);
      }
    }
    this.openFolder(root, 0);
  }

  filter(): void {
    const query = this.normalize(this.search);
    this.resultsLimit = 36;
    this.trackLimit = 20;
    this.trackResults = [];
    this.results = this.albums.filter(album => {
      if (this.artist && album.artist !== this.artist) return false;
      if (!query) return true;
      let trackMatched = false;
      album.tracks.forEach((track, index) => {
        if (!this.normalize(track.title + ' ' + track.artist).includes(query)) return;
        this.trackResults.push({ album, track, index });
        trackMatched = true;
      });
      return trackMatched || this.normalize(album.title + ' ' + album.artist).includes(query);
    });
  }

  addTrack(track: MusicTrack): void {
    this.player.add(track);
    this.queueStatus = 'Pista añadida a la cola: ' + track.title;
  }

  duration(seconds: number | null): string {
    if (seconds === null) return '—';
    const total = Math.floor(seconds);
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
}
