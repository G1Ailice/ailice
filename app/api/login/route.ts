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
    });

    return NextResponse.json({
      message: 'Device is not registered. Confirmation sent to email.',
    }, { status: 403 });
  }
}
