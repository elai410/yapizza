import type { RawEmail, EventDetail, SessionUser, IntegrationMode, IntegrationStatus } from './types';

export interface MailSource {
  mode: IntegrationMode;
  pull(): Promise<RawEmail[]>;            // new messages since last pull
  inject(email: RawEmail): Promise<void>; // sim inbox: demo panel and paste
}

export interface CalendarSink {
  mode: IntegrationMode;
  insert(event: EventDetail, userId: string): Promise<{ externalId: string; link: string }>;
}

export interface Notifier {
  mode: IntegrationMode;
  send(msg: { to: string; subject: string; text: string; eventId?: string }): Promise<void>;
}

export interface AuthProvider {
  mode: IntegrationMode;
  currentUser(): Promise<SessionUser | null>;
}

export interface AdapterRegistry {
  mail(): MailSource;
  calendar(): CalendarSink;
  notifier(): Notifier;
  auth(): AuthProvider;
  status(): IntegrationStatus;
}
