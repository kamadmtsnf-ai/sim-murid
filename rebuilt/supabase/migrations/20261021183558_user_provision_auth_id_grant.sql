begin;
-- Provisioning checks only whether its reserved UUID exists. Keep the RPCs
-- SECURITY INVOKER and grant this single column only to the server role.
-- Do not grant table-wide SELECT or access to credentials/Auth metadata.
grant select(id) on auth.users to service_role;
commit;
