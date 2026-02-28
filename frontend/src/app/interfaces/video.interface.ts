export interface Video {
  [category: string]: {
    [subcategory: string]: {
      videos: string[];
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
