'use client';

import { Fragment, useEffect, useMemo, useRef } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { Input, Label } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COUNTRIES, PINNED_COUNTRIES_COUNT, parseGoogleCountry } from '@/lib/countries';

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

export function AddressAutocomplete({ value, onChange }: AddressAutocompleteProps) {
  const line1Ref = useRef<HTMLInputElement>(null);

  const isUS = (value.exhibitor_country || '').trim() === 'United States';
  const zipLabel = isUS ? 'Zip' : 'Postal Code';
  const stateLabel = isUS ? 'State' : 'Province/Region';

  useEffect(() => {
    if (!MAPS_KEY || typeof window === 'undefined' || !line1Ref.current) return;

    setOptions({
      key: MAPS_KEY,
      v: 'weekly',
      libraries: ['places'],
    });

    let autocomplete: google.maps.places.Autocomplete | null = null;
    let listener: google.maps.MapsEventListener | null = null;
    let cancelled = false;

    void importLibrary('places')
      .then(() => {
        if (cancelled || !line1Ref.current || !window.google?.maps?.places) return;

        autocomplete = new google.maps.places.Autocomplete(line1Ref.current, {
          types: ['address'],
          fields: ['address_components'],
        });

        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete?.getPlace();
          const parts = place?.address_components ?? [];
          const byType = (type: string) => parts.find((p) => p.types.includes(type));

          const street = [byType('street_number')?.long_name, byType('route')?.long_name]
            .filter(Boolean)
            .join(' ')
            .trim();

          const city =
            byType('locality')?.long_name ??
            byType('postal_town')?.long_name ??
            byType('administrative_area_level_2')?.long_name ??
            byType('sublocality')?.long_name ??
            '';

          const countryCode = byType('country')?.short_name ?? '';
          const mappedCountry = parseGoogleCountry(countryCode) ?? '';
          const isUsOrCa = countryCode === 'US' || countryCode === 'CA';
          const state = isUsOrCa
            ? byType('administrative_area_level_1')?.short_name ?? ''
            : byType('administrative_area_level_1')?.long_name ?? '';

          onChange({
            exhibitor_address_line1: street,
            exhibitor_city: city,
            exhibitor_state: state,
            exhibitor_zip: byType('postal_code')?.long_name ?? '',
            exhibitor_country: mappedCountry || value.exhibitor_country || 'United States',
          });
        });
      })
      .catch(() => {
        /* Allow manual entry if Google loader fails */
      });

    return () => {
      cancelled = true;
      if (listener && window.google?.maps?.event) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, [onChange, value.exhibitor_country]);

  const hasLegacyCountry = useMemo(() => {
    const current = value.exhibitor_country?.trim();
    return Boolean(current) && !COUNTRIES.some((c) => c.name === current);
  }, [value.exhibitor_country]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="addr-line-1">Address Line 1</Label>
        <Input
          id="addr-line-1"
          ref={line1Ref}
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
          <Input
            id="addr-state"
            autoComplete="address-level1"
            value={value.exhibitor_state}
            onChange={(e) => onChange({ exhibitor_state: e.target.value })}
            placeholder={isUS ? 'NY' : 'Ontario'}
          />
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
          <Label>Country</Label>
          <Select
            value={value.exhibitor_country || '__none__'}
            onValueChange={(next) => onChange({ exhibitor_country: next === '__none__' ? '' : next })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__none__">—</SelectItem>
              {COUNTRIES.map((country, idx) => (
                <Fragment key={country.code}>
                  {idx === PINNED_COUNTRIES_COUNT && <SelectSeparator />}
                  <SelectItem value={country.name}>{country.name}</SelectItem>
                </Fragment>
              ))}
              {hasLegacyCountry && (
                <>
                  <SelectSeparator />
                  <SelectItem value={value.exhibitor_country}>{value.exhibitor_country} (legacy)</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
