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

interface AddressAutocompleteProps {
  value: AddressValue;
  onChange: (patch: Partial<AddressValue>) => void;
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type PlaceAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
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

export function AddressAutocomplete({ value, onChange }: AddressAutocompleteProps) {
  const autocompleteHostRef = useRef<HTMLDivElement>(null);
  const pinnedCountries = COUNTRIES.slice(0, PINNED_COUNTRIES_COUNT);
  const remainingCountries = COUNTRIES.slice(PINNED_COUNTRIES_COUNT);

  const isUS = (value.exhibitor_country || '').trim() === 'United States';
  const zipLabel = isUS ? 'Zip' : 'Postal Code';
  const stateLabel = isUS ? 'State' : 'Province/Region';

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
        placePrediction?: { toPlace?: () => { fetchFields: (arg: { fields: string[] }) => Promise<void>; addressComponents?: PlaceAddressComponent[] } };
      };

      const prediction =
        e.placePrediction ??
        ((e as CustomEvent<{ placePrediction?: { toPlace?: () => { fetchFields: (arg: { fields: string[] }) => Promise<void>; addressComponents?: PlaceAddressComponent[] } } }>).detail?.placePrediction);
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
      const city =
        getComponentText(components, 'locality', 'long') ||
        getComponentText(components, 'postal_town', 'long') ||
        getComponentText(components, 'administrative_area_level_2', 'long') ||
        getComponentText(components, 'sublocality', 'long');
      const countryCode = getComponentText(components, 'country', 'short').toUpperCase();
      const countryName = parseGoogleCountry(countryCode) ?? '';
      const isUsOrCa = countryCode === 'US' || countryCode === 'CA';
      const state = isUsOrCa
        ? getComponentText(components, 'administrative_area_level_1', 'short')
        : getComponentText(components, 'administrative_area_level_1', 'long');

      onChange({
        exhibitor_address_line1: [streetNumber, route].filter(Boolean).join(' ').trim(),
        exhibitor_city: city,
        exhibitor_state: state,
        exhibitor_zip: getComponentText(components, 'postal_code', 'long'),
        exhibitor_country: countryName || value.exhibitor_country || 'United States',
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
  }, [onChange, value.exhibitor_country, MAPS_KEY]);

  const hasLegacyCountry = useMemo(() => {
    const current = value.exhibitor_country?.trim();
    return Boolean(current) && !COUNTRIES.some((c) => c.name === current);
  }, [value.exhibitor_country]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Search Address</Label>
        <div
          ref={autocompleteHostRef}
          className="wf-place-autocomplete min-h-9 rounded-md border border-input bg-background px-2 py-1"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="addr-line-1">Address Line 1</Label>
        <Input
          id="addr-line-1"
          autoComplete="address-line1"
          value={value.exhibitor_address_line1}
          onChange={(e) => onChange({ exhibitor_address_line1: e.target.value })}
          placeholder="123 Main Street"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="addr-line-2">Address Line 2</Label>
        <Input
          id="addr-line-2"
          autoComplete="address-line2"
          value={value.exhibitor_address_line2}
          onChange={(e) => onChange({ exhibitor_address_line2: e.target.value })}
          placeholder="Suite / Floor / Unit"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="addr-city">City</Label>
          <Input
            id="addr-city"
            autoComplete="address-level2"
            value={value.exhibitor_city}
            onChange={(e) => onChange({ exhibitor_city: e.target.value })}
            placeholder="New York"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addr-state">{stateLabel}</Label>
          {isUS ? (
            <select
              id="addr-state"
              value={value.exhibitor_state || ''}
              onChange={(e) => onChange({ exhibitor_state: e.target.value })}
              className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select state</option>
              {US_STATE_CODES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.code} — {state.name}
                </option>
              ))}
              {value.exhibitor_state && !US_STATE_CODES.some((s) => s.code === value.exhibitor_state) && (
                <option value={value.exhibitor_state}>{value.exhibitor_state} (legacy)</option>
              )}
            </select>
          ) : (
            <Input
              id="addr-state"
              autoComplete="address-level1"
              value={value.exhibitor_state}
              onChange={(e) => onChange({ exhibitor_state: e.target.value })}
              placeholder="Province / Region"
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="addr-zip">{zipLabel}</Label>
          <Input
            id="addr-zip"
            autoComplete="postal-code"
            value={value.exhibitor_zip}
            onChange={(e) => onChange({ exhibitor_zip: e.target.value })}
            placeholder={isUS ? '10019' : 'M5V 2T6'}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="addr-country">Country</Label>
          <select
            id="addr-country"
            value={value.exhibitor_country || ''}
            onChange={(e) => onChange({ exhibitor_country: e.target.value })}
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select country</option>
            {pinnedCountries.map((country) => (
              <option key={country.code} value={country.name}>
                {country.name}
              </option>
            ))}
            <option value="" disabled>
              ----------------
            </option>
            {remainingCountries.map((country) => (
              <option key={country.code} value={country.name}>
                {country.name}
              </option>
            ))}
            {hasLegacyCountry && (
              <option value={value.exhibitor_country}>{value.exhibitor_country} (legacy)</option>
            )}
          </select>
        </div>
      </div>
    </div>
  );
}
