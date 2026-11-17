import { test, type Page } from '@playwright/test';
import { isOn, type Flag } from '../../src/lib/contracts/flags';

// The lead runs the gate as `SMOKE_CP=<n> pnpm test:smoke`.
export const SMOKE_CP = Number(process.env.SMOKE_CP ?? process.env.NEXT_PUBLIC_MAX_CP ?? 5);

export function flagOn(flag: Flag): boolean {
  return isOn(flag);
}

// Call inside a describe or test: skips work above the checkpoint under test, or behind an off flag.
export function forCp(cp: number, flag?: Flag): void {
  test.skip(cp > SMOKE_CP, `CP${cp} is above SMOKE_CP=${SMOKE_CP}`);
  if (flag) test.skip(!flagOn(flag), `flag ${flag} is off`);
}

// Opens a page with the intro already marked seen; Escape is a fallback skip.
export async function gotoApp(page: Page, path = '/') {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('yapizza:intro-seen', '1');
    } catch {}
  });
  const response = await page.goto(path);
  await page.keyboard.press('Escape');
  return response;
}
