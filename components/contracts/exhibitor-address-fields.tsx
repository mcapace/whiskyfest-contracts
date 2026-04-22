'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Input, Label } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { US_STATE_CODES } from '@/lib/exhibitor-address';
import { COUNTRIES } from '@/lib/countries';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export interface ExhibitorAddressFormSlice {
  exhibitor_address_line1: string;
  exhibitor_address_line2: string;
  exhibitor_city: string;
  exhibitor_state: string;
  exhibitor_zip: string;
  exhibitor_country: string;
}

interface Props {
  value: ExhibitorAddressFormSlice;
  onChange: (patch: Partial<ExhibitorAddressFormSlice>) => void;
}

function loadMapsScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject();
  if (window.google?.maps?.places) return Promise.resolve();

  const existing = document.getElementById('wf-google-maps-places');
  if (existing) {
    return new Promise((resolve, reject) => {
      const t = setInterval(() => {
        if (window.google?.maps?.places) {
          clearInterval(t);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(t);
        reject(new Error('timeout'));
      }, 15000);
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.id = 'wf-google-maps-places';
    s.async = true;
    if (!MAPS_KEY) {
      reject(new Error('no key'));
      return;
    }
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&libraries=places`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('load failed'));
    document.head.appendChild(s);
  });
}

/** Optional Google Places Autocomplete on street line 1 (US). Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY + Places API enabled. */
export function ExhibitorAddressFields({ value, onChange }: Props) {
  const line1Ref = useRef<HTMLInputElement>(null);

  const set = useCallback(
    (patch: Partial<ExhibitorAddressFormSlice>) => {
      onChange(patch);
    },
    [onChange],
  );

  useEffect(() => {
    if (!MAPS_KEY || !line1Ref.current) return;

    let ac: google.maps.places.Autocomplete | null = null;
    let listener: google.maps.MapsEventListener | null = null;
    let cancelled = false;

    loadMapsScript()
      .then(() => {
        if (cancelled || !line1Ref.current || !window.google?.maps?.places) return;

        ac = new google.maps.places.Autocomplete(line1Ref.current, {
          componentRestrictions: { country: 'us' },
          fields: ['address_components', 'formatted_address'],
          types: ['address'],
        });

        listener = ac.addListener('place_changed', () => {
          const place = ac!.getPlace();
          const comp = place.address_components ?? [];
          let streetNumber = '';
          let route = '';
          let subpremise = '';
          let city = '';
          let state = '';
          let zip = '';
          let country = '';
          for (const c of comp) {
            if (c.types.includes('street_number')) streetNumber = c.long_name;
            if (c.types.includes('route')) route = c.long_name;
            if (c.types.includes('subpremise')) subpremise = c.long_name;
            if (c.types.includes('locality')) city = c.long_name;
            if (c.types.includes('sublocality') && !city) city = c.long_name;
            if (c.types.includes('administrative_area_level_1')) state = c.short_name ?? '';
            if (c.types.includes('postal_code')) zip = c.long_name;
            if (c.types.includes('country')) country = c.long_name;
          }
          const line1 = [streetNumber, route].filter(Boolean).join(' ').trim();
          onChange({
            exhibitor_address_line1: line1,
            exhibitor_address_line2: subpremise,
            exhibitor_city: city,
            exhibitor_state: state,
            exhibitor_zip: zip,
            exhibitor_country: country,
          });
        });
      })
      .catch(() => {
        /* manual entry */
      });

    return () => {
      cancelled = true;
      if (listener && window.google?.maps?.event) {
        window.google.maps.event.removeListener(listener);
      }
      ac = null;
    };
  }, [onChange]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="addr-line1">Street address</Label>
        <Input
          id="addr-line1"
          ref={line1Ref}
          autoComplete="street-address"
          value={value.exhibitor_address_line1}
          onChange={(e) => set({ exhibitor_address_line1: e.target.value })}
          placeholder="123 Distillery Way"
        />
        {MAPS_KEY ? (
          <p className="text-xs text-muted-foreground">Start typing for US address suggestions (Google Places).</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Optional: set <code className="rounded bg-muted px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> (Maps JavaScript API + Places API) for
            autocomplete.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="addr-line2">Apt / suite / floor (optional)</Label>
        <Input
          id="addr-line2"
          autoComplete="address-line2"
          value={value.exhibitor_address_line2}
          onChange={(e) => set({ exhibitor_address_line2: e.target.value })}
          placeholder="Suite 200, FL 3, etc."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="addr-city">City</Label>
          <Input
            id="addr-city"
            autoComplete="address-level2"
            value={value.exhibitor_city}
            onChange={(e) => set({ exhibitor_city: e.target.value })}
            placeholder="Louisville"
          />
        </div>
        <div className="space-y-1.5">
          <Label>State</Label>
          <Select value={value.exhibitor_state || '__'} onValueChange={(v) => set({ exhibitor_state: v === '__' ? '' : v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="__">—</SelectItem>
              {US_STATE_CODES.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5 sm:max-w-xs">
        <Label htmlFor="addr-zip">ZIP code</Label>
        <Input
          id="addr-zip"
          autoComplete="postal-code"
          inputMode="numeric"
          value={value.exhibitor_zip}
          onChange={(e) => set({ exhibitor_zip: e.target.value })}
          placeholder="40202"
        />
      </div>

      <div className="space-y-1.5 sm:max-w-sm">
        <Label>Country</Label>
        <Select
          value={value.exhibitor_country || '__'}
          onValueChange={(v) => set({ exhibitor_country: v === '__' ? '' : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__">—</SelectItem>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
            {value.exhibitor_country && !COUNTRIES.some((c) => c.name === value.exhibitor_country) && (
              <SelectItem value={value.exhibitor_country}>
                {value.exhibitor_country} (legacy)
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
