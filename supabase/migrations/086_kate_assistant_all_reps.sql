-- Kate books WhiskyFest deals for every AE; ownership checks use rep_assistants.
insert into public.rep_assistants (assistant_email, rep_id)
select 'kbrumley@mshanken.com', id
from public.sales_reps
where is_active = true
on conflict (assistant_email, rep_id) do nothing;
