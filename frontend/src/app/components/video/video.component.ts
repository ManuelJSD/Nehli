import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VideoService } from 'src/app/services/video.service';
import { environments } from 'src/environments/environments';
import videojs from 'video.js';

@Component({
  selector: 'app-video',
  templateUrl: './video.component.html',
  styleUrls: ['./video.component.css']
})
export class VideoComponent implements OnInit, OnDestroy {

  category: string = '';
  subcategory: string = '';
  video: string = '';
  videoUrl: string = '';
  listVideos: string[] = [];
  typeExtension: string = '';

  player: any;
  private baseUrl: string = environments.baseURL;

  constructor(private route: ActivatedRoute, private videoService: VideoService) {
    this.route.params.subscribe((params) => {
      this.category = params['category'];
      this.subcategory = params['subcategory'];
      this.video = params['video'];
    });

    this.videoUrl = `${this.baseUrl}/ngNehli/videos/${this.category}/${this.subcategory}/${this.video}`;
  }

  ngOnInit() {
    this.videoService.getVideosAndThumbnails(this.category, this.subcategory).subscribe({
      next: (data) => {
        this.listVideos = data.videos;
      },
      error: () => {
        this.listVideos = [];
      }
    });

    this.reproducir();
  }

  /** Limpia el player de video.js para evitar memory leaks */
  ngOnDestroy(): void {
    if (this.player) {
      this.player.dispose();
    }
  }

  reproducir() {
    this.videoExtension();

    const options = {
      autoplay: true,
      controls: true,
      sources: [{
        src: this.videoUrl,
        poster: 'assets/images/logo.webp',
        type: this.typeExtension
      }]
    };
    this.player = videojs('my-video', options);
  }

  videoExtension() {
    const parts = this.video.split('.');
    if (parts.length > 1) {
      this.typeExtension = 'video/' + parts[parts.length - 1];
    } else {
      this.typeExtension = 'video/mp4';
    }
  }

  seleccionarCapitulo(event: { value: string }) {
    this.videoUrl = `${this.baseUrl}/ngNehli/videos/${this.category}/${this.subcategory}/${event.value}`;
    this.player.src(this.videoUrl);
  }
}
