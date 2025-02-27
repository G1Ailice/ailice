import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const { email, username, password } = await req.json();

    // Fetch the current device from the request headers
    const device = req.headers.get('user-agent') || 'Unknown Device';

    // Check if the email or username already exists in the users table
    const { data: existingUsers } = await supabase
      .from('users')
      .select('email, username')
      .or(`email.eq.${email},username.eq.${username}`);
    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json({ message: 'Email or username already exists', severity: 'warning' }, { status: 400 });
    }

    // Generate a UUID for confirmation
    const id = uuidv4();

    // Compute expiration time: current Manila time + 10 minutes
    const now = new Date();
    const manilaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const tdate = new Date(manilaTime.getTime() + 10 * 60000).toISOString();

    // Insert into account_confirmation table with device attribute
    const { error: insertError } = await supabase
      .from('account_confirmation')
      .insert([{ id, email, username, password, tdate, device }]);
    if (insertError) {
      return NextResponse.json({ message: 'Error storing account confirmation data', severity: 'error' }, { status: 500 });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const confirmLink = `${baseUrl}/api/account-confirmation/${id}`;

    // Configure the transporter using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,  
        pass: process.env.GMAIL_PASS,  
      },
    });

    // HTML email template with the confirmation link
    const emailHtml = `
      <div style="font-family: 'Varela Round', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #ffffff;">
        <h2 style="text-align: center; color: #0066cc;">Welcome to AiLice!</h2>
        <p style="font-size: 16px; color: #333;">
          Thank you for registering with AiLice. Please click the link below to verify your account:
        </p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${confirmLink}" style="display: inline-block; font-size: 18px; color: #ffffff; background-color: #0066cc; padding: 10px 20px; border-radius: 5px; text-decoration: none;">Confirm Account</a>
        </div>
        <p style="font-size: 14px; color: #999; text-align: center;">
          This link will expire in 10 minutes.
        </p>
      </div>
    `;

    // Send the confirmation email
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'AiLice - Confirm Your Account',
      html: emailHtml,
    });

    return NextResponse.json({ message: 'Confirmation email sent', severity: 'success' }, { status: 200 });
  } catch (error) {
    console.error('Error in account confirmation POST:', error);
    return NextResponse.json({ message: 'Failed to send confirmation email', severity: 'error' }, { status: 500 });
  }
}
