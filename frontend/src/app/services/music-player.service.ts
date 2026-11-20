import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MusicAlbum, MusicTrack } from './music.service';

export interface MusicQueue {
  tracks: MusicTrack[];
  index: number;
  playbackId: number;
}

@Injectable({ providedIn: 'root' })
export class MusicPlayerService {
  private readonly current = new BehaviorSubject<MusicQueue | null>(null);
  private playbackId = 0;
  private ended = false;
  readonly current$ = this.current.asObservable();

  play(album: MusicAlbum, index = 0): void {
    this.start(album.tracks, index);
  }

  add(track: MusicTrack): void {
    const queue = this.current.value;
    if (!queue) {
      this.start([track], 0);
      return;
    }
    const tracks = [...queue.tracks, track];
    if (this.ended) this.start(tracks, queue.index + 1);
    else this.current.next({ ...queue, tracks });
  }

  remove(index: number): void {
    const queue = this.current.value;
    if (!queue || index <= queue.index || !queue.tracks[index]) return;
    this.current.next({ ...queue, tracks: queue.tracks.filter((_, position) => position !== index) });
  }

  skip(direction: -1 | 1): void {
    const queue = this.current.value;
    if (queue) this.start(queue.tracks, queue.index + direction);
  }

  finish(): void {
    const queue = this.current.value;
    if (queue?.tracks[queue.index + 1]) this.skip(1);
    else this.ended = true;
  }

  close(): void {
    this.ended = false;
    this.current.next(null);
  }

  private start(tracks: MusicTrack[], index: number): void {
    if (!tracks[index]) return;
    this.ended = false;
    this.current.next({ tracks, index, playbackId: ++this.playbackId });
  }
}
