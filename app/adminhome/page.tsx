'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Box,
  Container,
  Paper,
  Typography,
  useMediaQuery,
  CircularProgress,
  Divider,
  Button
} from '@mui/material';
import { grey, blue } from '@mui/material/colors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface User {
  id: string;
  username: string;
  email: string;
  profile_pic?: string | null;
  exp: number;
  visibility: string;
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width:600px)');

  // Check for user authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/check-auth', {
          method: 'GET',
          credentials: 'include',
        });
        if (!response.ok) {
          router.push('/');
        } else {
          const userData: User = await response.json();
          setUser(userData);
        }
      } catch (error) {
        router.push('/');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <Box height="100vh" display="flex" justifyContent="center" alignItems="center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxHeight: '75vh',
        overflow: 'hidden',
      }}
    >
      <Container
        maxWidth="lg"
        disableGutters
        sx={{
          p: isMobile ? 2 : 4,
          minHeight: 'calc(100vh - 64px)', // Adjust for AppBar height (64px)
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <Box
          component="header"
          sx={{
            py: 3,
            textAlign: 'center',
            background: blue[50],
            borderBottom: `2px solid ${grey[300]}`,
          }}
        >
          <Typography variant={isMobile ? 'h5' : 'h4'} sx={{ fontWeight: 700, letterSpacing: 1 }}>
            Dashboard
          </Typography>
        </Box>
        
        {/* Main Content */}
        <Box
          component="main"
          sx={{
            mt: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            height: 'calc(100% - 100px)', // Adjust height to fit within the container
            overflow: 'auto',
          }}
        >
          <Paper
            elevation={4}
            sx={{
              p: 4,
              borderRadius: 1,
              width: '100%',
              maxWidth: 800,
              textAlign: 'center',
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: blue[700] }}>
              Welcome, {user?.username || 'User'}!
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body1" sx={{ mb: 3, color: grey[700], lineHeight: 1.6 }}>
              It's recommended to use the admin account on a desktop or laptop for the best experience.
            </Typography>
            {/* Removed navigation buttons */}
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
