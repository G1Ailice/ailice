import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await the params before using its properties
  const { id } = await params;

  // Retrieve the account confirmation record
  const { data: record, error: fetchError } = await supabase
    .from('account_confirmation')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchError || !record) {
    const errorHtml = `
      <html>
        <head>
          <title>Account Confirmation</title>
          <style>
            body { font-family: 'Varela Round', sans-serif; background: #f0f0f0; color: #333; text-align: center; padding: 50px; }
            .container { background: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #cc0000; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Invalid or Expired Link</h1>
            <p>The confirmation link is invalid or has already expired.</p>
            <a href="/">Go to Login</a>
          </div>
        </body>
      </html>`;
    return new NextResponse(errorHtml, { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  // Check if the confirmation record has expired
  const now = new Date();
  const manilaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  if (new Date(record.tdate) < manilaTime) {
    await supabase.from('account_confirmation').delete().eq('id', id);
    const expiredHtml = `
      <html>
        <head>
          <title>Account Confirmation</title>
          <style>
            body { font-family: 'Varela Round', sans-serif; background: #f0f0f0; color: #333; text-align: center; padding: 50px; }
            .container { background: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #cc0000; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Confirmation Link Expired</h1>
            <p>Your confirmation link has expired. Please register again.</p>
            <a href="/">Go to Login</a>
          </div>
        </body>
      </html>`;
    return new NextResponse(expiredHtml, { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  // Hash the stored password before inserting into users
  const hashedPassword = await bcrypt.hash(record.password, 10);

  // Insert the new user into the users table with visibility set to "Public"
  // Transfer the device (stored as text) as an array
  const { error: insertError } = await supabase
    .from('users')
    .insert([{
      email: record.email,
      username: record.username,
      password: hashedPassword,
      visibility: 'Public',
      device: [record.device]
    }]);
  if (insertError) {
    const insertErrorHtml = `
      <html>
        <head>
          <title>Account Confirmation</title>
          <style>
            body { font-family: 'Varela Round', sans-serif; background: #f0f0f0; color: #333; text-align: center; padding: 50px; }
            .container { background: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #cc0000; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Error Confirming Account</h1>
            <p>There was an error confirming your account. Please try again later.</p>
            <a href="/">Go to Login</a>
          </div>
        </body>
      </html>`;
    return new NextResponse(insertErrorHtml, { status: 500, headers: { 'Content-Type': 'text/html' } });
  }

  // Delete the account_confirmation record now that the user is created
  await supabase.from('account_confirmation').delete().eq('id', id);

  // Return an HTML page to confirm the successful registration
  const successHtml = `
    <html>
      <head>
        <title>Account Confirmed</title>
        <style>
          body {
            font-family: 'Varela Round', sans-serif;
            background-color: #f0f0f0;
            color: #333;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .container {
            background: #fff;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
          }
          h1 { color: #0066cc; }
          p { font-size: 1rem; }
          a {
            display: inline-block;
            margin-top: 1rem;
            padding: 0.5rem 1rem;
            color: #fff;
            background-color: #0066cc;
            text-decoration: none;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Account Confirmed Successfully</h1>
          <p>Your account has been confirmed. You may now log in.</p>
          <a href="/">Go to Login</a>
        </div>
      </body>
    </html>`;
  return new NextResponse(successHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
}
