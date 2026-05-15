/**
 * /api/reservations
 * Handles booking submissions securely using Supabase service role key
 * This is more secure than exposing the anon key with RLS
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { firstName, lastName, phone, email, date, timeSlot, partySize, occasion, specialRequests } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !phone || !date || !timeSlot || !partySize) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Create Supabase client with service role key (admin permissions)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get restaurant (assume first one for now)
    const { data: restaurants, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id')
      .limit(1);

    if (restaurantError || !restaurants?.length) {
      console.error('Restaurant fetch error:', restaurantError);
      res.status(500).json({ error: 'Could not find restaurant' });
      return;
    }

    const restaurantId = restaurants[0].id;

    // Insert reservation
    const { data, error } = await supabase
      .from('reservations')
      .insert({
        restaurant_id: restaurantId,
        first_name: firstName,
        last_name: lastName,
        phone: phone.replace(/\s/g, ''),
        email: email || null,
        date: date,
        time_slot: timeSlot,
        party_size: parseInt(partySize),
        occasion: occasion || null,
        special_requests: specialRequests || null,
        source: 'website',
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      res.status(400).json({ error: error.message || 'Failed to create reservation' });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
