import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Listing, Page } from './types';

/**
 * Find a listing we already have from a list screen (discover feed, saved, a profile grid, related items) so the
 * detail screen can paint instantly while the full record loads — same idea as the web app's cardSeed.
 */
export function cardSeed(qc: QueryClient, id: string): Listing | undefined {
  for (const [, data] of qc.getQueriesData<unknown>({})) {
    const found = scan(data, id); if (found) return withDefaults(found);
  }
  return undefined;
}

/** Feed cards are slimmed down (no description, wanted categories, exchange methods…); fill the gaps so the detail screen renders safely. */
const DEFAULTS = { description: '', currency: 'INR', wantedText: null, wantedCategories: [], cashFlexibility: 'NONE', exchangeMethods: [], locationCity: null, locationRegion: null, createdAt: '', related: [] };
const withDefaults = (l: Listing): Listing => Object.assign({}, DEFAULTS, l, { images: l.images ?? [] }) as Listing;

function scan(data: unknown, id: string): Listing | undefined {
  if (!data || typeof data !== 'object') return undefined;
  if (Array.isArray(data)) return data.find((x): x is Listing => isListing(x) && x.id === id);
  const inf = data as InfiniteData<Page<Listing>>;
  if (Array.isArray(inf.pages)) for (const p of inf.pages) { const f = p?.items?.find((x) => isListing(x) && x.id === id); if (f) return f; }
  const page = data as Page<Listing>;
  if (Array.isArray(page.items)) return page.items.find((x) => isListing(x) && x.id === id);
  const l = data as Listing;
  if (Array.isArray(l.related)) return l.related.find((x) => x.id === id);
  return undefined;
}

const isListing = (x: unknown): x is Listing => !!x && typeof x === 'object' && 'images' in x && 'condition' in x && 'owner' in x;
