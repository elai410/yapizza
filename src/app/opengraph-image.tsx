import { ImageResponse } from 'next/og';

export const alt = 'Yapizza: every Yale event from the emails and flyers clubs already send.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 88, background: '#f7f7f5', color: '#14171c' }}>
        <svg width="120" height="120" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="15" fill="#00356B" />
          <g stroke="#F7F7F5" strokeWidth="1.2" strokeLinecap="round">
            <path d="M16 1v30" />
            <path d="M3 8.5l26 15" />
            <path d="M3 23.5l26-15" />
          </g>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 112, fontWeight: 700, letterSpacing: -4 }}>Yapizza</div>
          <div style={{ fontSize: 40, color: '#59616c', marginTop: 12 }}>Every Yale event from the emails and flyers clubs already send.</div>
        </div>
      </div>
    ),
    size,
  );
}
