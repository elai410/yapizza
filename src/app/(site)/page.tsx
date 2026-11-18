import { isOn } from '@/lib/contracts';
import { Feed } from '@/components/feed';

// design's layout provides <main> and the page gutter. The feed hero holds the page's h1.
export default function Home() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      {isOn('FEED') && <Feed />}
    </div>
  );
}
