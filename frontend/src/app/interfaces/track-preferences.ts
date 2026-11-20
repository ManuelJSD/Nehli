import { VideoTrack } from './video.interface';

export type PreferredTrack = Pick<VideoTrack, 'language' | 'title' | 'codec' | 'index'> & { image: boolean };
export type SubtitlePreference = PreferredTrack | { off: true };
export interface TrackPreferences {
  audio?: PreferredTrack;
  subtitle?: SubtitlePreference;
}

export function trackPreference(track: VideoTrack): PreferredTrack {
  const { language, title, codec, index } = track;
  return { language, title: title.slice(0, 512), codec, index, image: !!track.image };
}

const languageAliases: Record<string, string> = {
  spa: 'es', eng: 'en', jpn: 'ja', por: 'pt', fra: 'fr', fre: 'fr', deu: 'de', ger: 'de',
  ita: 'it', kor: 'ko', zho: 'zh', chi: 'zh', rus: 'ru', cat: 'ca', glg: 'gl', eus: 'eu', baq: 'eu'
};

function languageTag(value: string): string {
  const [base, ...qualifiers] = value.toLowerCase().replace(/_/g, '-').split('-');
  return [languageAliases[base] || base, ...qualifiers].join('-');
}

function descriptiveTitle(value: string): string {
  return value.trim().toLowerCase().replace(/^(audio|subtítulo)\s+\d+$/i, '');
}

export function findPreferredTrack(tracks: VideoTrack[], preference?: PreferredTrack): VideoTrack | undefined {
  if (!preference) return;
  const language = languageTag(preference.language);
  const title = descriptiveTitle(preference.title);
  const candidates = tracks.filter(track => language && language !== 'und'
    ? languageTag(track.language).split('-')[0] === language.split('-')[0]
    : !!title && descriptiveTitle(track.title) === title);
  const score = (track: VideoTrack) =>
    (languageTag(track.language) === language ? 16 : 0) +
    (title && descriptiveTitle(track.title) === title ? 8 : 0) +
    (!!track.image === preference.image ? 4 : 0) +
    (track.codec === preference.codec ? 2 : 0) +
    (track.index === preference.index ? 1 : 0);
  return candidates.reduce<VideoTrack | undefined>((best, track) =>
    !best || score(track) > score(best) ? track : best, undefined);
}
