import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { VideoService } from 'src/app/services/video.service';

import videojs from 'video.js';

@Component({
  selector: 'app-video',
  templateUrl: './video.component.html',
  styleUrls: ['./video.component.css']
})
export class VideoComponent implements OnInit {

  category: string = '';
  subcategory: string = '';
  video: string = '';
  videoUrl!: string;
  listVideos: string[] = [];
  typeExtension!: string;

  player: any;

  constructor(private route: ActivatedRoute, private videoService: VideoService) {
    this.route.params.subscribe((params) => {
      this.category = params['category'];
      this.subcategory = params['subcategory'];
      this.video = params['video'];
    });

    this.videoUrl = `http://192.168.1.12/ngNehli/videos/${this.category}/${this.subcategory}/${this.video}`;
  }

  ngOnInit() {

    this.videoService.getVideosAndThumbnails(this.category, this.subcategory).subscribe(data => {
      this.listVideos = data.videos;
    });

    this.reproducir();
  }

  reproducir() {

    this.videoExtension();

    const options = {
      autoplay: true,
      controls: true,
      sources: [{
        src: this.videoUrl,
        poster: "assets/images/logo.webp",
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
      this.typeExtension =  'video/unknown'; // Default value if there's no extension
    }
  }

  seleccionarCapitulo(event: { value: any; }) {
    this.videoUrl = `http://192.168.1.12/ngNehli/videos/${this.category}/${this.subcategory}/${event.value}`;

    this.player.src(this.videoUrl);

  }

}
