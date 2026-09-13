// Public address only; credentials remain in browser storage, never build-time environment.
export const relayBase = (import.meta.env.DEV && typeof window !== 'undefined' ? window.location.origin : (import.meta.env.VITE_ECHO_API_BASE_URL || 'https://echo-atlas-api.giraffetree.cn')).replace(/\/+$/, '');
export function apiEndpoint(path:string) {return `${relayBase}${path}`;}
export function asrEndpoint() {return apiEndpoint('/api/echo-asr').replace(/^http/, 'ws');}
