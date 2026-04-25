'use client';

import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type ContractViewFilters = {
  status: string;
  rep: string;
  brand: string;
  search: string;
};

type SavedView = { name: string; filters: ContractViewFilters };

const PRESET_VIEWS: SavedView[] = [
  { name: 'All contracts', filters: { status: 'all', rep: 'all', brand: 'all', search: '' } },
  { name: 'My contracts', filters: { status: 'all', rep: 'mine', brand: 'all', search: '' } },
  { name: 'Pending action', filters: { status: 'pending_events_review', rep: 'all', brand: 'all', search: '' } },
  { name: 'Awaiting events review', filters: { status: 'pending_events_review', rep: 'all', brand: 'all', search: '' } },
  { name: 'Recently signed', filters: { status: 'signed', rep: 'all', brand: 'all', search: '' } },
  { name: 'Stuck contracts', filters: { status: 'sent', rep: 'all', brand: 'all', search: '' } },
];

export function SavedViewsDropdown({
  onApply,
  customSaved,
}: {
  onApply: (filters: ContractViewFilters) => void;
  customSaved: SavedView[];
}) {
  const options = useMemo(() => [...PRESET_VIEWS, ...customSaved], [customSaved]);

  return (
    <Select
      onValueChange={(value) => {
        const match = options.find((v) => v.name === value);
        if (match) onApply(match.filters);
      }}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Saved views" />
      </SelectTrigger>
      <SelectContent>
        {options.map((view) => (
          <SelectItem key={view.name} value={view.name}>
            {view.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
