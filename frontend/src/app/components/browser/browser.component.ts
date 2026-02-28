import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { Message } from 'primeng/api/message';
import { Video } from 'src/app/interfaces/video.interface';
import { VideoService } from 'src/app/services/video.service';
import { Router } from '@angular/router'; // importa Router

@Component({
  selector: 'app-browser',
  templateUrl: './browser.component.html',
  styleUrls: ['./browser.component.css']
})
export class BrowserComponent implements OnInit {
  @Output() sendDataEvent = new EventEmitter<any>();

  videos: Video = {};
  isLoading = false;
  isError = false;
  messages: Message[] = [];

  constructor(private videoService: VideoService, private router: Router) { } // Inyecta Router

  ngOnInit(): void {
    this.isLoading = true;
    this.videoService.getVideos().subscribe(
      videos => {
        this.videos = videos;
        this.isLoading = false;
      },
      error => {
        this.messages.push({ severity: 'error', summary: 'Error al cargar los videos', detail: 'Hubo un problema al cargar los videos' });
        this.isError = true;
        this.isLoading = false;
      }
    );
  }

  getObjectKeys(obj: any): string[] {
    return Object.keys(obj);
  }

  getImageUrl(category: string, subcategory: string): string {
    if (this.videos[category][subcategory].thumbnails[0] !== undefined) {
      return `http://192.168.1.12/ngNehli/videos/${category}/${subcategory}/${this.videos[category][subcategory].thumbnails[0]}`;
    } else {
      return 'assets/images/miniatura_default.webp';
    }
  }

  onThumbnailError(event: any) {
    event.target.src = 'assets/images/miniatura_default.webp';
  }
}
