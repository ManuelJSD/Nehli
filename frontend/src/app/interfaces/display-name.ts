export function displayName(name: string): string {
  const cleaned = name.replace(/\.(?:mkv|mp4|avi|webm|mov|m4v|ts|wmv|mpg)$/i, '')
    .replace(/\[[^\]]+\]|\{[^}]+\}/g, ' ')
    .replace(/(?:[\s._-]+)(?:\d{3,4}p|4k|web[ .-]?dl|blu[ .-]?ray|b[dr]rip|x26[45]|hevc)\b.*$/i, '')
    .replace(/_/g, ' ').replace(/(?<=\w)\.(?=\w)/g, ' ').replace(/\s+/g, ' ').replace(/[-–. ]+$/, '').trim();
  return cleaned || name;
}

export function seasonNumber(name: string): number | undefined {
  const match = name.match(/(?:\bS(\d{1,2})[ ._-]*E\d|(?:^|\D)(\d{1,2})x\d{1,3}\b|\b(?:temporada|season|s)\s*(\d{1,2})\b)/i);
  return match ? Number(match[1] || match[2] || match[3]) : undefined;
}
