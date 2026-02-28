import { Component, OnInit } from '@angular/core';
import { Message } from 'primeng/api/message';
import { Video } from 'src/app/interfaces/video.interface';
import { VideoService } from 'src/app/services/video.service';
import { environments } from 'src/environments/environments';

@Component({
  selector: 'app-browser',
  templateUrl: './browser.component.html',
  styleUrls: ['./browser.component.css']
})
export class BrowserComponent implements OnInit {

  videos: Video = {};
  /** Claves de categorías pre-calculadas para evitar llamar Object.keys() en el template */
  categoryKeys: string[] = [];
  /** Mapa de claves de subcategorías pre-calculadas por categoría */
  subcategoryKeysMap: Record<string, string[]> = {};

  isLoading = false;
  isError = false;
  messages: Message[] = [];

  private baseUrl: string = environments.baseURL;

  constructor(private videoService: VideoService) { }

  ngOnInit(): void {
    this.isLoading = true;
    this.videoService.getVideos().subscribe({
      next: (videos) => {
        this.videos = videos;
        this.categoryKeys = Object.keys(videos);
        this.categoryKeys.forEach(cat => {
          this.subcategoryKeysMap[cat] = Object.keys(videos[cat]);
        });
        this.isLoading = false;
      },
      error: () => {
        this.messages.push({
          severity: 'error',
          summary: 'Error al cargar',
          detail: 'No se pudieron cargar los videos. Comprueba la conexión.'
        });
        this.isError = true;
        this.isLoading = false;
      }
    });
  }

  getImageUrl(category: string, subcategory: string): string {
    const thumbnails = this.videos[category]?.[subcategory]?.thumbnails;
    if (thumbnails && thumbnails[0]) {
      return `${this.baseUrl}/ngNehli/videos/${category}/${subcategory}/${thumbnails[0]}`;
    }
    return 'assets/images/miniatura_default.webp';
  }

  onThumbnailError(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/images/miniatura_default.webp';
  }

  /**
   * TrackBy para el *ngFor de categorías y subcategorías.
   * Evita destruir/recrear el DOM cuando el array no cambia.
   */
  trackByKey(index: number, key: string): string {
    return key;
  }
}
