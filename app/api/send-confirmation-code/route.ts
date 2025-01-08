import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { email, confirmationCode } = await req.json();

    // Configure the transporter with Gmail SMTP settings
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,  // Your Gmail address
        pass: process.env.GMAIL_PASS,  // Your Gmail password or app-specific password
      },
    });

    // Define HTML template for the confirmation email with blue and white theme and Varela Round font
    const emailHtml = `
      <div style="font-family: 'Varela Round', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #ffffff;">
        <h2 style="text-align: center; color: #0066cc;">Welcome to AiLice!</h2>
        <p style="font-size: 16px; color: #333;">
          Thank you for registering with AiLice. Please use the confirmation code below to complete your registration:
        </p>
        <div style="text-align: center; margin: 20px 0;">
          <span style="display: inline-block; font-size: 24px; color: #0066cc; font-weight: bold; letter-spacing: 2px; padding: 10px; border: 2px solid #0066cc; border-radius: 5px;">
            ${confirmationCode}
          </span>
        </div>
        <p style="font-size: 16px; color: #555;">
          This code will expire in 10 minutes. If you did not request this code, please ignore this email.
        </p>
        <p style="font-size: 14px; color: #999; text-align: center;">
          &copy; 2024 AiLice. All rights reserved.
        </p>
      </div>
    `;

    // Send the confirmation code to the user’s email with HTML content
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'AiLice - Confirmation Code',
      html: emailHtml,  // Use the HTML template
    });

    return NextResponse.json({ message: 'Confirmation code sent' }, { status: 200 });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json({ message: 'Failed to send email' }, { status: 500 });
  }
}


