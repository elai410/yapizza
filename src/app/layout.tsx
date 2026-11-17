import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { Header } from '@/components/brand/Header';
import { IntroProvider } from '@/components/intro/IntroProvider';
import { Intro } from '@/components/intro/Intro';
import { Toaster } from '@/components/ui/Toast';
import './globals.css';

const sans = Geist({ variable: '--font-sans-face', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Yapizza',
  description: 'Every Yale event from the emails and flyers clubs already send.',
};

export const viewport: Viewport = { themeColor: '#f7f7f5' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${sans.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-raised"
        >
          Skip to content
        </a>
        <IntroProvider>
          <Header />
          <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-16 sm:px-6">
            {children}
          </main>
          <Intro />
        </IntroProvider>
        <Toaster />
      </body>
    </html>
  );
}
