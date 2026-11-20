import { ActivatedRoute } from '@angular/router';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { exhaustMap, Subscription, takeWhile, timer } from 'rxjs';
import { MusicAlbum, MusicPlaylist, MusicService, MusicTrack } from '../../services/music.service';
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
  linkedTrack?: string;
  search = '';
  artist = '';
  view: 'albums' | 'folders' | 'collection' = 'albums';
  folderPath: MusicFolder[] = [];
  folderQueue?: MusicAlbum;
  private readonly folderOrder = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
  loading = true;
  scanning = false;
  error = '';
  denied = false;
  queueStatus = '';
  favorites = new Set<string>();
  playlists: MusicPlaylist[] = [];
  list?: MusicPlaylist;
  libraryTracks = new Map<string, MusicTrack>();
  collectionError = '';
  collectionBusy = false;
  private readonly collectionRequests = new Subscription();
  private request?: Subscription;

  constructor(public music: MusicService, public player: MusicPlayerService, private route: ActivatedRoute) {}

  ngOnInit(): void { this.load(); this.loadCollection(); }
  ngOnDestroy(): void { this.request?.unsubscribe(); this.collectionRequests.unsubscribe(); }

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
        this.libraryTracks = new Map(this.albums.flatMap(album => album.tracks.map(track => [track.id, track])));
        this.buildFolders();
        const params = this.route.snapshot.queryParamMap;
        const albumId = params.get('album');
        if (albumId) this.album = this.albums.find(album => album.id === albumId);
        this.linkedTrack = params.get('track') || undefined;
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

  get favoriteTracks(): MusicTrack[] { return this.resolveTracks([...this.favorites]); }

  loadCollection(): void {
    this.collectionRequests.add(this.music.collection().subscribe({
      next: data => { this.favorites = new Set(data.favorites); this.playlists = data.playlists; },
      error: () => { this.collectionError = 'No se pudieron cargar las listas y favoritos.'; }
    }));
  }

  toggleFavorite(track: MusicTrack): void {
    const favorite = !this.favorites.has(track.id);
    this.collectionRequests.add(this.music.favorite(track.id, favorite).subscribe({
      next: () => { if (favorite) this.favorites.add(track.id); else this.favorites.delete(track.id); },
      error: () => { this.collectionError = 'No se pudo actualizar el favorito.'; }
    }));
  }

  playCollection(name: string, ids: string[]): void {
    this.player.play({ id: name, title: name, artist: '', hasArtwork: false, tracks: this.resolveTracks(ids) });
  }

  trackLabel(id: string): string { return this.libraryTracks.get(id)?.title || 'Pista no disponible'; }

  moveTrack(index: number, direction: -1 | 1): void {
    const list = this.list;
    const target = index + direction;
    if (!list || target < 0 || target >= list.tracks.length || this.collectionBusy) return;
    const tracks = [...list.tracks];
    [tracks[index], tracks[target]] = [tracks[target], tracks[index]];
    this.collectionBusy = true;
    this.collectionRequests.add(this.music.savePlaylist(list.id, list.name, tracks).subscribe({
      next: updated => {
        this.playlists = this.playlists.map(item => item.id === updated.id ? updated : item);
        this.list = updated;
        this.collectionBusy = false;
      },
      error: () => { this.collectionBusy = false; this.collectionError = 'No se pudo guardar el orden.'; }
    }));
  }

  private resolveTracks(ids: string[]): MusicTrack[] {
    return ids.flatMap(id => {
      const track = this.libraryTracks.get(id);
      return track ? [track] : [];
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
