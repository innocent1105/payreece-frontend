-- Return agents to available automatically after completed or cancelled jobs.
UPDATE mm_settings SET setting_value = '1' WHERE setting_key = 'agent_auto_return_available';

-- Repair agents left busy by jobs completed before this setting was enabled.
UPDATE agent_profiles a
SET a.availability = 'available'
WHERE a.verification_status = 'verified'
  AND a.availability = 'busy'
  AND NOT EXISTS (
      SELECT 1
      FROM mm_transactions t
      WHERE t.agent_id = a.agent_id
        AND t.state IN ('accepted', 'agent_en_route', 'arrived', 'processing')
  );
