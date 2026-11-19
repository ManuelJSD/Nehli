import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TreeNode } from 'primeng/api';
import { catchError, forkJoin, of, Subscription, timeout } from 'rxjs';
import videojs from 'video.js';
import { VideoMetadata, VideoTrack } from 'src/app/interfaces/video.interface';
import { VideoService } from 'src/app/services/video.service';
import { WatchProgressService } from 'src/app/services/watch-progress.service';
import { environments } from 'src/environments/environments';

type SubtitleStyle = {
  size: 'small' | 'normal' | 'large';
  color: string;
  background: 'transparent' | 'rgba(0, 0, 0, 0.6)' | '#000000';
  outline: boolean;
};

const subtitleStyleKey = 'nehli.subtitleStyle';
const defaultSubtitleStyle: SubtitleStyle = {
  size: 'normal',
  color: '#ffffff',
  background: 'transparent',
  outline: true
};

function readSubtitleStyle(): SubtitleStyle {
  try {
    const saved = JSON.parse(localStorage.getItem(subtitleStyleKey) || '{}') as Partial<SubtitleStyle> | null;
    return {
      size: saved?.size === 'small' || saved?.size === 'large' ? saved.size : 'normal',
      color: typeof saved?.color === 'string' && /^#[0-9a-f]{6}$/i.test(saved.color) ? saved.color : '#ffffff',
      background: saved?.background === '#000000' || saved?.background === 'rgba(0, 0, 0, 0.6)'
        ? saved.background
        : 'transparent',
      outline: saved?.outline !== false
    };
  } catch {
    return { ...defaultSubtitleStyle };
  }
}

const playerSpanish = {
  'Play': 'Reproducir',
  'Pause': 'Pausar',
  'Play Video': 'Reproducir vídeo',
  'Mute': 'Silenciar',
  'Unmute': 'Activar sonido',
  'Volume Level': 'Volumen',
  'Progress Bar': 'Progreso',
  'Playback Rate': 'Velocidad de reproducción',
  'Fullscreen': 'Pantalla completa',
  'Exit Fullscreen': 'Salir de pantalla completa',
  'Picture-in-Picture': 'Imagen en imagen',
  'Exit Picture-in-Picture': 'Salir de imagen en imagen',
  'Skip backward {1} seconds': 'Retroceder {1} segundos',
  'Skip forward {1} seconds': 'Adelantar {1} segundos',
  'Current Time': 'Tiempo transcurrido',
  'Duration': 'Duración'
};

const playerControls = {
  skipButtons: { backward: 10, forward: 10 },
  volumePanel: { inline: false },
  remainingTimeDisplay: false,
  subsCapsButton: false
};

@Component({
  selector: 'app-video',
  templateUrl: './video.component.html',
  styleUrls: ['./video.component.css']
})
export class VideoComponent implements OnInit, OnDestroy {
  category = '';
  subcategory = '';
  video = '';
  videoRelPath = '';
  filesTree: TreeNode[] = [];
  episodeCount = 0;
  nextEpisode?: TreeNode;
  loadingVideo = true;
  selectedNode: TreeNode | null = null;
  audios: VideoTrack[] = [];
  subtitles: VideoTrack[] = [];
  subtitleOptions: { title: string; index: number }[] = [];
  currentAudioIndex?: number;
  currentSubtitleIndex = -1;
  playbackError = '';
  subtitleStatus = '';
  hasTextSubtitles = false;
  subtitleStyle = readSubtitleStyle();

  private episodes: TreeNode[] = [];
  private lastProgress?: { position: number; completed: boolean };
  private lastProgressAt = 0;
  private player?: ReturnType<typeof videojs>;
  private metadata?: VideoMetadata;
  private catalogRequest?: Subscription;
  private metadataRequest?: Subscription;
  private removeSubtitle?: () => void;
  private loadedSubtitleIndex?: number;
  private subtitleRequest?: AbortController;
  private subtitleUrl?: string;
  private pendingPlayback?: { time: number; paused: boolean };
  private onSourceReady?: () => void;

  constructor(private route: ActivatedRoute, private videoService: VideoService, private progress: WatchProgressService) {
    this.category = this.route.snapshot.params['category'];
    this.subcategory = this.route.snapshot.params['subcategory'];
    this.video = this.route.snapshot.params['video'];
  }

