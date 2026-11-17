import type { SessionUser } from '@/lib/contracts';
import { prisma } from '.';

/** The User row for a signed-in student, created on first use. */
export function ensureUser(u: SessionUser) {
  return prisma.user.upsert({
    where: { netid: u.netid },
    create: { netid: u.netid, name: u.name, college: u.college },
    update: { name: u.name, college: u.college },
  });
}
