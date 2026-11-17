import { adapters } from '@/lib/adapters';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(adapters.status());
}
