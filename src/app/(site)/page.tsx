import { isOn } from '@/lib/contracts';
import { Feed } from '@/components/feed';

// design's layout provides <main> and the page gutter.
export default function Home() {
  return <div className="mx-auto w-full max-w-3xl py-6">{isOn('FEED') && <Feed />}</div>;
}
