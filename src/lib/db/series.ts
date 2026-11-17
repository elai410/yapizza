import { detectSeries } from '@/lib/pipeline/series';
import { prisma } from '.';

/** Rebuilds Series rows and Event.seriesId from every non-review event; returns how many series were found. */
export async function refreshSeries(): Promise<number> {
  const rows = await prisma.event.findMany({
    where: { status: { not: 'review' } },
    select: { id: true, title: true, start: true, host: { select: { name: true } } },
  });
  const found = await detectSeries(rows.map((e) => ({ id: e.id, title: e.title, start: e.start.toISOString(), hostName: e.host?.name ?? null })));

  await prisma.$transaction(async (tx) => {
    // Raw SQL so updatedAt stays put; touching every event would resurface the whole feed in `since` polling.
    await tx.$executeRaw`UPDATE "Event" SET "seriesId" = NULL WHERE "seriesId" IS NOT NULL`;
    await tx.series.deleteMany();
    for (const s of found) {
      const row = await tx.series.create({
        data: { title: s.title, hostName: s.hostName, typicalMonth: s.typicalMonth, yearsSeen: JSON.stringify(s.yearsSeen), isTradition: s.isTradition },
      });
      for (const id of s.eventIds) await tx.$executeRaw`UPDATE "Event" SET "seriesId" = ${row.id} WHERE "id" = ${id}`;
    }
  });
  return found.length;
}
