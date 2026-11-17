import type { GrokMode } from '@/lib/contracts';

const set = (k: string) => Boolean(process.env[k]);

export const forcedSim = () => process.env.YAPIZZA_FORCE_SIM === '1';
export const googleConfigured = () => set('GOOGLE_CLIENT_ID') && set('GOOGLE_CLIENT_SECRET');
export const gmailLive = () => googleConfigured() && set('GMAIL_INTAKE_REFRESH_TOKEN') && !forcedSim();
export const notifyLive = () => set('RESEND_API_KEY') && set('ALERT_FROM_EMAIL') && !forcedSim();

export function grokMode(): GrokMode {
  if (forcedSim()) return 'replay';
  const m = process.env.GROK_MODE;
  if (m === 'live' || m === 'record' || m === 'replay') return m;
  return set('XAI_API_KEY') ? 'live' : 'replay';
}
