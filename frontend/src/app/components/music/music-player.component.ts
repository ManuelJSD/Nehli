import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { MusicService } from '../../services/music.service';
import { MusicPlayerService, MusicQueue } from '../../services/music-player.service';

@Component({
  selector: 'app-music-player',
  templateUrl: './music-player.component.html',
  styleUrls: ['./music-player.component.css']
})
export class MusicPlayerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('audio', { static: true }) private audio!: ElementRef<HTMLAudioElement>;
  selected: MusicQueue | null = null;
  error = '';
  showQueue = false;
  playing = false;
  elapsed = 0;
  duration = 0;
  seekable = false;
  volume = 1;
  muted = false;
  artworkFailed = false;
  private converting = false;
  private request?: Subscription;

  constructor(public player: MusicPlayerService, public music: MusicService) {}

  ngAfterViewInit(): void {
    this.request = this.player.current$.subscribe(selected => {
      const previousId = this.selected?.playbackId;
      this.selected = selected;
      if (selected?.playbackId === previousId) return;
      this.error = '';
      this.artworkFailed = false;
      if (!selected) {
        this.showQueue = false;
        const audio = this.audio.nativeElement;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        return;
      }
      const { mime } = selected.tracks[selected.index];
      this.converting = !this.audio.nativeElement.canPlayType(mime);
      this.load();
    });
  }

  get track() {
    return this.selected?.tracks[this.selected.index];
  }

  togglePlayback(): void {
    const audio = this.audio.nativeElement;
    if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
  }

  syncAudio(): void {
    const audio = this.audio.nativeElement;
    this.elapsed = audio.currentTime || 0;
    this.duration = Number.isFinite(audio.duration) ? audio.duration : this.track?.duration || 0;
    this.seekable = Number.isFinite(audio.duration) && audio.seekable.length > 0;
    this.playing = !audio.paused && !audio.ended;
    this.volume = audio.volume;
    this.muted = audio.muted;
  }

  seek(value: string): void {
    if (this.seekable) this.audio.nativeElement.currentTime = Number(value);
  }

  changeVolume(value: string): void {
    const audio = this.audio.nativeElement;
    audio.volume = Number(value);
    audio.muted = false;
  }

  toggleMute(): void {
    const audio = this.audio.nativeElement;
    audio.muted = !audio.muted;
  }

  formatTime(value: number): string {
    const seconds = Math.max(0, Math.floor(value));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  onMediaError(): void {
    if (!this.selected) return;
    if (this.converting) {
      this.error = 'No se pudo reproducir esta pista.';
      return;
    }
    this.converting = true;
    this.load();
  }

  ngOnDestroy(): void {
    this.player.close();
    this.request?.unsubscribe();
  }

  private load(): void {
    if (!this.selected) return;
    const audio = this.audio.nativeElement;
    const track = this.selected.tracks[this.selected.index];
    this.elapsed = 0;
    this.duration = track.duration || 0;
    this.seekable = false;
    audio.src = this.music.stream(track.id, this.converting);
    void audio.play().catch(() => {});
  }
}
