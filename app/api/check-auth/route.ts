import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'cookie';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? ''; 
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: NextRequest) {
  const cookies = parse(req.headers.get('cookie') || '');
  const session = cookies.session;

  if (!session) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  const userId = session.replace('session-token-', '');

  // Fetch user data including profile_pic, username, email, and exp
  const { data, error } = await supabase
    .from('users')
    .select('id, username, email, profile_pic, exp, visibility')
    .eq('id', userId)
    .single();

  if (error || !data || typeof data !== 'object' || !('id' in data) || !('username' in data)) {
    return NextResponse.json({ message: 'User not found' }, { status: 401 });
  }

  return NextResponse.json({
    id: data.id,
    username: data.username,
    email: data.email,
    profile_pic: data.profile_pic || null,
    exp: data.exp || 0,
    visibility: data.visibility,
  });
}
