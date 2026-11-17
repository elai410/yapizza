import type { AdapterRegistry, AuthProvider, CalendarSink, MailSource, Notifier } from '@/lib/contracts';
import { forcedSim, gmailLive, grokMode } from './env';
import { liveGmail } from './live/gmail';
import { simAuth } from './sim/auth';
import { simCalendar } from './sim/calendar';
import { simMail } from './sim/mail';
import { simNotifier } from './sim/notifier';

// One picker per service. Live adapters drop in here, gated on env.ts checks and !forcedSim().
const pickMail = (): MailSource => (gmailLive() ? liveGmail : simMail);
const pickCalendar = (): CalendarSink => simCalendar; // CP4: live Google Calendar
const pickNotifier = (): Notifier => simNotifier; // CP3: notifyLive() ? resend : simNotifier
const pickAuth = (): AuthProvider => simAuth; // CP4: Google sign-in

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
