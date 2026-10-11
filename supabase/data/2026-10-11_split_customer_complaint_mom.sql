-- One-off data change, run 2026-10-11: the combined "Customer Complaint / MOM"
-- tag (category 'Customer MOM') was split in two. Tasks whose wording reads
-- like a customer meeting point stay 'Customer MOM'; the rest (quality issues
-- reported by the customer) became 'Customer Complaint'. 47 / 17 at the time.
-- tasks_set_updated_at is disabled so close dates (closedAt = updated_at) stay put.
begin;
alter table public.tasks disable trigger tasks_set_updated_at;
update public.tasks set category = 'Customer Complaint'
 where category = 'Customer MOM'
   and description !~* '(\mMOM\M|action plan|improvement plan|should be (submitted|share)|plan submit|submit)';
alter table public.tasks enable trigger tasks_set_updated_at;
commit;
