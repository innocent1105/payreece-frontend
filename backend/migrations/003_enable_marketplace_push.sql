-- Enable best-effort Expo push delivery for marketplace requests.
UPDATE mm_settings SET setting_value = '1' WHERE setting_key = 'push_enabled';
