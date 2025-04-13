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
    <Container
      maxWidth="lg"
      disableGutters
      sx={{
        background: grey[50],
        p: isMobile ? 2 : 4,
      }}
    >
      {/* Header */}
      <Box
        component="header"
        sx={{
          py: 2,
          textAlign: 'center',
          background: blue[50],
          borderBottom: `1px solid ${grey[300]}`,
        }}
      >
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 600 }}>
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
          gap: 2,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 3,
            borderRadius: 2,
            background: grey[100],
            width: '100%',
            textAlign: 'center',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Welcome, {user?.username || 'User'}!
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="body1" sx={{ mb: 2 }}>
            It's recommended to use the admin account in a desktop or laptop so that you can properly see the database.
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 2,
              justifyContent: 'center',
            }}
          >
            <Button
              variant="contained"
              sx={{
                backgroundColor: blue[700],
                color: 'white',
                borderRadius: 2,
                px: 3,
                py: 1.5,
                boxShadow: 3,
                transition: 'background-color 0.3s ease',
                '&:hover': {
                  backgroundColor: blue[800],
                },
              }}
              onClick={() => router.push('/adminhome/students')}
            >
              Student List
            </Button>
            <Button
              variant="contained"
              sx={{
                backgroundColor: blue[700],
                color: 'white',
                borderRadius: 2,
                px: 3,
                py: 1.5,
                boxShadow: 3,
                transition: 'background-color 0.3s ease',
                '&:hover': {
                  backgroundColor: blue[800],
                },
              }}
              onClick={() => router.push('/adminhome/subjects')}
            >
              Manage Subjects
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
