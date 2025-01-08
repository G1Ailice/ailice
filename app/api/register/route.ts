import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? ''; 
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  const { email, username, password } = await req.json();

  console.log(`Registration attempt for email: ${email} and username: ${username}`);

  // Extract device information from the user-agent
  const userAgent = req.headers.get('user-agent') || 'Unknown Device';

  // Check if email or username already exists
  const { data: existingUser, error: existingUserError } = await supabase
    .from('users')
    .select('email, username')
    .or(`email.eq.${email},username.eq.${username}`)
    .single();

  if (existingUserError && existingUserError.code !== 'PGRST116') { // Ignore 'not found' errors
    console.log(`Error checking existing user: ${existingUserError.message}`);
    return NextResponse.json({
      message: 'Server error. Please try again later.',
      severity: 'error' // Snackbar warning severity
    }, { status: 500 });
  }

  const { data: emailUser, error: emailError } = await supabase
    .from('users')
    .select('email')
    .eq('email', email)
    .single();

  const { data: usernameUser, error: usernameError } = await supabase
    .from('users')
    .select('username')
    .eq('username', username)
    .single();

  if (emailUser && usernameUser) {
    console.log(`Registration failed for both email: ${email} and username: ${username} - already exists`);
    return NextResponse.json({
      message: 'Email and Username already taken',
      severity: 'warning'
    }, { status: 400 });
  }

  if (emailUser) {
    console.log(`Registration failed for email: ${email} - already exists`);
    return NextResponse.json({
      message: 'Email is already taken',
      severity: 'warning'
    }, { status: 400 });
  }

  if (usernameUser) {
    console.log(`Registration failed for username: ${username} - already taken`);
    return NextResponse.json({
      message: 'Username already taken',
      severity: 'warning'
    }, { status: 400 });
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Insert the user into the 'users' table
  const { data, error } = await supabase
    .from('users')
    .insert([{ email, username, password: hashedPassword, device: [userAgent] }]);

  if (error) {
    console.log(`Registration failed for email: ${email}, error: ${error.message}`);
    return NextResponse.json({
      message: 'Server error. Please try again later.',
      severity: 'error'
    }, { status: 400 });
  }

  console.log(`Registration successful for email: ${email}`);
  return NextResponse.json({
    message: 'Registration successful',
    severity: 'success'
  }, { status: 201 });
}
