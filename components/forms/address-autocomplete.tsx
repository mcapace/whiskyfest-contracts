'use client';

import { useEffect, useMemo, useRef } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { Input, Label } from '@/components/ui/input';
import { COUNTRIES, PINNED_COUNTRIES_COUNT, parseGoogleCountry } from '@/lib/countries';
import { US_STATE_CODES } from '@/lib/exhibitor-address';

export interface AddressValue {
  exhibitor_address_line1: string;
  exhibitor_address_line2: string;
  exhibitor_city: string;
  exhibitor_state: string;
  exhibitor_zip: string;
  exhibitor_country: string;
}

export interface BillingAddressValue {
  billing_address_line1: string;
  billing_address_line2: string;
  billing_city: string;
  billing_state: string;
  billing_zip: string;
  billing_country: string;
}

type AddressAutocompleteProps =
  | { mode?: 'mailing'; value: AddressValue; onChange: (patch: Partial<AddressValue>) => void }
  | { mode: 'billing'; value: BillingAddressValue; onChange: (patch: Partial<BillingAddressValue>) => void };

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type PlaceAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

/** Avoid `Promise<void>` in .tsx inline types — parsed as JSX. */
type PlaceWithFields = {
  fetchFields: (arg: { fields: string[] }) => Promise<void>;
  addressComponents?: PlaceAddressComponent[];
};

function getComponentText(
  components: PlaceAddressComponent[],
  type: string,
  mode: 'short' | 'long' = 'long',
): string {
  const found = components.find((c) => Array.isArray(c.types) && c.types.includes(type));
  if (!found) return '';
  return mode === 'short' ? (found.shortText ?? found.longText ?? '') : (found.longText ?? found.shortText ?? '');
}

