'use server';

import { Resend } from 'resend';
import { dbAdmin } from '@/utils/firebaseAdmin';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendManualBookingRequest(formData: any) {
  try {
    // 1. Save to Firestore using Admin SDK (optimized for serverless)
    await dbAdmin.collection("bookings").add({
      ...formData,
      createdAt: new Date(),
      // Create a real Date object for the appointment
      appointmentDate: new Date(`${formData.date} ${formData.timeSlot}`)
    });

    // 2. Trigger Email Notification via Resend
    const { error } = await resend.emails.send({
      from: 'Booking System <onboarding@resend.dev>', 
      to: [process.env.MY_EMAIL as string], 
      replyTo: formData.email, 
      subject: `New Booking: ${formData.firstName} ${formData.lastName}`,
      html: `
        <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px; max-width: 600px;">
          <h2 style="color: #2563eb; margin-top: 0;">New Appointment Request</h2>
          <p><strong>Customer:</strong> ${formData.firstName} ${formData.lastName}</p>
          <p><strong>Vehicle:</strong> ${formData.year} ${formData.make} ${formData.model}</p>
          <p><strong>Service:</strong> ${formData.service}</p>
          <p><strong>Date:</strong> ${formData.date} at ${formData.timeSlot}</p>
          
          <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #eee;">
            <p style="margin: 0;"><strong>Phone:</strong> <a href="tel:${formData.phone}">${formData.phone}</a> (Click to call)</p>
            <p style="margin: 5px 0 0 0;"><strong>Email:</strong> <a href="mailto:${formData.email}">${formData.email}</a></p>
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 15px;">
            <strong>Tip:</strong> You can hit 'Reply' in your email app to contact the customer directly.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend API Error:", error);
      throw new Error(error.message);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Booking Error:", error);
    return { success: false, error: error.message || "Failed to process booking" };
  }
}
