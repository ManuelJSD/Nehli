import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TreeNode } from 'primeng/api';
import { Subscription } from 'rxjs';
import videojs from 'video.js';
import { VideoMetadata, VideoTrack } from 'src/app/interfaces/video.interface';
import { VideoService } from 'src/app/services/video.service';
import { environments } from 'src/environments/environments';

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
  selectedNode: TreeNode | null = null;
  audios: VideoTrack[] = [];
  subtitles: VideoTrack[] = [];
  subtitleOptions: { title: string; index: number }[] = [];
  currentAudioIndex?: number;
  currentSubtitleIndex = -1;
  playbackError = '';
  subtitleStatus = '';

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

  constructor(private route: ActivatedRoute, private videoService: VideoService) {
    this.category = this.route.snapshot.params['category'];
    this.subcategory = this.route.snapshot.params['subcategory'];
    this.video = this.route.snapshot.params['video'];
  }

  ngOnInit(): void {
    this.catalogRequest = this.videoService.getVideosAndThumbnails(this.category, this.subcategory).subscribe({
      next: data => {
        this.filesTree = this.buildTreeNodes(data);
        const node = this.findVideoNode(this.filesTree, this.video) || this.findVideoNode(this.filesTree);
        if (node) this.seleccionarCapitulo({ node });
      },
      error: () => {
        this.playbackError = 'No se pudo cargar el catálogo de vídeos.';
      }
    });
  }

  ngOnDestroy(): void {
    this.catalogRequest?.unsubscribe();
    this.metadataRequest?.unsubscribe();
    this.clearSubtitle();
    this.player?.dispose();
  }

  private buildTreeNodes(data: any): TreeNode[] {
    const folders = Object.entries(data?.folders || {}).map(([label, contents]) => ({
      label,
      expanded: true,
      icon: 'pi pi-folder-open',
      children: this.buildTreeNodes(contents),
      selectable: false
    }));
    const videos: TreeNode[] = (data?.videos || []).map((video: { name: string; relPath: string }) => ({
      label: video.name,
      icon: 'pi pi-video',
      data: video
    }));
    return [...folders, ...videos];
  }

  private findVideoNode(nodes: TreeNode[], filename?: string): TreeNode | undefined {
    for (const node of nodes) {
      if (node.data && (filename === undefined || node.data.name === filename)) return node;
      const child = this.findVideoNode(node.children || [], filename);
      if (child) return child;
    }
    return undefined;
  }

  seleccionarCapitulo({ node }: { node: TreeNode }): void {
    if (!node.data || node.data.relPath === this.videoRelPath) return;
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
    this.subtitleOptions = [];
    this.currentAudioIndex = undefined;
    this.currentSubtitleIndex = -1;
    this.playbackError = '';

    this.metadataRequest = this.videoService.getVideoMetadata(this.videoRelPath).subscribe({
      next: metadata => {
        this.metadata = metadata;
        this.audios = metadata.audios;
        this.subtitles = metadata.subtitles;
        this.subtitleOptions = [
          { index: -1, title: 'Desactivados' },
          ...this.subtitles.map(({ index, title, language }) => ({
            index,
            title: language === 'und' ? title : title + ' (' + language.toUpperCase() + ')'
          }))
        ];
        this.currentAudioIndex = (this.audios.find(track => track.default) || this.audios[0])?.index;
        this.currentSubtitleIndex = (this.subtitles.find(track => track.default) || this.subtitles[0])?.index ?? -1;
        this.loadSource({ time: 0, paused: false });
      },
      error: () => {
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
        controlBar: { subsCapsButton: false }
      });
    }
    const player = this.player;
    this.clearSourceListener();
    this.detachSubtitle();
    this.playbackError = '';
    this.pendingPlayback = playback;
    this.onSourceReady = () => {
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
