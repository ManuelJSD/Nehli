import { environments } from 'src/environments/environments';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, map, of, Subscription } from 'rxjs';
import { videoFiles, videoLink } from '../../interfaces/catalog-navigation';
import { MusicService } from '../../services/music.service';
import { VideoService } from '../../services/video.service';

interface SearchResult {
  title: string;
  detail: string;
  url: string[];
  params?: Record<string, string>;
  keywords?: string;
  category?: string;
  artwork?: string;
  music?: boolean;
}

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styles: [`
    :host { display: block; width: min(68rem, 100% - 2rem); margin: 2rem auto; }
    input { width: min(100%, 36rem); display: block; padding: .65rem; color: inherit; background: #172337; border: 1px solid #405270; border-radius: .5rem; }
    .search-scope { display: flex; gap: .45rem; margin: .7rem 0; flex-wrap: wrap; }
    .search-scope button { padding: .45rem .7rem; border: 1px solid #405270; border-radius: .45rem; color: inherit; background: #172337; cursor: pointer; }
    .search-scope button[aria-pressed="true"] { color: #10213a; background: #c1daff; }
    ul { list-style: none; padding: 0; display: grid; gap: .45rem; }
    a { display: flex; align-items: center; gap: .85rem; color: inherit; text-decoration: none; background: #172337; padding: .8rem; border-radius: .5rem; }
    a:hover { background: #243652; }
    .result-copy { display: grid; min-width: 0; gap: .25rem; overflow-wrap: anywhere; }
    small { color: #b6c8e1; }
    .result-art { position: relative; flex: 0 0 3rem; height: 4.35rem; display: grid; place-items: center; overflow: hidden; background: #243652; color: #a9cbff; border-radius: .4rem; }
    .result-art.music-art { height: 3rem; }
    .result-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  `]
})
export class SearchComponent implements OnInit, OnDestroy {
  query = '';
  libraryCategory = '';
  activeCategory = '';
  loading = true;
  incomplete = false;
  matches: SearchResult[] = [];
  private entries: SearchResult[] = [];
  private readonly requests = new Subscription();

  constructor(private route: ActivatedRoute, private videos: VideoService, private music: MusicService) {}

  ngOnInit(): void {
    this.requests.add(this.route.queryParamMap.subscribe(params => {
      this.libraryCategory = params.get('category') || '';
      this.activeCategory = this.libraryCategory;
      this.filter(params.get('q') || '');
    }));
    this.requests.add(forkJoin({
      videos: this.videos.getVideos().pipe(catchError(() => { this.incomplete = true; return of({}); })),
      music: this.music.catalog().pipe(map(response => {
        this.incomplete ||= response.scanning;
        return response.albums;
      }), catchError(error => { this.incomplete ||= error.status !== 403; return of([]); }))
    }).subscribe(({ videos, music }) => {
      for (const [category, titles] of Object.entries(videos)) {
        for (const [title, entry] of Object.entries(titles)) {
          const files = videoFiles(entry);
          if (!files.length) continue;
          const artwork = environments.baseURL + '/api/video/thumbnail?' + new URLSearchParams({ category, title });
          this.entries.push({ title, detail: category, category, artwork, ...videoLink(category, title, files[0]) });
          if (files.length > 1) for (const file of files) {
            this.entries.push({ title: file.name, detail: title + ' · ' + category, category, artwork, ...videoLink(category, title, file) });
          }
        }
      }
      for (const album of music) {
        const artwork = album.hasArtwork ? this.music.artwork(album.id) : undefined;
        this.entries.push({ title: album.title, detail: album.artist + ' · Álbum', artwork, music: true, url: ['/musica'], params: { album: album.id } });
        for (const track of album.tracks) {
          this.entries.push({ title: track.title, detail: album.title + ' · ' + track.artist, keywords: track.filename, artwork, music: true,
            url: ['/musica'], params: { album: album.id, track: track.id } });
        }
      }
      this.loading = false;
      this.filter(this.query);
    }));
  }

  ngOnDestroy(): void { this.requests.unsubscribe(); }

  setScope(category: string): void {
    this.activeCategory = category;
    this.filter(this.query);
  }

  filter(query: string): void {
    this.query = query;
    const terms = this.normalize(query.trim()).split(/\s+/).filter(Boolean);
    this.matches = terms.length ? this.entries.filter(item => {
      const text = this.normalize([item.title, item.detail, item.keywords || ''].join(' '));
      return (!this.activeCategory || item.category === this.activeCategory) && terms.every(term => text.includes(term));
    }).slice(0, 60) : [];
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
}