  ngOnInit(): void {
    this.catalogRequest = this.videoService.getVideosAndThumbnails(this.category, this.subcategory).subscribe({
      next: data => {
        this.filesTree = this.buildTreeNodes(data);
        this.episodes = this.flattenEpisodes(this.filesTree);
        this.episodeCount = this.episodes.length;
        const episode = this.route.snapshot.queryParamMap.get('episode');
        const node = this.episodes.find(item => episode && item.data.relPath === episode)
          || this.episodes.find(item => item.data.name === this.video)
          || this.episodes[0];
        if (node) {
          this.seleccionarCapitulo({ node });
        } else {
          this.loadingVideo = false;
          this.playbackError = 'No hay vídeos disponibles.';
        }
      },
      error: () => {
        this.loadingVideo = false;
        this.playbackError = 'No se pudo cargar el catálogo de vídeos.';
      }
    });
  }

  ngOnDestroy(): void {
    this.saveProgress();
    this.catalogRequest?.unsubscribe();
    this.metadataRequest?.unsubscribe();
    this.clearSubtitle();
    this.player?.dispose();
  }

  get episodeLabel(): string {
    return this.episodeName(this.video);
  }

  private episodeName(filename: string): string {
    return filename.replace(/\.[a-z0-9]{2,5}$/i, '');
  }

