import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { serialize } from 'cookie';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const userAgent = req.headers.get('user-agent') || 'Unknown Device';

  const { data, error } = await supabase
    .from('users')
    .select('id, email, password, username, device')
    .eq('email', email)
    .single();

  if (error || !data || !data.password) {
    return NextResponse.json({ message: 'User not found' }, { status: 401 });
  }

  const passwordMatch = await bcrypt.compare(password, data.password);
  if (!passwordMatch) {
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }

  const isDeviceRegistered = data.device?.includes(userAgent);
  if (isDeviceRegistered) {
    const token = `session-token-${data.id}`;
    const response = NextResponse.json({ message: 'Login successful', redirectTo: '/home' });
    response.headers.set('Set-Cookie', serialize('session', token, {
      httpOnly: true,
      maxAge: 60 * 60 * 24,
      path: '/',
    }));
    return response;
  } else {
    const confirmationToken = crypto.randomBytes(32).toString('hex');
    const confirmationLink = `${process.env.BASE_URL}/api/confirm-device?token=${confirmationToken}`;

    await supabase
      .from('device_confirmations')
      .insert([{ email, token: confirmationToken, device: userAgent }]);

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Device Confirmation',
        text: `A login attempt was made from a new device: ${userAgent}. Please confirm by clicking the link below:\n\n${confirmationLink}`,
        html: `
          <div style="max-width:600px; margin:0 auto; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background:#ffffff; border:1px solid #e0e0e0; border-radius:8px; overflow:hidden;">
            <div style="background:#007bff; padding:20px; text-align:center;">
              <h2 style="color:#ffffff; margin:0;">Device Confirmation</h2>
            </div>
            <div style="padding:20px; color:#333333;">
              <p style="font-size:16px;">A login attempt was made from a new device:</p>
              <p style="font-size:16px; font-weight:bold; color:#007bff;">${userAgent}</p>
              <p style="font-size:16px;">Please confirm your device by clicking the button below:</p>
              <div style="text-align:center; margin-top:20px;">
                <a href="${confirmationLink}" style="display:inline-block; padding:12px 24px; background:#007bff; color:#ffffff; text-decoration:none; border-radius:4px; font-size:16px;">Confirm Device</a>
              </div>
            </div>
            <div style="background:#f7f7f7; padding:10px; text-align:center; font-size:12px; color:#777777;">
              <p>If you did not attempt to log in, please ignore this email.</p>
            </div>
          </div>
        `
      });
      
    return NextResponse.json({
      message: 'Device is not registered. Confirmation sent to email.',
    }, { status: 403 });
  }
}
