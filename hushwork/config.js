// Public settings for the page. Nothing in this file is secret.
// The Supabase "publishable" key is designed to be visible in the browser:
// the database rules (row level security) let it ADD a waitlist email and nothing else.
// It cannot read the list. Never put a "secret" or "service_role" key in this file.
// If these are ever emptied, the waitlist form tells visitors it is not connected
// instead of pretending to save their email.
window.HW_CONFIG = {
  supabaseUrl: 'https://mgvaqoishxsqecpjfnuo.supabase.co',
  supabaseKey: 'sb_publishable_plfVbNX9CNdV6PmvzfKMXg_I2k-xACq',
};
