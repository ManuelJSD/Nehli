export interface Video {
  [category: string]: {
    [subcategory: string]: {
      folders: any;
      videos: { name: string; relPath: string }[];
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
