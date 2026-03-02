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
  /** Caché para URLs de las miniaturas: rompe el bucle de cambios de Angular */
  private thumbnailCache: Record<string, string> = {};

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
    const cacheKey = `${category}-${subcategory}`;
    if (this.thumbnailCache[cacheKey]) {
      return this.thumbnailCache[cacheKey];
    }

    let urlToReturn = '';
    const thumbnails = this.videos[category]?.[subcategory]?.thumbnails;
    if (thumbnails && thumbnails[0]) {
      urlToReturn = `${this.baseUrl}/ngNehli/videos/${category}/${subcategory}/${thumbnails[0]}`;
    } else {
      // Si no hay miniatura local, pedimos al backend que busque una en bases de datos (APIs libres)
      urlToReturn = `${this.baseUrl}/api/video/thumbnail?category=${encodeURIComponent(category)}&title=${encodeURIComponent(subcategory)}`;
    }

    // Guardar en caché antes de retornar para evitar que Angular reevalúe infinitamente
    this.thumbnailCache[cacheKey] = urlToReturn;
    return urlToReturn;
  }

  /**
   * Busca recursivamente el primer video disponible en la jerarquía (útil si está en Temporada 1 > DVD 1)
   */
  getFirstVideoName(category: string, subcategory: string): string {
    const node = this.videos[category]?.[subcategory];
    if (!node) return 'unknown';
    return this.findFirstVideoInTree(node);
  }

  private findFirstVideoInTree(node: any): string {
    if (node.videos && node.videos.length > 0) {
      return node.videos[0].name;
    }
    if (node.folders) {
      for (const folderName in node.folders) {
        const found = this.findFirstVideoInTree(node.folders[folderName]);
        if (found) return found;
      }
    }
    return '';
  }

  onThumbnailError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    // Prevenir buble infinito si la imagen por defecto también falla
    if (!imgElement.src.includes('miniatura_default.webp')) {
      imgElement.src = 'assets/images/miniatura_default.webp';
    }
  }

  /**
   * TrackBy para el *ngFor de categorías y subcategorías.
   * Evita destruir/recrear el DOM cuando el array no cambia.
   */
  trackByKey(index: number, key: string): string {
    return key;
  }
}
