export interface Video {
  [category: string]: {
    [subcategory: string]: {
      folders: any;
      videos: { name: string; relPath: string; addedAt?: number }[];
      thumbnails: string[];
    };
  };
}

export interface listVideos {
  [subfolder: string]: {
    videos: string[];
    thumbnails: string[];
  } | { error: string };
}

export interface VideoTrack {
  index: number;
  title: string;
  language: string;
  codec: string;
  default: boolean;
  image?: boolean;
}

export interface VideoMetadata {
  audios: VideoTrack[];
  subtitles: VideoTrack[];
  directPlay: boolean;
  duration: number;
}

export interface WatchProgress {
  path: string;
  position: number;
  duration: number;
  completed: boolean;
}

export interface AnimeMatch {
  id: number;
  title: string;
  year?: number;
  coverUrl?: string;
}

export interface CatalogEdit {
  title?: string;
  synopsis?: string;
  match?: AnimeMatch;
  hasImage: boolean;
}
