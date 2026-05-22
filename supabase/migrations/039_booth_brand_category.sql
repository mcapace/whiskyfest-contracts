-- Product category per booth brand (brand mix, filters, sponsor directory).

alter table public.contract_booth_brands
  add column if not exists brand_category text;

alter table public.contract_booth_brands
  drop constraint if exists contract_booth_brands_brand_category_chk;

alter table public.contract_booth_brands
  add constraint contract_booth_brands_brand_category_chk
  check (
    brand_category is null
    or brand_category in (
      'Bourbon',
      'Scotch',
      'Irish',
      'Japanese',
      'Rye',
      'World Whiskies',
      'Tequila',
      'Vodka',
      'Gin',
      'Rum',
      'Cigar',
      'Other'
    )
  );
