import { displayName, seasonNumber } from 'src/app/interfaces/display-name';
import { videoFiles, videoLink } from 'src/app/interfaces/catalog-navigation';
import { ActivatedRoute, Router } from '@angular/router';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { AnimeMatch, Video, WatchProgress } from 'src/app/interfaces/video.interface';
import { LoginService } from 'src/app/services/login.service';
import { VideoService } from 'src/app/services/video.service';
import { WatchProgressService } from 'src/app/services/watch-progress.service';
import { environments } from 'src/environments/environments';

interface CatalogTitle {
  displayTitle: string;
  category: string;
  title: string;
  imageUrl: string;
  playUrl: string[];
}

interface ContinueWatching extends WatchProgress {
  title: string;
  episode: string;
  imageUrl: string;
  playUrl: string[];
  percent: number;
  time: string;
}

interface TitleInfo {
  title?: string;
  synopsis?: string;
  sourceUrl?: string;
  coverUrl?: string;
  year?: number;
  genres?: string[];
}

@Component({
  selector: 'app-browser',
  templateUrl: './browser.component.html',
  styleUrls: ['./browser.component.css']
})
export class BrowserComponent implements OnInit, OnDestroy {
  @ViewChild('featuredSection') private featuredSection?: ElementRef<HTMLElement>;
  @ViewChild('titleDialog', { static: true }) private titleDialog!: ElementRef<HTMLDialogElement>;

  shelfChoice?: 'continue' | 'recent';

  get activeShelf(): 'continue' | 'recent' {
    if (!this.continueWatching.length) return 'recent';
    if (!this.recentTitles.length) return 'continue';
    return this.shelfChoice || 'continue';
  }

  continueWatching: ContinueWatching[] = [];
  recentTitles: { title: CatalogTitle; link: ReturnType<typeof videoLink>; name: string; date: number }[] = [];
  categories: string[] = [];
  visibleTitles: CatalogTitle[] = [];
  featured?: CatalogTitle;
  featuredInfo?: TitleInfo;
  featuredPaused = false;
  selectedTitle?: CatalogTitle;
  selectedInfo?: TitleInfo;
  seriesGroups: { name: string; episodes: ReturnType<typeof videoFiles> }[] = [];
  watched = new Set<string>();
  trackingBusy = false;
  trackingError = '';
  private trackingRequest?: Subscription;
  private catalog?: Video;

  get nextUnwatched() {
    const file = this.seriesGroups.flatMap(group => group.episodes).find(item => !this.watched.has(item.relPath));
    return file && this.selectedTitle ? videoLink(this.selectedTitle.category, this.selectedTitle.title, file) : undefined;
  }

  episodeDisplay(name: string): string { return displayName(name); }

  titleDisplay(entry: CatalogTitle, resolved?: string): string {
    return resolved && resolved !== entry.title ? resolved : entry.displayTitle;
  }
  selectedCategory = '';
  isLoading = true;
  isError = false;
  loadingDetails = false;
  canEdit = false;
  fromReview = false;
  editing = false;
  editorBusy = false;
  searchingAnime = false;
  editError = '';
  editTitle = '';
  editSynopsis = '';
  editImage?: string | null;
  hasEditImage = false;
  animeQuery = '';
  animeResults: AnimeMatch[] = [];
  animeMatch?: AnimeMatch;
  private editorRequest?: Subscription;
  private animeRequest?: Subscription;

  private titles: CatalogTitle[] = [];
  private catalogRequest?: Subscription;
  private categoryRequest?: Subscription;
  private progressRequest?: Subscription;
  private featuredRequest?: Subscription;
  private featuredTimer?: Subscription;
  private featuredQueue: CatalogTitle[] = [];
  private detailRequest?: Subscription;

  constructor(private videoService: VideoService, private changeDetector: ChangeDetectorRef, private progress: WatchProgressService, private login: LoginService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.canEdit = this.login.isAdmin();
    this.categoryRequest = this.route.queryParamMap.subscribe(params => this.applyCategory(params.get('category')));
    this.loadCatalog();
  }

  ngOnDestroy(): void {
    this.trackingRequest?.unsubscribe();
    this.categoryRequest?.unsubscribe();
    this.cancelEdit();
    this.catalogRequest?.unsubscribe();
    this.progressRequest?.unsubscribe();
    this.featuredRequest?.unsubscribe();
    this.featuredTimer?.unsubscribe();
    this.detailRequest?.unsubscribe();
  }

