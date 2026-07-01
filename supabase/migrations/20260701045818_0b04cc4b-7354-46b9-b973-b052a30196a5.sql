-- Fix retry-renewal-failures cron: usar CRON_SECRET em vez de service_role key do vault
DO $$
DECLARE
  v_cron_secret TEXT;
  v_project_url TEXT := 'https://xazlrdwdkafhzwkezfxz.supabase.co';
BEGIN
  v_cron_secret := (
    SELECT regexp_replace(
      (command::text),
      '.*Bearer ([a-f0-9A-F]+).*',
      '\1'
    )
    FROM cron.job WHERE jobid = 15
  );

  IF v_cron_secret IS NULL OR length(v_cron_secret) < 32 THEN
    RAISE EXCEPTION 'CRON_SECRET não encontrado no job 15 — verifique o cron de medicamentos';
  END IF;

  PERFORM cron.alter_job(
    9,
    command := format(
      $CMD$
      SELECT net.http_post(
        url := '%s/functions/v1/retry-renewal-failures',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || '%s'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
      $CMD$,
      v_project_url,
      v_cron_secret
    )
  );
END $$;