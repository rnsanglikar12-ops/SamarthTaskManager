-- Caches Google Drive archival links for compliance CSV exports (see
-- src/utils/driveArchive.ts). Nullable: populated lazily, only for tasks
-- that have actually been through a compliance export at least once, so
-- repeated exports don't re-upload the same photo to Drive every time.
alter table public.tasks
  add column attached_photo_drive_link text,
  add column after_photo_drive_link text;
