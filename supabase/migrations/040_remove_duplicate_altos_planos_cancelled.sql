-- Remove duplicate Altos Planos contract (cancelled DocuSign draft; not executed).
-- Keep the executed imported contract: 8b182555-79e6-430a-8f21-70066d897599

delete from public.contracts
where id = '1b63811a-8b90-4e42-97c5-0a596a44d63d'
  and status = 'cancelled'
  and lower(trim(exhibitor_company_name)) = 'altos planos';
