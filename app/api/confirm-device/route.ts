import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { green, grey } from '@mui/material/colors';
import 'typeface-varela-round'; // Import Varela Round font

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Device Confirmation</title>
          <style>
            body { font-family: 'Varela Round', sans-serif; background-color: #ffffff; color: #333; }
            .message { font-size: 18px; padding: 20px; border-radius: 5px; }
            .error { background-color: #f8d7da; color: #721c24; }
            .success { background-color: #d4edda; color: #155724; }
            h1 { color: #0066cc; }
          </style>
        </head>
        <body>
          <h1>Invalid Confirmation Link</h1>
          <div class="message error">The confirmation link is invalid or expired. Please request a new one.</div>
        </body>
      </html>
    `, { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  const { data, error } = await supabase
    .from('device_confirmations')
    .select('email, device')
    .eq('token', token)
    .single();

  if (error || !data) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Device Confirmation</title>
          <style>
            body { font-family: 'Varela Round', sans-serif; background-color: #ffffff; color: #333; }
            .message { font-size: 18px; padding: 20px; border-radius: 5px; }
            .error { background-color: #f8d7da; color: #721c24; }
            h1 { color: #0066cc; }
          </style>
        </head>
        <body>
          <h1>Confirmation Failed</h1>
          <div class="message error">The confirmation failed or the token has expired. Please try again.</div>
        </body>
      </html>
    `, { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  const { email, device } = data;

  // Fetch current device array
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('device')
    .eq('email', email)
    .single();

  if (userError || !user) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Device Confirmation</title>
          <style>
            body { font-family: 'Varela Round', sans-serif; background-color: #ffffff; color: #333; }
            .message { font-size: 18px; padding: 20px; border-radius: 5px; }
            .error { background-color: #f8d7da; color: #721c24; }
            h1 { color: #0066cc; }
          </style>
        </head>
        <body>
          <h1>User Not Found</h1>
          <div class="message error">We couldn't find the user associated with this token.</div>
        </body>
      </html>
    `, { status: 404, headers: { 'Content-Type': 'text/html' } });
  }

  const updatedDevices = [...(user.device || []), device]; // Append new device

  // Update user's device array
  const { error: updateError } = await supabase
    .from('users')
    .update({ device: updatedDevices })
    .eq('email', email);

  if (updateError) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Device Confirmation</title>
          <style>
            body { font-family: 'Varela Round', sans-serif; background-color: #ffffff; color: #333; }
            .message { font-size: 18px; padding: 20px; border-radius: 5px; }
            .error { background-color: #f8d7da; color: #721c24; }
            h1 { color: #0066cc; }
          </style>
        </head>
        <body>
          <h1>Failed to Register Device</h1>
          <div class="message error">There was an issue registering the device. Please try again later.</div>
        </body>
      </html>
    `, { status: 500, headers: { 'Content-Type': 'text/html' } });
  }

  // Delete the token from device_confirmations
  await supabase
    .from('device_confirmations')
    .delete()
    .eq('token', token);

  return new NextResponse(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Device Confirmation</title>
        <style>
          body { font-family: 'Varela Round', sans-serif; background-color: #ffffff; color: #333; }
          .message { font-size: 18px; padding: 20px; border-radius: 5px; }
          .success { background-color: #d4edda; color: #155724; }
          h1 { color: #0066cc; }
        </style>
      </head>
      <body>
        <h1>Device Registered Successfully</h1>
        <div class="message success">Your device has been successfully registered. You can now log in.</div>
      </body>
    </html>
  `, { headers: { 'Content-Type': 'text/html' } });
}
