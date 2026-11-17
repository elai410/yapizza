import { isOn } from '@/lib/contracts';
import { Feed } from '@/components/feed';

export default function Home() {
  return <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">{isOn('FEED') && <Feed />}</main>;
}
