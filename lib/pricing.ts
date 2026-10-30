// Your price estimates for the Get Quote estimator.
// Every price is a [low, high] range in US dollars. Change any number here and
// the estimator updates. Use the same number twice (e.g. [120, 120]) for a fixed price.

import type { VehicleType } from '@/lib/booking-rules';

export type PriceRange = readonly [number, number];

/** Vehicles in the "large" group are priced higher. */
export type VehicleSize = 'standard' | 'large';

export const LARGE_VEHICLES: readonly VehicleType[] = [
  'SUV',
  'Minivan',
  'Van',
  'Pickup Truck',
];

export function vehicleSize(type: VehicleType): VehicleSize {
  return LARGE_VEHICLES.includes(type) ? 'large' : 'standard';
}

// ---------------------------------------------------------------------------
// Window tint
// ---------------------------------------------------------------------------

export const TINT_FILMS = ['Carbon', 'Ceramic'] as const;
export type TintFilm = (typeof TINT_FILMS)[number];

export const TINT_FILM_DESCRIPTIONS: Record<TintFilm, string> = {
  Carbon:
    'Great value. Blocks UV and reduces glare; matte look that never fades.',
  Ceramic: 'Our best film. Maximum heat rejection with the clearest view.',
};

export const TINT_COVERAGE = ['Sides & rear', 'Front two windows'] as const;
export type TintCoverage = (typeof TINT_COVERAGE)[number];

export const TINT_PRICES: Record<
  TintCoverage,
  Record<TintFilm, Record<VehicleSize, PriceRange>>
> = {
  // All side windows plus the rear windshield
  'Sides & rear': {
    Carbon: { standard: [250, 350], large: [300, 425] },
    Ceramic: { standard: [350, 500], large: [450, 650] },
  },
  // Driver and front passenger windows only (e.g. to match factory rear tint)
  'Front two windows': {
    Carbon: { standard: [120, 120], large: [120, 120] },
    Ceramic: { standard: [150, 150], large: [150, 150] },
  },
};

export const TINT_ADD_ONS = [
  {
    id: 'windshield',
    label: 'Windshield (ceramic)',
    prices: { standard: [185, 325], large: [185, 325] },
  },
  {
    id: 'sunroof',
    label: 'Sunroof / panoramic roof',
    prices: { standard: [150, 300], large: [150, 300] },
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  prices: Record<VehicleSize, PriceRange>;
}>;
export type TintAddOnId = (typeof TINT_ADD_ONS)[number]['id'];

/** Removing old tint first, by how many windows are being redone. */
export const TINT_REMOVAL_PRICES: Record<TintCoverage, PriceRange> = {
  'Sides & rear': [135, 175],
  'Front two windows': [50, 50],
};

// ---------------------------------------------------------------------------
// Ceramic coating
// ---------------------------------------------------------------------------

export const COATING_PACKAGES = [
  'Essential (3–5 years)',
  'Premium (7+ years)',
] as const;
export type CoatingPackage = (typeof COATING_PACKAGES)[number];

export const COATING_PACKAGE_DESCRIPTIONS: Record<CoatingPackage, string> = {
  'Essential (3–5 years)': 'Deep gloss and easy washing for daily drivers.',
  'Premium (7+ years)':
    'Our longest-lasting coating with the strongest protection.',
};

export const COATING_PRICES: Record<
  CoatingPackage,
  Record<VehicleSize, PriceRange>
> = {
  'Essential (3–5 years)': { standard: [800, 1400], large: [850, 1600] },
  'Premium (7+ years)': { standard: [1500, 2000], large: [1550, 2200] },
};

export const COATING_NOTE =
  'Paint correction, if your paint needs it before coating, is quoted separately after we see the car.';

// ---------------------------------------------------------------------------
// Paint protection film (PPF)
// ---------------------------------------------------------------------------

export const PPF_PACKAGES = [
  'Partial front',
  'Full front',
  'Full car',
] as const;
export type PpfPackage = (typeof PPF_PACKAGES)[number];

export const PPF_PACKAGE_DESCRIPTIONS: Record<PpfPackage, string> = {
  'Partial front':
    'Bumper, headlights, and the front part of the hood and fenders.',
  'Full front':
    'Full bumper, hood, fenders and headlights. Our most popular option.',
  'Full car': 'Every painted panel, for complete protection.',
};

export const PPF_PRICES: Record<PpfPackage, Record<VehicleSize, PriceRange>> = {
  'Partial front': { standard: [800, 950], large: [900, 1000] },
  'Full front': { standard: [1600, 1950], large: [1800, 2150] },
  'Full car': { standard: [5000, 5500], large: [5500, 6000] },
};

// ---------------------------------------------------------------------------
// Estimate math
// ---------------------------------------------------------------------------

export type QuoteSelection =
  | {
      service: 'Window Tint';
      vehicleType: VehicleType;
      film: TintFilm;
      coverage: TintCoverage;
      addOns: TintAddOnId[];
      removeOldTint: boolean;
    }
  | {
      service: 'Ceramic Coating';
      vehicleType: VehicleType;
      coatingPackage: CoatingPackage;
    }
  | {
      service: 'Paint Protection Film';
      vehicleType: VehicleType;
      ppfPackage: PpfPackage;
    };

export function estimatePrice(selection: QuoteSelection): PriceRange {
  const size = vehicleSize(selection.vehicleType);

  if (selection.service === 'Ceramic Coating') {
    return COATING_PRICES[selection.coatingPackage][size];
  }
  if (selection.service === 'Paint Protection Film') {
    return PPF_PRICES[selection.ppfPackage][size];
  }

  let [low, high] = TINT_PRICES[selection.coverage][selection.film][size];
  for (const addOn of TINT_ADD_ONS) {
    if (!selection.addOns.includes(addOn.id)) continue;
    low += addOn.prices[size][0];
    high += addOn.prices[size][1];
  }
  if (selection.removeOldTint) {
    low += TINT_REMOVAL_PRICES[selection.coverage][0];
    high += TINT_REMOVAL_PRICES[selection.coverage][1];
  }
  return [low, high];
}

const dollars = (amount: number) =>
  amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

/** [350, 500] -> "$350 – $500"; [120, 120] -> "$120" */
export function formatPriceRange([low, high]: PriceRange): string {
  return low === high ? dollars(low) : `${dollars(low)} – ${dollars(high)}`;
}

/** Short description of the choices, e.g. "Ceramic film, sides & rear + windshield (ceramic)". */
export function describeSelection(selection: QuoteSelection): string {
  if (selection.service === 'Window Tint') {
    const extras = [
      ...TINT_ADD_ONS.filter((a) => selection.addOns.includes(a.id)).map((a) =>
        a.label.toLowerCase(),
      ),
      ...(selection.removeOldTint ? ['remove old tint'] : []),
    ];
    return `${selection.film} film, ${selection.coverage.toLowerCase()}${
      extras.length ? ` + ${extras.join(', ')}` : ''
    }`;
  }
  if (selection.service === 'Ceramic Coating') return selection.coatingPackage;
  return selection.ppfPackage;
}

/** The booking form's window choices that match a tint estimate. */
export function tintWindowsFor(selection: QuoteSelection): string[] {
  if (selection.service !== 'Window Tint') return [];
  const windows =
    selection.coverage === 'Sides & rear'
      ? ['Front side windows', 'Rear side windows', 'Rear windshield']
      : ['Front side windows'];
  if (selection.addOns.includes('windshield')) windows.push('Full windshield');
  if (selection.addOns.includes('sunroof')) windows.push('Sunroof');
  return windows;
}