  loadCatalog(): void {
    this.catalogRequest?.unsubscribe();
    this.progressRequest?.unsubscribe();
    this.featuredRequest?.unsubscribe();
    this.featuredTimer?.unsubscribe();
    this.continueWatching = [];
    this.isLoading = true;
    this.isError = false;
    this.catalogRequest = this.videoService.getVideos().subscribe({
      next: videos => {
        this.catalog = videos;
        this.titles = this.buildCatalog(videos);
        this.recentTitles = this.titles.flatMap(title => {
          const files = videoFiles(videos[title.category][title.title]);
          const latest = files.reduce((best, file) => (file.addedAt || 0) > (best.addedAt || 0) ? file : best, files[0]);
          return latest?.addedAt ? [{
            title, link: videoLink(title.category, title.title, latest),
            name: files.length > 1 ? displayName(latest.name) : '', date: latest.addedAt
          }] : [];
        }).sort((a, b) => b.date - a.date).slice(0, 12);
        this.progressRequest = this.progress.list().subscribe({
          next: progress => { this.continueWatching = this.buildContinueWatching(videos, progress); },
          error: () => {}
        });
        this.categories = Array.from(new Set(this.titles.map(entry => entry.category)));
        this.featuredQueue = [];
        this.featuredInfo = undefined;
        this.applyCategory(this.route.snapshot.queryParamMap.get('category'));
        this.isLoading = false;
        this.openReviewEntry();
        this.advanceFeatured();
        this.scheduleFeatured();
      },
      error: () => {
        this.isLoading = false;
        this.isError = true;
      }
    });
  }

  get canRotateFeatured(): boolean {
    return this.titles.length > 1;
  }

  advanceFeatured(): void {
    if (!this.featuredQueue.length) {
      this.featuredQueue = [...this.titles];
      for (let index = this.featuredQueue.length - 1; index > 0; index--) {
        const random = Math.floor(Math.random() * (index + 1));
        [this.featuredQueue[index], this.featuredQueue[random]] = [this.featuredQueue[random], this.featuredQueue[index]];
      }
      const last = this.featuredQueue.length - 1;
      if (last > 0 && this.featuredQueue[last] === this.featured) {
        [this.featuredQueue[0], this.featuredQueue[last]] = [this.featuredQueue[last], this.featuredQueue[0]];
      }
    }

    this.featured = this.featuredQueue.pop();
    this.featuredInfo = undefined;
    this.featuredRequest?.unsubscribe();
    if (!this.featured) return;
    const { category, title } = this.featured;
    this.featuredRequest = this.videoService.getVideoInfo(category, title).subscribe({
      next: info => { this.featuredInfo = info; },
      error: () => {}
    });
  }

  nextFeatured(): void {
    this.advanceFeatured();
    this.scheduleFeatured();
  }

  toggleFeaturedPause(): void {
    this.featuredPaused = !this.featuredPaused;
    this.scheduleFeatured();
  }

  private scheduleFeatured(): void {
    this.featuredTimer?.unsubscribe();
    if (!this.canRotateFeatured || this.featuredPaused) return;
    this.featuredTimer = interval(15_000).subscribe(() => {
      if (document.hidden || this.selectedTitle || this.selectedCategory) return;
      if (this.featuredSection?.nativeElement.matches(':hover, :focus-within')) return;
      this.advanceFeatured();
    });
  }

  private openReviewEntry(): void {
    if (!this.canEdit) return;
    const query = this.route.snapshot.queryParamMap;
    const category = query.get('reviewCategory');
    const title = query.get('reviewTitle');
    if (!category || !title) return;
    const entry = this.titles.find(item => item.category === category && item.title === title);
    if (!entry) return;
    this.fromReview = true;
    this.openTitle(entry);
    this.startEdit();
  }

  setCategory(category: string): void {
    void this.router.navigate([], {
      relativeTo: this.route, queryParams: { category: category || null }, queryParamsHandling: 'merge', replaceUrl: true
    });
  }

  private applyCategory(category: string | null): void {
    this.selectedCategory = category && this.categories.includes(category) ? category : '';
    this.visibleTitles = this.titles.filter(entry => !this.selectedCategory || entry.category === this.selectedCategory);
  }

