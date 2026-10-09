/* WAGWAN Supabase runtime. Loaded after Supabase CDN and before app.js. */
(function(){
  if (!window.supabase || !window.WAGWAN_SUPABASE_URL || window.WAGWAN_SUPABASE_URL.startsWith('YOUR_')) {
    console.warn('WAGWAN Supabase is not configured. Edit supabase-config.js first.');
    return;
  }
  window.wagwanSB = window.supabase.createClient(window.WAGWAN_SUPABASE_URL, window.WAGWAN_SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();
