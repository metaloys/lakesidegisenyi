/**
 * Public site configuration (copy to config.js and fill in values).
 * config.js is gitignored — never commit real keys.
 */
window.LAKESIDE_CONFIG = {
  // Same project for public bookings and admin login (Supabase Auth)
  supabaseUrl: 'https://YOUR_PROJECT_ID.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_PUBLIC_KEY',
  whatsappNumber: '250788202475',
  emailjs: {
    publicKey: 'YOUR_EMAILJS_PUBLIC_KEY',
    serviceId: 'YOUR_SERVICE_ID',
    templateId: 'YOUR_TEMPLATE_ID',
  },
};
