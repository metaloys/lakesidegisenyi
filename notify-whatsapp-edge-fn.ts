// ============================================================
//  LAKESIDE — SUPABASE EDGE FUNCTION
//  File: supabase/functions/notify-whatsapp/index.ts
//
//  Deploy with:
//    supabase functions deploy notify-whatsapp
//
//  Set environment variables in Supabase Dashboard:
//    Project Settings → Edge Functions → Secrets
//
//  Required secrets:
//    TWILIO_SID            — from Twilio Console
//    TWILIO_TOKEN          — from Twilio Console
//    TWILIO_WHATSAPP_FROM  — e.g. whatsapp:+14155238886
//    OWNER_WHATSAPP        — e.g. whatsapp:+250791693096
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { message, reservationId } = await req.json()

    const sid   = Deno.env.get('TWILIO_SID')!
    const token = Deno.env.get('TWILIO_TOKEN')!
    const from  = Deno.env.get('TWILIO_WHATSAPP_FROM')!
    const to    = Deno.env.get('OWNER_WHATSAPP')!

    // Send via Twilio WhatsApp API
    const params = new URLSearchParams({
      From: from,
      To:   to,
      Body: message,
    })

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method:  'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${sid}:${token}`),
          'Content-Type':  'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    )

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || 'Twilio error')
    }

    return new Response(
      JSON.stringify({ success: true, sid: result.sid }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
