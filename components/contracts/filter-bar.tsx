'use client';

import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ContractViewFilters } from '@/components/contracts/saved-views-dropdown';

type Option = { value: string; label: string };

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[10.5rem] bg-background shadow-none" aria-label={label}>
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
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
  dealTypeOptions,
  hideRepFilter,
  hideBrandFilter,
  hideDealTypeFilter,
}: {
  filters: ContractViewFilters;
  searchDraft: string;
  onSearchDraftChange: (value: string) => void;
  onChange: (next: ContractViewFilters) => void;
  statusOptions: Option[];
  repOptions: Option[];
  brandOptions: Option[];
  dealTypeOptions: Option[];
  hideRepFilter?: boolean;
  hideBrandFilter?: boolean;
  hideDealTypeFilter?: boolean;
}) {
  const isFiltered =
    filters.status !== 'all' ||
    filters.rep !== 'all' ||
    filters.brand !== 'all' ||
    filters.dealType !== 'all' ||
    filters.listPreset !== 'none' ||
    Boolean(searchDraft.trim());

  function clearAll() {
    onSearchDraftChange('');
    onChange({ status: 'all', rep: 'all', brand: 'all', dealType: 'all', search: '', listPreset: 'none' });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card px-3 py-3 sm:px-4 lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchDraft}
          onChange={(e) => onSearchDraftChange(e.target.value)}
          placeholder={
            hideBrandFilter ? 'Search winery, legal name, signer, wine' : 'Search company, signer, email, brands'
          }
          className="h-9 border-border/70 bg-background pl-8 pr-8 shadow-none"
          aria-label="Search contracts"
        />
        {searchDraft ? (
          <button
            type="button"
            onClick={() => onSearchDraftChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <FilterSelect
          label="Status"
          options={statusOptions}
          value={filters.status}
          onChange={(status) => onChange({ ...filters, status, listPreset: 'none' })}
        />
        {!hideDealTypeFilter ? (
          <FilterSelect
            label="Deal"
            options={dealTypeOptions}
            value={filters.dealType}
            onChange={(dealType) => onChange({ ...filters, dealType, listPreset: 'none' })}
          />
        ) : null}
        {!hideRepFilter ? (
          <FilterSelect
            label="Rep"
            options={repOptions}
            value={filters.rep}
            onChange={(rep) => onChange({ ...filters, rep, listPreset: 'none' })}
          />
        ) : null}
        {!hideBrandFilter ? (
          <FilterSelect
            label="Brand"
            options={brandOptions}
            value={filters.brand}
            onChange={(brand) => onChange({ ...filters, brand, listPreset: 'none' })}
          />
        ) : null}
        {isFiltered ? (
          <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-muted-foreground" onClick={clearAll}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
