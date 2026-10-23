DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"cms_role":"editor"}}', true);
  BEGIN
    UPDATE app.trajectory_samples SET sequence_no = 999;
    RAISE EXCEPTION 'C02 TEST FAILED: authenticated was allowed to update trajectory_samples';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'C02 PASSED: insufficient_privilege correctly raised for UPDATE trajectory_samples';
  END;
END;
$$;
