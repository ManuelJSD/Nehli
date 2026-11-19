import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { Video } from 'src/app/interfaces/video.interface';
import { VideoService } from 'src/app/services/video.service';
import { environments } from 'src/environments/environments';

interface CatalogTitle {
  category: string;
  title: string;
  searchKey: string;
  imageUrl: string;
  playUrl: string[];
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
  @ViewChild('titleDialog', { static: true }) private titleDialog!: ElementRef<HTMLDialogElement>;

  categories: string[] = [];
  visibleTitles: CatalogTitle[] = [];
  featured?: CatalogTitle;
  featuredInfo?: TitleInfo;
  selectedTitle?: CatalogTitle;
  selectedInfo?: TitleInfo;
  selectedCategory = '';
  query = '';
  isLoading = true;
  isError = false;
  loadingDetails = false;

  private titles: CatalogTitle[] = [];
  private catalogRequest?: Subscription;
  private featuredRequest?: Subscription;
  private detailRequest?: Subscription;

  constructor(private videoService: VideoService, private changeDetector: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadCatalog();
  }

  ngOnDestroy(): void {
    this.catalogRequest?.unsubscribe();
    this.featuredRequest?.unsubscribe();
    this.detailRequest?.unsubscribe();
  }

  loadCatalog(): void {
    this.catalogRequest?.unsubscribe();
    this.featuredRequest?.unsubscribe();
    this.isLoading = true;
    this.isError = false;
    this.catalogRequest = this.videoService.getVideos().subscribe({
      next: videos => {
        this.titles = this.buildCatalog(videos);
        this.categories = Array.from(new Set(this.titles.map(entry => entry.category)));
        this.featured = this.titles[0];
        this.featuredInfo = undefined;
        this.applyFilters();
        this.isLoading = false;
        if (this.featured) {
          const { category, title } = this.featured;
          this.featuredRequest = this.videoService.getVideoInfo(category, title).subscribe({
            next: info => { this.featuredInfo = info; },
            error: () => {}
          });
        }
      },
      error: () => {
        this.isLoading = false;
        this.isError = true;
      }
    });
  }

  setCategory(category: string): void {
    this.selectedCategory = category;
    this.applyFilters();
  }

  setQuery(query: string): void {
    this.query = query;
    this.applyFilters();
  }

  resetFilters(): void {
    this.query = '';
    this.selectedCategory = '';
    this.applyFilters();
  }

  openTitle(entry: CatalogTitle): void {
    this.detailRequest?.unsubscribe();
    this.selectedTitle = entry;
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

  closeTitle(): void {
    this.titleDialog.nativeElement.close();
  }

  clearTitle(): void {
    this.detailRequest?.unsubscribe();
    this.selectedTitle = undefined;
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

  private applyFilters(): void {
    const search = this.normalize(this.query.trim());
    this.visibleTitles = this.titles.filter(entry =>
      (!this.selectedCategory || entry.category === this.selectedCategory) && entry.searchKey.includes(search)
    );
  }

  private buildCatalog(catalog: Video): CatalogTitle[] {
    return Object.entries(catalog).flatMap(([category, entries]) =>
      Object.entries(entries).map(([title, entry]) => {
        const thumbnailParams = new URLSearchParams({ category, title });
        return {
          category,
          title,
          searchKey: this.normalize(title),
          imageUrl: environments.baseURL + '/api/video/thumbnail?' + thumbnailParams,
          playUrl: ['/videos', category, title, this.findFirstVideo(entry)]
        };
      })
    );
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
