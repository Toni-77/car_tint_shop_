'use server';

import { Resend } from 'resend';
import { dbAdmin } from '@/utils/firebaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendManualBookingRequest(formData: any) {
  try {
    // 1. Guard against empty variables
    if (!process.env.MY_EMAIL) {
      console.error("Missing critical environment token configuration: MY_EMAIL");
      return { success: false, error: "Server destination email environment token is not configured." };
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("Missing critical environment token configuration: RESEND_API_KEY");
      return { success: false, error: "Resend API authentication key is missing." };
    }

    // 2. Format a clean JavaScript Date Instance safely
    let appointmentDateInstance: Date;
    try {
      // Split the input date string safely (YYYY-MM-DD)
      const [year, month, day] = formData.date.split('-').map(Number);
      
      // Parse out the hours and minutes from strings like "9:30 AM" or "12:00 PM"
      const timeMatch = formData.timeSlot.match(/^(\d+):(\d+)\s+(AM|PM)$/i);
      
      if (!timeMatch) {
        throw new Error(`Unparseable slot format returned: ${formData.timeSlot}`);
      }

      let [_, hoursStr, minutesStr, modifier] = timeMatch;
      let hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);

      if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
      if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;

      // Construct a valid local date instance safely
      appointmentDateInstance = new Date(year, month - 1, day, hours, minutes);

      if (isNaN(appointmentDateInstance.getTime())) {
        throw new Error("Resulting Date math generated an Invalid Date value.");
      }
    } catch (dateParseError) {
      console.error("Date formatting exception intercepted:", dateParseError);
      // Clean fallback string generation if manual time math hits unexpected inputs
      appointmentDateInstance = new Date();
    }

    // 3. Save to Firestore using Admin SDK
    await dbAdmin.collection("bookings").add({
      ...formData,
      createdAt: new Date(),
      appointmentDate: appointmentDateInstance
    });

    // 4. Trigger Email Notification via Resend
    const { error } = await resend.emails.send({
      from: 'Booking System <onboarding@resend.dev>', 
      to: [process.env.MY_EMAIL], 
      replyTo: formData.email || undefined, 
      subject: `New Booking: ${formData.firstName || 'Customer'} ${formData.lastName || ''}`,
      html: `
        <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px; max-width: 600px;">
          <h2 style="color: #2563eb; margin-top: 0;">New Appointment Request</h2>
          <p><strong>Customer:</strong> ${formData.firstName || ''} ${formData.lastName || ''}</p>
          <p><strong>Vehicle:</strong> ${formData.year || ''} ${formData.make || ''} ${formData.model || ''}</p>
          <p><strong>Service:</strong> ${formData.service || ''}</p>
          <p><strong>Date:</strong> ${formData.date || ''} at ${formData.timeSlot || ''}</p>
          
          <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #eee;">
            <p style="margin: 0;"><strong>Phone:</strong> <a href="tel:${formData.phone || ''}">${formData.phone || ''}</a> (Click to call)</p>
            <p style="margin: 5px 0 0 0;"><strong>Email:</strong> <a href="mailto:${formData.email || ''}">${formData.email || ''}</a></p>
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 15px;">
            <strong>Tip:</strong> You can hit 'Reply' in your email app to contact the customer directly.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend API Error response returned:", error);
      throw new Error(error.message);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Booking Error Catch Block execution path:", error);
    return { success: false, error: error?.message || "Failed to process booking execution path." };
  }
}
