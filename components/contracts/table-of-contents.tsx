type TocItem = { id: string; label: string };

export function ContractTableOfContents({ items }: { items: TocItem[] }) {
  return (
    <aside className="sticky top-24 space-y-3 rounded-lg border border-parchment-200 bg-parchment-50 p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-500">On this page</p>
      <nav aria-label="Contract detail sections">
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="text-sm text-oak-800 transition hover:text-amber-700">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
