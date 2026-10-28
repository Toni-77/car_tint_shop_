'use server';

import { Resend } from 'resend';
import { db } from '@/utils/firebase'; 
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { z } from 'zod';

const resend = new Resend(process.env.RESEND_API_KEY);

// Define strict validation rules for structural verification and sanitization
const BookingSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50).trim(),
  lastName: z.string().min(1, "Last name is required").max(50).trim(),
  
  // Email Validation
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please provide a valid email format (e.g., name@domain.com)")
    .toLowerCase()
    .trim(),
  
  // Phone Validation (Accepts patterns: 1234567890, 123-456-7890, (123) 456-7890)
  phone: z
    .string()
    .min(1, "Phone number is required")
    .regex(
      /^\+?[1-9]\d{0,3}?[- .]?\(?(?:\d{3})\)?[- .]?\d{3}[- .]?\d{4}$/,
      "Please enter a valid phone number"
    )
    .trim(),
  
  // Car Data Validation
  year: z
    .string()
    .regex(/^\d{4}$/, "Year must be exactly 4 digits")
    .refine((val) => {
      const numericYear = parseInt(val, 10);
      const currentYear = new Date().getFullYear();
      return numericYear >= 1900 && numericYear <= currentYear + 1;
    }, "Please enter a valid automotive year"),
  
  make: z.string().min(1, "Vehicle make is required").max(50).trim(),
  model: z.string().min(1, "Vehicle model is required").max(50).trim(),
  
  // Booking Context Verification
  service: z.string().min(1, "Please select a service").trim(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  timeSlot: z.string().min(1, "Please select a time slot").trim()
});

export async function sendManualBookingRequest(rawFormData: any) {
  try {
    // 1. Filter out un-declared parameters and evaluate inputs
    const validatedData = BookingSchema.parse(rawFormData);

    // 2. Save structured dataset to Firestore
    const docRef = await addDoc(collection(db, "bookings"), {
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      email: validatedData.email,
      phone: validatedData.phone,
      vehicle: {
        year: validatedData.year,
        make: validatedData.make,
        model: validatedData.model
      },
      service: validatedData.service,
      date: validatedData.date,
      timeSlot: validatedData.timeSlot,
      createdAt: Timestamp.now(),
      appointmentTimestamp: Timestamp.fromDate(new Date(`${validatedData.date} ${validatedData.timeSlot}`))
    });

    // 3. Dispatch alert transaction via Resend APIs
    const { error } = await resend.emails.send({
      from: 'DNA Motor Works Bookings <onboarding@resend.dev>', 
      to: [process.env.MY_EMAIL as string], 
      replyTo: validatedData.email, 
      subject: `New Booking Request: ${validatedData.year} ${validatedData.make}`,
      html: `
        <div style="font-family: Arial, sans-serif; border: 1px solid #e2e8f0; padding: 24px; border-radius: 8px; max-width: 600px; color: #1e293b;">
          <h2 style="color: #2563eb; margin-top: 0; font-size: 20px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">New Appointment Confirmation</h2>
          
          <table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 35%;"><strong>Customer:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${validatedData.firstName} ${validatedData.lastName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Vehicle:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${validatedData.year} ${validatedData.make} ${validatedData.model}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Service Requested:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${validatedData.service}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Requested Time:</strong></td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">${validatedData.date} at ${validatedData.timeSlot}</td>
            </tr>
          </table>
          
          <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 14px;"><strong>Contact Information:</strong></p>
            <p style="margin: 8px 0 0 0; font-size: 14px;">Phone: <a href="tel:${validatedData.phone}" style="color: #2563eb; text-decoration: none;">${validatedData.phone}</a></p>
            <p style="margin: 4px 0 0 0; font-size: 14px;">Email: <a href="mailto:${validatedData.email}" style="color: #2563eb; text-decoration: none;">${validatedData.email}</a></p>
          </div>
          
          <p style="margin-top: 24px; margin-bottom: 0; font-size: 11px; color: #94a3b8;">Firestore Document ID: ${docRef.id}</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend delivery exception encountered:", error);
      throw new Error(error.message);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Server Action Processing Error:", error);
    
    // Format error feedback if triggered by schema validation breakdown
    if (error instanceof z.ZodError) {
      const issueSummary = error.errors.map(err => err.message).join(' | ');
      return { success: false, error: issueSummary };
    }

    return { success: false, error: error.message || "An unhandled booking failure occurred" };
  }
}