  openTitle(entry: CatalogTitle): void {
    this.detailRequest?.unsubscribe();
    this.selectedTitle = entry;
    this.trackingRequest?.unsubscribe();
    this.trackingBusy = false;
    this.trackingError = '';
    this.watched = new Set();
    this.seriesGroups = [];
    const catalogEntry = this.catalog?.[entry.category]?.[entry.title];
    const episodes = catalogEntry ? videoFiles(catalogEntry) : [];
    if (episodes.length > 1) {
      const groups = new Map<number, typeof episodes>();
      const order = new Intl.Collator('es', { numeric: true });
      for (const episode of episodes.sort((a, b) => order.compare(a.name, b.name))) {
        const season = seasonNumber(episode.name) ?? Infinity;
        const files = groups.get(season) || [];
        files.push(episode);
        groups.set(season, files);
      }
      this.seriesGroups = [...groups].sort(([a], [b]) => a - b).map(([season, files]) => ({
        name: Number.isFinite(season) ? 'Temporada ' + season : 'Episodios', episodes: files
      }));
      this.trackingBusy = true;
      this.trackingRequest = this.progress.watched(entry.category, entry.title).subscribe({
        next: paths => { this.watched = new Set(paths); this.trackingBusy = false; },
        error: () => { this.trackingBusy = false; this.trackingError = 'No se pudo consultar el progreso.'; }
      });
    }
    this.selectedInfo = undefined;
    this.loadingDetails = true;
    this.changeDetector.detectChanges();
    this.titleDialog.nativeElement.showModal();
    this.detailRequest = this.videoService.getVideoInfo(entry.category, entry.title).subscribe({
      next: info => {
        this.selectedInfo = info;
        this.loadingDetails = false;
      },
      error: () => { this.loadingDetails = false; }
    });
  }

  markEpisode(path: string): void {
    const entry = this.selectedTitle;
    if (!entry || this.trackingBusy) return;
    const completed = !this.watched.has(path);
    this.trackingBusy = true;
    this.trackingError = '';
    this.trackingRequest = this.progress.mark(entry.category, entry.title, path, completed).subscribe({
      next: () => {
        if (completed) this.watched.add(path);
        else this.watched.delete(path);
        this.trackingBusy = false;
      },
      error: () => { this.trackingBusy = false; this.trackingError = 'No se pudo actualizar el episodio.'; }
    });
  }

  watchedCount(episodes: ReturnType<typeof videoFiles>): number {
    return episodes.filter(file => this.watched.has(file.relPath)).length;
  }

  closeTitle(): void {
    this.titleDialog.nativeElement.close();
  }

  clearTitle(): void {
    this.cancelEdit();
    this.detailRequest?.unsubscribe();
    this.selectedTitle = undefined;
  }

  get isAnime(): boolean {
    return this.normalize(this.selectedTitle?.category || '') === 'anime';
  }

  startEdit(): void {
    const entry = this.selectedTitle;
    if (!entry) return;
    this.editing = true;
    this.editorBusy = true;
    this.editError = '';
    this.editImage = undefined;
    this.animeQuery = this.selectedInfo?.title || entry.title;
    this.animeResults = [];
    this.editorRequest = this.videoService.getCatalogEdit(entry.category, entry.title).subscribe({
      next: data => {
        this.editTitle = data.title || '';
        this.editSynopsis = data.synopsis || '';
        this.hasEditImage = data.hasImage;
        this.animeMatch = data.match;
        this.editorBusy = false;
      },
      error: () => {
        this.editing = false;
        this.editorBusy = false;
        this.editError = 'No se pudo abrir el editor.';
      }
    });
  }

  cancelEdit(): void {
    this.editorRequest?.unsubscribe();
    this.animeRequest?.unsubscribe();
    this.editing = false;
    this.editorBusy = false;
    this.searchingAnime = false;
    this.editError = '';
  }

  searchAnime(): void {
    const entry = this.selectedTitle;
    const query = this.animeQuery.trim();
    if (!entry || !query) return;
    this.animeRequest?.unsubscribe();
    this.searchingAnime = true;
    this.editError = '';
    this.animeRequest = this.videoService.searchAnimeMatch(entry.category, entry.title, query).subscribe({
      next: results => {
        this.animeResults = results;
        this.searchingAnime = false;
        if (!results.length) this.editError = 'No se encontraron coincidencias en AniList.';
      },
      error: () => {
        this.searchingAnime = false;
        this.editError = 'No se pudo consultar AniList.';
      }
    });
  }

