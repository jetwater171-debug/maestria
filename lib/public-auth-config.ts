export type PublicAuthConfig = { url: string; key: string };

export function publicAuthConfig(value: unknown): PublicAuthConfig | null {
  if (!value || typeof value !== 'object') return null;
  const { url, key } = value as Record<string, unknown>;
  if (typeof url !== 'string' || typeof key !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
    if (!key.startsWith('sb_publishable_')) {
      const payload = key.split('.')[1];
      if (!payload || JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role !== 'anon') return null;
    }
    return { url, key };
  } catch { return null; }
}

const cacheKey = 'maestria-public-auth-config-v1';

export async function loadPublicAuthConfig(): Promise<PublicAuthConfig> {
  let response: Response;
  try {
    response = await fetch('/api/auth-config', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  } catch {
    // This contains only the public project URL/key, never the session or a secret key.
    let cached: PublicAuthConfig | null = null;
    try { cached = publicAuthConfig(JSON.parse(localStorage.getItem(cacheKey) || 'null')); } catch {}
    if (cached) return cached;
    throw Error('Sem conexão. Abra o painel com internet neste aparelho antes de usar offline.');
  }
  const data = await response.json() as unknown;
  if (!response.ok) {
    // An explicit server error must not fall back to an old project configuration.
    throw Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Falha ao carregar acesso.');
  }
  const config = publicAuthConfig(data);
  if (!config) throw Error('Configuração pública de acesso inválida.');
  try { localStorage.setItem(cacheKey, JSON.stringify(config)); } catch {}
  return config;
}
