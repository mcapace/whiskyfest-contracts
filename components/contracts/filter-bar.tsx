'use client';

import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ContractViewFilters } from '@/components/contracts/saved-views-dropdown';

type Option = { value: string; label: string };

function ChipGroup({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: Option[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              selected === opt.value
                ? 'border-oak-700 bg-oak-800 text-parchment-50'
                : 'border-parchment-300 bg-parchment-50 text-ink-700 hover:bg-parchment-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ContractsFilterBar({
  filters,
  searchDraft,
  onSearchDraftChange,
  onChange,
  statusOptions,
  repOptions,
  brandOptions,
}: {
  filters: ContractViewFilters;
  searchDraft: string;
  onSearchDraftChange: (value: string) => void;
  onChange: (next: ContractViewFilters) => void;
  statusOptions: Option[];
  repOptions: Option[];
  brandOptions: Option[];
}) {
  return (
    <div className="space-y-4 rounded-lg border border-parchment-200 bg-parchment-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ChipGroup
          label="Status"
          options={statusOptions}
          selected={filters.status}
          onSelect={(status) => onChange({ ...filters, status, listPreset: 'none' })}
        />
        <div className="flex w-full max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-500" />
            <Input
              value={searchDraft}
              onChange={(e) => onSearchDraftChange(e.target.value)}
              placeholder="Search company, signer, email, brands"
              className="pl-8 pr-8 font-sans"
              aria-label="Search contracts"
            />
            {searchDraft ? (
              <button
                type="button"
                onClick={() => onSearchDraftChange('')}
                className="absolute right-2.5 top-2.5 text-ink-500 hover:text-oak-800"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <Button
            variant="outline"
            onClick={() => {
              onSearchDraftChange('');
              onChange({ status: 'all', rep: 'all', brand: 'all', search: '', listPreset: 'none' });
            }}
          >
            Clear
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ChipGroup
          label="Sales rep"
          options={repOptions}
          selected={filters.rep}
          onSelect={(rep) => onChange({ ...filters, rep, listPreset: 'none' })}
        />
        <ChipGroup
          label="Brand category"
          options={brandOptions}
          selected={filters.brand}
          onSelect={(brand) => onChange({ ...filters, brand, listPreset: 'none' })}
        />
      </div>
    </div>
  );
}
