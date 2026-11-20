import { Video } from './video.interface';

type Entry = Video[string][string];
export function videoFiles(entry: Entry): Entry['videos'] {
  return [...(entry.videos || []), ...Object.values<Entry>(entry.folders || {}).flatMap(videoFiles)];
}

export function videoLink(category: string, title: string, file: Entry['videos'][number]) {
  return { url: ['/videos', category, title, file.name], params: { episode: file.relPath } };
}
