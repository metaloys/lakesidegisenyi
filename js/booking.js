/**
 * Reservation form → Supabase, WhatsApp, EmailJS.
 * Requires: Supabase SDK, config.js, lakeside-supabase.js, EmailJS (optional).
 */
(function () {
  const cfg = window.LAKESIDE_CONFIG;
  if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) {
    console.error('LAKESIDE_CONFIG missing. Copy js/config.example.js to js/config.js');
    return;
  }

  async function handleReserve(e) {
    e.preventDefault();

    const form = e.target;
    const inputs = form.querySelectorAll('input');
    const selects = form.querySelectorAll('select');
    const textarea = form.querySelector('textarea');

    const formData = {
      firstName: inputs[0].value,
      lastName: inputs[1].value,
      phone: inputs[2].value,
      email: inputs[3].value,
      date: inputs[4].value,
      timeSlot: selects[0].value,
      partySize: selects[1].value,
      occasion: selects[2].value,
      specialRequests: textarea.value,
    };

    const btn = document.querySelector('.form-submit');
    btn.textContent = 'Sending…';
    btn.disabled = true;

    try {
      const reservation = await submitReservation(formData);

      document.getElementById('successMsg').style.display = 'block';
      btn.textContent = 'Reservation Sent ✓';

      const whatsappMessage = `🍽️ NEW RESERVATION

Name: ${formData.firstName} ${formData.lastName}
Guests: ${formData.partySize}
Date: ${formData.date}
Time: ${formData.timeSlot}

Phone: ${formData.phone}

Special Request:
${formData.specialRequests}`;

      window.open(
        `https://wa.me/${cfg.whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`,
        '_blank'
      );

      if (typeof emailjs !== 'undefined' && cfg.emailjs?.serviceId) {
        emailjs.send(cfg.emailjs.serviceId, cfg.emailjs.templateId, {
          customer_name: `${formData.firstName} ${formData.lastName}`,
          customer_phone: formData.phone,
          booking_date: formData.date,
          booking_time: formData.timeSlot,
          guests: formData.partySize,
          special_requests: formData.specialRequests,
        });
      }

      form.reset();
    } catch (error) {
      alert('Booking failed. Please try again.');
      console.error(error);
      btn.textContent = 'Try Again';
      btn.disabled = false;
    }
  }

  window.handleReserve = handleReserve;
})();