  async selectEditImage(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 700 * 1024) {
      this.editError = 'La portada debe pesar como máximo 700 KiB.';
      input.value = '';
      return;
    }
    this.editorBusy = true;
    this.editError = '';
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!this.editing) return;
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      this.editImage = btoa(binary);
      this.hasEditImage = true;
    } catch {
      this.editError = 'No se pudo leer la imagen.';
    } finally {
      this.editorBusy = false;
    }
  }

  saveEdit(): void {
    const entry = this.selectedTitle;
    if (!entry || this.editorBusy) return;
    this.editorBusy = true;
    this.editError = '';
    this.editorRequest = this.videoService.saveCatalogEdit(entry.category, entry.title, {
      displayTitle: this.editTitle,
      synopsis: this.editSynopsis,
      animeId: this.animeMatch?.id ?? null,
      image: this.editImage
    }).subscribe({
      next: () => {
        this.cancelEdit();
        const url = new URL(entry.imageUrl, document.baseURI);
        url.searchParams.set('v', String(Date.now()));
        entry.imageUrl = url.href;
        for (const item of this.continueWatching) {
          if (item.playUrl[1] === entry.category && item.playUrl[2] === entry.title) item.imageUrl = url.href;
        }
        this.detailRequest?.unsubscribe();
        this.loadingDetails = true;
        this.detailRequest = this.videoService.getVideoInfo(entry.category, entry.title).subscribe({
          next: info => {
            this.selectedInfo = info;
            if (this.featured === entry) this.featuredInfo = info;
            this.loadingDetails = false;
          },
          error: () => { this.loadingDetails = false; }
        });
      },
      error: response => {
        this.editorBusy = false;
        this.editError = response.error?.error || 'No se pudieron guardar los cambios.';
      }
    });
  }

  onThumbnailError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith('/miniatura_default.webp')) {
      image.src = 'assets/images/miniatura_default.webp';
    }
  }

  trackByTitle(index: number, entry: CatalogTitle): CatalogTitle {
    return entry;
  }

  private buildCatalog(catalog: Video): CatalogTitle[] {
    return Object.entries(catalog).flatMap(([category, entries]) =>
      Object.entries(entries).map(([title, entry]) => {
        const thumbnailParams = new URLSearchParams({ category, title });
        return {
          displayTitle: displayName(title),
          category,
          title,
          imageUrl: environments.baseURL + '/api/video/thumbnail?' + thumbnailParams,
          playUrl: ['/videos', category, title, this.findFirstVideo(entry)]
        };
      })
    );
  }

  private buildContinueWatching(catalog: Video, progress: WatchProgress[]): ContinueWatching[] {
    const episodes = new Map(progress.filter(item => item.position > 0).map(item => [item.path, item]));
    if (!episodes.size) return [];
    const matching = new Map<string, ContinueWatching>();
    const visit = (entry: Video[string][string], title: CatalogTitle): void => {
      for (const video of entry.videos || []) {
        const item = episodes.get(video.relPath);
        if (!item) continue;
        const seconds = Math.floor(item.position);
        const minutes = Math.floor(seconds / 60);
        const time = minutes + ':' + String(seconds % 60).padStart(2, '0');
        matching.set(item.path, {
          ...item, title: title.displayTitle, imageUrl: title.imageUrl,
          episode: displayName(video.name),
          playUrl: ['/videos', title.category, title.title, video.name],
          percent: item.position / item.duration * 100,
          time
        });
      }
      for (const folder of Object.values<Video[string][string]>(entry.folders || {})) visit(folder, title);
    };
    for (const title of this.titles) visit(catalog[title.category][title.title], title);
    return progress.flatMap(item => {
      const match = matching.get(item.path);
      return match ? [match] : [];
    }).slice(0, 12);
  }

  private findFirstVideo(node: Video[string][string]): string {
    const first = node.videos?.[0];
    if (first) return first.name;
    for (const folder of Object.values<Video[string][string]>(node.folders || {})) {
      const filename = this.findFirstVideo(folder);
      if (filename) return filename;
    }
    return '';
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
}
