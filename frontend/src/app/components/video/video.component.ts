import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VideoService } from 'src/app/services/video.service';
import { environments } from 'src/environments/environments';
import { TreeNode } from 'primeng/api';
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
  videoRelPath: string = ''; // Ruta codificada en base64 para el backend
  videoUrl: string = '';
  filesTree: TreeNode[] = [];
  selectedNode: TreeNode | null = null;
  typeExtension: string = '';

  audios: any[] = [];
  subtitles: any[] = [];
  currentAudioIndex: string = '0'; // Pista de audio por defecto

  player: any;
  private baseUrl: string = environments.baseURL;

  constructor(private route: ActivatedRoute, private videoService: VideoService) {
    this.route.params.subscribe((params) => {
      this.category = params['category'];
      this.subcategory = params['subcategory'];
      this.video = params['video'];
    });
  }

  ngOnInit() {
    // Al cargar la página, pedimos el árbol de la serie
    this.videoService.getVideosAndThumbnails(this.category, this.subcategory).subscribe({
      next: (data) => {
        this.filesTree = this.buildTreeNodes(data);
        // Buscar el video inicial en el árbol para poder extraer su relPath
        this.findInitialVideo(this.filesTree, this.video);

        // Si no se encontró un video en la ruta, autoseleccionamos el primero válido del árbol
        if (!this.videoRelPath && this.filesTree.length > 0) {
          this.selectFirstAvailableVideo(this.filesTree);
        }

        if (this.videoRelPath) {
          this.cargarMetadata();
        }
      },
      error: () => {
        this.filesTree = [];
      }
    });
  }

  /** Función recursiva para transformar el JSON del backend a PrimeNG Tree */
  buildTreeNodes(data: any): TreeNode[] {
    const nodes: TreeNode[] = [];

    if (!data) return nodes;

    // Procesar carpetas anidadas
    if (data.folders) {
      Object.keys(data.folders).forEach(folderName => {
        const folderData = data.folders[folderName];
        nodes.push({
          label: folderName,
          expanded: true, // Expandir por defecto
          icon: 'pi pi-folder-open',
          children: this.buildTreeNodes(folderData),
          selectable: false // Solo las hojas son reproducibles
        });
      });
    }

    // Procesar videos de este nivel
    if (data.videos) {
      data.videos.forEach((vid: any) => {
        nodes.push({
          label: vid.name,
          icon: 'pi pi-video',
          data: vid, // Guardamos los metadatos (name, relPath) aquí
          selectable: true
        });
      });
    }

    return nodes;
  }

  /** Buscar el relPath del video provisto en la URL plana antigua */
  findInitialVideo(nodes: TreeNode[], targetName: string) {
    if (!targetName) return;

    for (let node of nodes) {
      if (node.data && node.data.name === targetName) {
        this.videoRelPath = node.data.relPath;
        this.selectedNode = node;
        return;
      }
      if (node.children) {
        this.findInitialVideo(node.children, targetName);
      }
    }
  }

  /** Función de fallback que coge la primera hoja del árbol para su visualización */
  selectFirstAvailableVideo(nodes: TreeNode[]) {
    for (let node of nodes) {
      if (node.data && node.data.relPath) {
        this.video = node.data.name;
        this.videoRelPath = node.data.relPath;
        this.selectedNode = node;
        return;
      }
      if (node.children && node.children.length > 0) {
        this.selectFirstAvailableVideo(node.children);
        if (this.videoRelPath) return; // Romper bucle si ya se encontró
      }
    }
  }

  cargarMetadata() {
    this.videoService.getVideoMetadata(this.videoRelPath).subscribe({
      next: (metadata) => {
        this.audios = metadata.audios || [];
        this.subtitles = metadata.subtitles || [];
        // Reiniciamos el índice de audio predeterminado al cargar un nuevo capítulo
        this.currentAudioIndex = this.audios.length > 0 ? this.audios[0].index.toString() : '0';

        // Iniciamos el reproductor recién cuando sabemos las pistas
        this.reproducir();
      },
      error: (err) => {
        console.error('Error cargando las pistas del video', err);
        // Fallback: reproducir a ciegas (comportamiento original)
        this.audios = [];
        this.subtitles = [];
        this.reproducir();
      }
    });
  }

  /** Limpia el player de video.js para evitar memory leaks */
  ngOnDestroy(): void {
    if (this.player) {
      this.player.dispose();
    }
  }

  reproducir() {
    // Evitamos re-inicializar el reproductor si ya existe, solo cambiamos el src
    if (this.player) {
      this.videoExtension();
      this.player.src({
        src: this.videoUrl,
        type: this.typeExtension
      });
      this.iniciarSubtitulos();
      return;
    }

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

    this.player.ready(() => {
      this.iniciarSubtitulos();
    });
  }

  iniciarSubtitulos() {
    if (!this.player) return;

    // Limpiar subtítulos anteriores
    const oldTracks = this.player.remoteTextTracks();
    let i = oldTracks.length;
    while (i--) {
      this.player.removeRemoteTextTrack(oldTracks[i]);
    }

    // Inyectar subtitulos desde el backend (.vtt generados on-the-fly)
    if (this.subtitles && this.subtitles.length > 0) {
      this.subtitles.forEach((sub) => {
        this.player.addRemoteTextTrack({
          kind: 'captions',
          label: sub.title || sub.language,
          language: sub.language,
          src: `${this.baseUrl}/api/stream/subtitle?path=${encodeURIComponent(this.videoRelPath)}&trackIndex=${sub.index}`
        }, false);
      });
    }
  }

  videoExtension() {
    const parts = this.video.split('.');
    const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';

    // Todos los streaming viajan por el base64 sin revelar el path estricto
    const encodedPath = encodeURIComponent(this.videoRelPath);

    if (ext === 'mkv') {
      this.typeExtension = 'video/mp4'; // El backend hace remux a MP4 (h264/aac)
      this.videoUrl = `${this.baseUrl}/api/stream/play?path=${encodedPath}&audio=${this.currentAudioIndex}`;
    } else {
      this.typeExtension = ext ? 'video/' + ext : 'video/mp4';
      this.videoUrl = `${this.baseUrl}/api/stream/play?path=${encodedPath}`;
    }
  }

  seleccionarCapitulo(event: any) {
    const node: TreeNode = event.node;
    if (node && node.data) {
      this.video = node.data.name;
      this.videoRelPath = node.data.relPath;
      this.selectedNode = node;

      // Al cambiar de capítulo, primero recargamos la metadata
      // cargarMetadata llamará a reproducir() automáticamente una vez finalice.
      this.cargarMetadata();
    }
  }

  cambiarAudioAudio(event: { value: string }) {
    if (!this.player) return;

    this.currentAudioIndex = event.value;

    // Capturar tiempo actual
    const currentTime = this.player.currentTime();

    // Al cambiar la extensión/URL, usamos el nuevo índice en la query string
    this.videoExtension();

    this.player.src({
      src: this.videoUrl,
      type: this.typeExtension
    });

    // Restaurar por donde iba y darle play
    this.player.currentTime(currentTime);
    this.player.play();
  }
}
