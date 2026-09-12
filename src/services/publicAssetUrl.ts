const EXTERNAL_URL = /^(blob:|data:|https?:\/\/)/i;

export function resolvePublicAssetUrl(url: string) {
  if (!url || EXTERNAL_URL.test(url)) return url;

  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const cleanPath = url.replace(/^\/+/, '');
  const cleanBase = base.replace(/^\/+/, '');

  if (cleanBase && cleanPath.startsWith(cleanBase)) return `/${cleanPath}`;
  return `${base}${cleanPath}`;
}

export const resolveAudioUrl = resolvePublicAssetUrl;
