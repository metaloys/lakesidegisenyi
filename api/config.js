/**
 * Vercel Serverless Function — Safely serves config from environment variables
 * Only used in production; local development uses js/config.js directly
 */

export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Debug: log what we actually have
  console.log('[api/config] SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ set' : '✗ MISSING');
  console.log('[api/config] SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✓ set' : '✗ MISSING');
  console.log('[api/config] WHATSAPP_NUMBER:', process.env.WHATSAPP_NUMBER ? '✓ set' : '✗ MISSING');
  console.log('[api/config] EMAILJS_PUBLIC_KEY:', process.env.EMAILJS_PUBLIC_KEY ? '✓ set' : '✗ MISSING');
  console.log('[api/config] EMAILJS_SERVICE_ID:', process.env.EMAILJS_SERVICE_ID ? '✓ set' : '✗ MISSING');
  console.log('[api/config] EMAILJS_TEMPLATE_ID:', process.env.EMAILJS_TEMPLATE_ID ? '✓ set' : '✗ MISSING');

  // Return config from environment variables
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    whatsappNumber: process.env.WHATSAPP_NUMBER,
    emailjs: {
      publicKey: process.env.EMAILJS_PUBLIC_KEY,
      serviceId: process.env.EMAILJS_SERVICE_ID,
      templateId: process.env.EMAILJS_TEMPLATE_ID,
    },
  });
}