  private flattenEpisodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.flatMap(node => node.children ? this.flattenEpisodes(node.children) : [node]);
  }

  private buildTreeNodes(data: any, parentKey = ''): TreeNode[] {
    const compare = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });
    const folders = Object.entries(data?.folders || {}).sort(([a], [b]) => compare(a, b)).map(([label, contents]) => {
      const key = parentKey + encodeURIComponent(label) + '/';
      return {
        key: 'folder:' + key,
        label,
        expanded: true,
        icon: 'pi pi-folder',
        children: this.buildTreeNodes(contents, key),
        selectable: false
      };
    });
    const videos: TreeNode[] = (data?.videos || []).map((video: { name: string; relPath: string }) => ({
      key: 'video:' + video.relPath,
      label: this.episodeName(video.name),
      icon: 'pi pi-play',
      data: video
    }));
    return [...folders, ...videos.sort((a, b) => compare(a.data.name, b.data.name))];
  }

  playNextEpisode(): void {
    if (this.nextEpisode) this.seleccionarCapitulo({ node: this.nextEpisode });
  }

  @HostListener('window:pagehide')
  saveProgress(): void {
    const player = this.player;
    const duration = player?.duration();
    const current = player?.currentTime();
    if (!player || !duration || !Number.isFinite(duration) || current === undefined ||
        !Number.isFinite(current) || !this.metadata || this.pendingPlayback || this.loadingVideo) return;

    const position = Math.max(0, Math.min(current, duration));
    const completed = player.ended();
    if ((!position && !this.lastProgress) ||
        (position === this.lastProgress?.position && completed === this.lastProgress.completed)) return;

    const path = this.videoRelPath;
    const update = { position, completed };
    this.lastProgress = update;
    this.lastProgressAt = Date.now();
    void this.progress.save({ path, duration, ...update }, this.lastProgressAt).then(saved => {
      if (!saved && this.lastProgress === update) this.lastProgress = undefined;
    });
  }

  @HostListener('document:visibilitychange')
  saveProgressWhenHidden(): void {
    if (document.visibilityState === 'hidden') this.saveProgress();
  }

  seleccionarCapitulo({ node }: { node: TreeNode }): void {
    if (!node.data || node.data.relPath === this.videoRelPath) return;
    this.saveProgress();
    this.lastProgress = undefined;
    this.lastProgressAt = Date.now();
    this.nextEpisode = this.episodes[this.episodes.findIndex(item => item.data.relPath === node.data.relPath) + 1];
    this.loadingVideo = true;
    this.video = node.data.name;
    this.videoRelPath = node.data.relPath;
    this.selectedNode = node;
    this.metadataRequest?.unsubscribe();
    this.player?.pause();
    this.clearSourceListener();
    this.clearSubtitle();
    this.metadata = undefined;
    this.audios = [];
    this.subtitles = [];
    this.hasTextSubtitles = false;
    this.subtitleOptions = [];
    this.currentAudioIndex = undefined;
    this.currentSubtitleIndex = -1;
    this.playbackError = '';

    this.metadataRequest = forkJoin({
      metadata: this.videoService.getVideoMetadata(this.videoRelPath),
      progress: this.progress.get(this.videoRelPath).pipe(timeout(2500), catchError(() => of(null)))
    }).subscribe({
      next: ({ metadata, progress }) => {
        this.metadata = metadata;
        this.audios = metadata.audios;
        this.subtitles = metadata.subtitles;
        this.hasTextSubtitles = this.subtitles.some(track => !track.image);
        this.subtitleOptions = [
          { index: -1, title: 'Desactivados' },
          ...this.subtitles.map(({ index, title, language }) => ({
            index,
            title: language === 'und' ? title : title + ' (' + language.toUpperCase() + ')'
          }))
        ];
        this.currentAudioIndex = (this.audios.find(track => track.default) || this.audios[0])?.index;
        this.currentSubtitleIndex = (this.subtitles.find(track => track.default) || this.subtitles[0])?.index ?? -1;
        const position = progress && !progress.completed && progress.position < metadata.duration
          ? progress.position : 0;
        if (position > 0) this.lastProgress = { position, completed: false };
        this.loadSource({ time: position, paused: false });
      },
      error: () => {
        this.loadingVideo = false;
        this.playbackError = 'No se pudo leer este vídeo. Comprueba que FFmpeg y ffprobe estén disponibles en el servidor.';
      }
    });
  }

  cambiarAudio({ value }: { value: number }): void {
    if (value === this.currentAudioIndex) return;
    this.currentAudioIndex = value;
    this.reloadSource();
  }

  cambiarSubtitulo({ value }: { value: number }): void {
    if (value === this.currentSubtitleIndex) return;
    const previous = this.selectedSubtitle();
    this.currentSubtitleIndex = value;
    if (previous?.image || this.selectedSubtitle()?.image) {
      this.reloadSource();
    } else {
      void this.loadSubtitle();
    }
  }

  updateSubtitleStyle(changes: Partial<SubtitleStyle>): void {
    this.subtitleStyle = { ...this.subtitleStyle, ...changes };
    try {
      localStorage.setItem(subtitleStyleKey, JSON.stringify(this.subtitleStyle));
    } catch {
      // Keep the preferences for this playback when browser storage is unavailable.
    }
  }

  resetSubtitleStyle(): void {
    this.updateSubtitleStyle(defaultSubtitleStyle);
  }

  private selectedSubtitle(): VideoTrack | undefined {
    return this.subtitles.find(track => track.index === this.currentSubtitleIndex);
  }

  private reloadSource(): void {
    if (!this.player || !this.metadata) return;
    this.loadSource(this.pendingPlayback || { time: this.player.currentTime() ?? 0, paused: this.player.paused() });
  }

  private loadSource(playback: { time: number; paused: boolean }): void {
    const subtitle = this.selectedSubtitle();
    const useHls = this.metadata?.duration && (!this.metadata.directPlay || subtitle?.image);
    const query = new URLSearchParams({ path: this.videoRelPath });
    if (this.currentAudioIndex !== undefined) query.set('audio', String(this.currentAudioIndex));
    if (subtitle?.image) query.set('subtitle', String(subtitle.index));

    if (!this.player) {
      this.player = videojs('my-video', {
        controls: true,
        preload: 'auto',
        poster: 'assets/images/logo.webp',
        aspectRatio: '16:9',
        language: 'es',
        languages: { es: playerSpanish },
        playbackRates: [0.75, 1, 1.25, 1.5, 2],
        controlBar: playerControls
      });
      this.player.on('error', () => { this.loadingVideo = false; });
      this.player.on('pause', () => this.saveProgress());
      this.player.on('ended', () => this.saveProgress());
      this.player.on('seeked', () => this.saveProgress());
      this.player.on('timeupdate', () => {
        if (!this.player?.paused() && Date.now() - this.lastProgressAt >= 10000) this.saveProgress();
      });
      this.player.on('ratechange', () => {
        const rate = this.player?.playbackRate();
        if (rate && this.player?.defaultPlaybackRate() !== rate) this.player?.defaultPlaybackRate(rate);
      });
    }
    const player = this.player;
    this.clearSourceListener();
    this.detachSubtitle();
    this.playbackError = '';
    this.loadingVideo = true;
    this.pendingPlayback = playback;
    this.onSourceReady = () => {
      this.loadingVideo = false;
      this.onSourceReady = undefined;
      this.pendingPlayback = undefined;
      if (playback.time > 0) player.currentTime(playback.time);
      this.attachSubtitle();
      if (!playback.paused) player.play()?.catch(() => {});
    };
    player.one('loadedmetadata', this.onSourceReady);
    player.src({
      src: this.streamUrl(useHls ? 'playlist' : 'play', query),
      type: useHls ? 'application/x-mpegURL' : 'video/mp4'
    });
    void this.loadSubtitle();
  }

  private clearSourceListener(): void {
    if (this.onSourceReady) this.player?.off('loadedmetadata', this.onSourceReady);
    this.onSourceReady = undefined;
    this.pendingPlayback = undefined;
  }

  private detachSubtitle(): void {
    this.removeSubtitle?.();
    this.removeSubtitle = undefined;
  }

  private clearSubtitle(): void {
    this.detachSubtitle();
    this.subtitleRequest?.abort();
    this.subtitleRequest = undefined;
    if (this.subtitleUrl) URL.revokeObjectURL(this.subtitleUrl);
    this.subtitleUrl = undefined;
    this.loadedSubtitleIndex = undefined;
    this.subtitleStatus = '';
  }

  private async loadSubtitle(): Promise<void> {
    const subtitle = this.selectedSubtitle();
    if (subtitle?.index === this.loadedSubtitleIndex) return;
    this.clearSubtitle();
    if (!subtitle || subtitle.image) return;

    this.loadedSubtitleIndex = subtitle.index;
    this.subtitleStatus = 'Cargando subtítulos…';
    const request = new AbortController();
    this.subtitleRequest = request;
    const query = new URLSearchParams({ path: this.videoRelPath, trackIndex: String(subtitle.index) });

    try {
      const url = this.streamUrl('subtitle', query);
      // Show the start of the track without waiting for the entire video to be read.
      const preview = await fetch(url + '&preview=1', { signal: request.signal })
        .then(response => response.ok ? response.text() : '')
        .catch(() => '');
      if (request.signal.aborted) return;
      if (preview.includes(' --> ')) this.setSubtitleText(preview);

      const response = await fetch(url, { signal: request.signal });
      if (!response.ok) {
        const failure = await response.json().catch(() => undefined);
        throw new Error(failure?.error === 'La pista no contiene subtítulos de texto'
          ? failure.error
          : 'No se pudo cargar la pista de subtítulos.');
      }
      const text = await response.text();
      if (request.signal.aborted) return;
      if (text !== preview) this.setSubtitleText(text);
    } catch (error) {
      if (request.signal.aborted) return;
      this.subtitleStatus = error instanceof Error && error.message !== 'Failed to fetch'
        ? error.message
        : 'No se pudo cargar la pista de subtítulos.';
      this.loadedSubtitleIndex = undefined;
    } finally {
      if (this.subtitleRequest === request) this.subtitleRequest = undefined;
    }
  }

  private setSubtitleText(text: string): void {
    this.detachSubtitle();
    if (this.subtitleUrl) URL.revokeObjectURL(this.subtitleUrl);
    this.subtitleUrl = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
    this.attachSubtitle();
  }

  private attachSubtitle(): void {
    const subtitle = this.selectedSubtitle();
    const player = this.player;
    if (!player || !subtitle || !this.subtitleUrl || this.pendingPlayback || this.removeSubtitle) return;

    const track = player.addRemoteTextTrack({
      kind: 'subtitles',
      label: subtitle.title,
      language: subtitle.language,
      srclang: subtitle.language,
      src: this.subtitleUrl
    }, true) as unknown as HTMLTrackElement;
    const remove = () => player.removeRemoteTextTrack(track as unknown as ReturnType<typeof player.addRemoteTextTrack>);
    this.removeSubtitle = remove;
    track.addEventListener('load', () => {
      if (this.removeSubtitle === remove) this.subtitleStatus = '';
    }, { once: true });
    track.addEventListener('error', () => {
      if (this.removeSubtitle === remove) this.subtitleStatus = 'El navegador no pudo leer la pista de subtítulos.';
    }, { once: true });
    track.track.mode = 'showing';
  }


  private streamUrl(endpoint: string, query: URLSearchParams): string {
    return environments.baseURL + '/api/stream/' + endpoint + '?' + query;
  }
}
