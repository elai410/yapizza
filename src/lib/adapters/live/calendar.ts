import { google } from 'googleapis';
import type { CalendarSink } from '@/lib/contracts';
import { TZ, eventDetails, eventLocation, nextDay, nyDate, timedEnd } from '@/lib/calendar/gcal-link';
import { simCalendar } from '../sim/calendar';
import { oauthClient } from './google';
import { getGoogleUser, updateGoogleTokens } from './google-users';

const ymd = ([y, m, d]: [number, number, number]) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const liveCalendar: CalendarSink = {
  mode: 'live',
  async insert(event, userId) {
    const g = getGoogleUser(userId);
    if (!g) return simCalendar.insert(event, userId);
    try {
      const auth = oauthClient();
      auth.setCredentials(g.tokens);
      auth.on('tokens', (t) => updateGoogleTokens(userId, t));
      const [start, end] = event.allDay
        ? [{ date: ymd(nyDate(event.start)) }, { date: ymd(nextDay(nyDate(event.end ?? event.start))) }]
        : [
            { dateTime: new Date(event.start).toISOString(), timeZone: TZ },
            { dateTime: timedEnd(event.start, event.end).toISOString(), timeZone: TZ },
          ];
      const { data } = await google.calendar({ version: 'v3', auth }).events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: event.title,
          description: [eventDetails(event), 'Source: Yapizza'].filter(Boolean).join('\n\n'),
          location: eventLocation(event) ?? undefined,
          start,
          end,
        },
      });
      if (!data.id || !data.htmlLink) throw new Error('insert returned no id or link');
      return { externalId: data.id, link: data.htmlLink };
    } catch (err) {
      console.error('[gcal] live insert failed, using sim:', err instanceof Error ? err.message : err);
      return simCalendar.insert(event, userId);
    }
  },
};
