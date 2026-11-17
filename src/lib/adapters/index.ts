import type { AdapterRegistry, AuthProvider, CalendarSink, MailSource, Notifier } from '@/lib/contracts';
import { forcedSim, gmailLive, googleConfigured, grokMode, notifyLive } from './env';
import { liveAuth } from './live/auth';
import { liveCalendar } from './live/calendar';
import { liveGmail } from './live/gmail';
import { liveNotifier } from './live/notifier';
import { simAuth } from './sim/auth';
import { simCalendar } from './sim/calendar';
import { simMail } from './sim/mail';
import { simNotifier } from './sim/notifier';

// One picker per service. Live adapters drop in here, gated on env.ts checks and !forcedSim().
const pickMail = (): MailSource => (gmailLive() ? liveGmail : simMail);
const googleLive = () => googleConfigured() && !forcedSim();
const pickCalendar = (): CalendarSink => (googleLive() ? liveCalendar : simCalendar);
const pickNotifier = (): Notifier => (notifyLive() ? liveNotifier : simNotifier);
const pickAuth = (): AuthProvider => (googleLive() ? liveAuth : simAuth);

export const adapters: AdapterRegistry = {
  mail: pickMail,
  calendar: pickCalendar,
  notifier: pickNotifier,
  auth: pickAuth,
  status: () => ({
    grok: grokMode(),
    gmail: pickMail().mode,
    gcal: pickCalendar().mode,
    notify: pickNotifier().mode,
    auth: pickAuth().mode,
    forcedSim: forcedSim(),
  }),
};
