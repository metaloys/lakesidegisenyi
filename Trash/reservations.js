/**
 * /api/reservations
 * Creates a reservation using Supabase REST API directly (no npm import needed).
 * Uses service role key to bypass RLS — safe because this runs server-side only.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('[reservations] Missing env vars — SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  try {
    const { firstName, lastName, phone, email, date, timeSlot,
            partySize, occasion, specialRequests } = req.body || {};

    // ── Validate required fields ──
    if (!firstName || !lastName || !phone || !date || !timeSlot || !partySize) {
      res.status(400).json({ error: 'Missing required fields: firstName, lastName, phone, date, timeSlot, partySize' });
      return;
    }

    const headers = {
      'Content-Type':  'application/json',
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    };

    // ── Get restaurant ID ──
    const restRes = await fetch(
      `${SUPABASE_URL}/rest/v1/restaurants?slug=eq.lakeside-gisenyi&select=id&limit=1`,
      { headers }
    );
    const restaurants = await restRes.json();

    if (!restRes.ok || !restaurants?.length) {
      console.error('[reservations] Restaurant not found:', restaurants);
      res.status(500).json({ error: 'Restaurant not found. Check slug in database.' });
      return;
    }

    const restaurantId = restaurants[0].id;

    // ── Insert reservation ──
    const insertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/reservations`,
      {
        method:  'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          restaurant_id:    restaurantId,
          first_name:       firstName,
          last_name:        lastName,
          phone:            phone.replace(/\s/g, ''),
          email:            email       || null,
          date:             date,
          time_slot:        timeSlot,
          party_size:       parseInt(partySize),
          occasion:         occasion    || null,
          special_requests: specialRequests || null,
          source:           'website',
          status:           'pending',
        }),
      }
    );

    const result = await insertRes.json();

    if (!insertRes.ok) {
      console.error('[reservations] Insert failed:', result);
      res.status(400).json({ error: result?.message || 'Failed to save reservation' });
      return;
    }

    const reservation = Array.isArray(result) ? result[0] : result;
    console.log('[reservations] ✓ Created:', reservation.id);
    res.status(200).json(reservation);

  } catch (err) {
    console.error('[reservations] Unexpected error:', err.message);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