export function AddressAutocomplete(props: AddressAutocompleteProps) {
  const mode = props.mode ?? 'mailing';
  const isBilling = mode === 'billing';
  const value = props.value;
  const onChange = props.onChange;

  const keys = isBilling
    ? ({
        line1: 'billing_address_line1',
        line2: 'billing_address_line2',
        city: 'billing_city',
        state: 'billing_state',
        zip: 'billing_zip',
        country: 'billing_country',
      } as const)
    : ({
        line1: 'exhibitor_address_line1',
        line2: 'exhibitor_address_line2',
        city: 'exhibitor_city',
        state: 'exhibitor_state',
        zip: 'exhibitor_zip',
        country: 'exhibitor_country',
      } as const);

  const row = value as unknown as Record<string, string>;
  const line1 = row[keys.line1] ?? '';
  const line2 = row[keys.line2] ?? '';
  const city = row[keys.city] ?? '';
  const state = row[keys.state] ?? '';
  const zip = row[keys.zip] ?? '';
  const country = row[keys.country] ?? '';

  const patch = (p: Record<string, string>) => onChange(p as never);

  const autocompleteHostRef = useRef<HTMLDivElement>(null);
  const pinnedCountries = COUNTRIES.slice(0, PINNED_COUNTRIES_COUNT);
  const remainingCountries = COUNTRIES.slice(PINNED_COUNTRIES_COUNT);

  const isUS = (country || '').trim() === 'United States';
  const zipLabel = isUS ? 'Zip' : 'Postal Code';
  const stateLabel = isUS ? 'State' : 'Province/Region';

  const line1Label = isBilling ? 'Billing Address Line 1' : 'Address Line 1';
  const line2Label = isBilling ? 'Billing Address Line 2' : 'Address Line 2';
  const cityLabel = isBilling ? 'Billing City' : 'City';
  const idPrefix = isBilling ? 'billing-addr' : 'addr';

  useEffect(() => {
    if (!MAPS_KEY || typeof window === 'undefined' || !autocompleteHostRef.current) return;

    setOptions({
      key: MAPS_KEY,
      v: 'weekly',
      libraries: ['places'],
    });

    const host = autocompleteHostRef.current;
    host.innerHTML = '';

    let disposed = false;
    let cancelled = false;

    const handleSelect = async (evt: Event) => {
      if (disposed) return;

      const e = evt as Event & {
        placePrediction?: { toPlace?: () => PlaceWithFields };
      };

      const prediction =
        e.placePrediction ??
        ((e as CustomEvent<{ placePrediction?: { toPlace?: () => PlaceWithFields } }>).detail?.placePrediction);
      const place = prediction?.toPlace?.();
      if (!place) return;

      try {
        await place.fetchFields({ fields: ['addressComponents'] });
      } catch {
        return;
      }

      const components = (place.addressComponents ?? []) as PlaceAddressComponent[];
      const streetNumber = getComponentText(components, 'street_number', 'long');
      const route = getComponentText(components, 'route', 'long');
      const cityVal =
        getComponentText(components, 'locality', 'long') ||
        getComponentText(components, 'postal_town', 'long') ||
        getComponentText(components, 'administrative_area_level_2', 'long') ||
        getComponentText(components, 'sublocality', 'long');
      const countryCode = getComponentText(components, 'country', 'short').toUpperCase();
      const countryName = parseGoogleCountry(countryCode) ?? '';
      const isUsOrCa = countryCode === 'US' || countryCode === 'CA';
      const stateVal = isUsOrCa
        ? getComponentText(components, 'administrative_area_level_1', 'short')
        : getComponentText(components, 'administrative_area_level_1', 'long');

      patch({
        [keys.line1]: [streetNumber, route].filter(Boolean).join(' ').trim(),
        [keys.city]: cityVal,
        [keys.state]: stateVal,
        [keys.zip]: getComponentText(components, 'postal_code', 'long'),
        [keys.country]: countryName || country || 'United States',
      });
    };

    void importLibrary('places')
      .then(() => {
        if (cancelled || disposed) return;
        const autocompleteEl = new (google.maps.places as unknown as {
          PlaceAutocompleteElement: new () => HTMLElement;
        }).PlaceAutocompleteElement();
        autocompleteEl.setAttribute('style', 'display:block; width:100%;');
        autocompleteEl.setAttribute('placeholder', 'Start typing an address');
        host.appendChild(autocompleteEl);
        autocompleteEl.addEventListener('gmp-select', handleSelect as EventListener);
        (host as unknown as { __wfAutocompleteEl?: HTMLElement }).__wfAutocompleteEl = autocompleteEl;
      })
      .catch(() => {
        /* Allow manual entry if Google loader fails */
      });

    return () => {
      cancelled = true;
      disposed = true;
      const el = (host as unknown as { __wfAutocompleteEl?: HTMLElement }).__wfAutocompleteEl;
      if (el) el.removeEventListener('gmp-select', handleSelect as EventListener);
      host.innerHTML = '';
    };
  }, [onChange, isBilling, country, MAPS_KEY]);

  const hasLegacyCountry = useMemo(() => {
    const current = country?.trim();
    return Boolean(current) && !COUNTRIES.some((c) => c.name === current);
  }, [country]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{isBilling ? 'Search Billing Address' : 'Search Address'}</Label>
        <div
          ref={autocompleteHostRef}
          className="wf-place-autocomplete min-h-9 rounded-md border border-input bg-background px-2 py-1"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-line-1`}>{line1Label}</Label>
        <Input
          id={`${idPrefix}-line-1`}
          autoComplete="address-line1"
          value={line1}
          onChange={(e) => patch({ [keys.line1]: e.target.value })}
          placeholder="123 Main Street"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-line-2`}>{line2Label}</Label>
        <Input
          id={`${idPrefix}-line-2`}
          autoComplete="address-line2"
          value={line2}
          onChange={(e) => patch({ [keys.line2]: e.target.value })}
          placeholder="Suite / Floor / Unit"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-city`}>{cityLabel}</Label>
          <Input
            id={`${idPrefix}-city`}
            autoComplete="address-level2"
            value={city}
            onChange={(e) => patch({ [keys.city]: e.target.value })}
            placeholder="New York"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-state`}>{isBilling ? `Billing ${stateLabel}` : stateLabel}</Label>
          {isUS ? (
            <select
              id={`${idPrefix}-state`}
              value={state || ''}
              onChange={(e) => patch({ [keys.state]: e.target.value })}
              className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select state</option>
              {US_STATE_CODES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </option>
              ))}
              {state && !US_STATE_CODES.some((s) => s.code === state) && (
                <option value={state}>{state} (legacy)</option>
              )}
            </select>
          ) : (
            <Input
              id={`${idPrefix}-state`}
              autoComplete="address-level1"
              value={state}
              onChange={(e) => patch({ [keys.state]: e.target.value })}
              placeholder="Province / Region"
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-zip`}>{isBilling ? `Billing ${zipLabel}` : zipLabel}</Label>
          <Input
            id={`${idPrefix}-zip`}
            autoComplete="postal-code"
            value={zip}
            onChange={(e) => patch({ [keys.zip]: e.target.value })}
            placeholder={isUS ? '10019' : 'M5V 2T6'}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-country`}>{isBilling ? 'Billing Country' : 'Country'}</Label>
          <select
            id={`${idPrefix}-country`}
            value={country || ''}
            onChange={(e) => patch({ [keys.country]: e.target.value })}
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select country</option>
            {pinnedCountries.map((c) => (
              <option key={c.code} value={c.name}>
                {c.name}
              </option>
            ))}
            <option value="" disabled>
              ----------------
            </option>
            {remainingCountries.map((c) => (
              <option key={c.code} value={c.name}>
                {c.name}
              </option>
            ))}
            {hasLegacyCountry && (
              <option value={country}>{country} (legacy)</option>
            )}
          </select>
        </div>
      </div>
    </div>
  );
}
