'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Container,
  Box,
  Paper,
  Typography,
  useMediaQuery,
  CircularProgress,
} from '@mui/material';
import { keyframes } from '@emotion/react';
import { grey, blue } from '@mui/material/colors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Subject {
  id: string;
  sub: string;
}

const clickAnimation = keyframes`
  0% { transform: scale(1.05); }
  100% { transform: scale(0.95); }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const metadata = {
  title: 'Home',
  description: 'Home Page for Ailice',
};


export default function HomePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width:600px)');
  const [loading, setLoading] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/check-auth', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          router.push('/');
        }
      } catch (error) {
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Fetch subjects from Supabase
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await supabase.from('subjects').select('id, sub');
        const { data, error } = response;

        if (error) {
          console.error('Supabase error:', error);
          return;
        }

        const validData = Array.isArray(data)
          ? data.filter((item): item is Subject =>
              item &&
              typeof item === 'object' &&
              'id' in item &&
              'sub' in item &&
              typeof item.id === 'string' &&
              typeof item.sub === 'string'
            )
          : [];

        setSubjects(validData);
      } catch (error) {
        console.error('Failed to fetch subjects:', error);
      }
    };
    fetchSubjects();
  }, []);

  // Navigate to subject page on click
  const handleSubjectClick = async (id: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    await router.push(`/home/subject/${id}`);
    setIsProcessing(false);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
<Container maxWidth="lg" sx={{ py: 4 }}>
  {/* Introduction Section */}
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    textAlign="center"
    p={4}
    mb={4}
    sx={{
      background: `linear-gradient(135deg, ${blue[50]} 0%, ${blue[100]} 100%)`,
      borderRadius: '16px',
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
      animation: `${fadeIn} 0.8s ease-out forwards`,
    }}
  >
    <Typography
      variant="h4"
      sx={{
        fontWeight: 700,
        color: blue[900],
        mb: 1,
      }}
    >
      Welcome to Ailice
    </Typography>
    <Typography
      variant="body1"
      sx={{
        fontSize: '1.1rem',
        color: grey[800],
        maxWidth: 600,
      }}
    >
      Ailice is a platform where you can learn, challenge yourself, and achieve your goals.
      Explore our subjects and interact with our AI chatbot for guidance along the way.
    </Typography>
  </Box>

  {/* Subjects Section */}
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    p={4}
    sx={{
      backgroundColor: grey[200],
      borderRadius: '16px',
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
      animation: `${fadeIn} 0.8s ease-out forwards`,
    }}
  >
    <Typography
      variant="h5"
      sx={{
        fontWeight: 600,
        color: grey[900],
        mb: 3,
      }}
    >
      Available Subjects
    </Typography>

    {/* Subject Cards */}
    <Box
      display="flex"
      flexDirection="row"
      flexWrap="wrap"
      justifyContent="center"
      gap={3}
      sx={{
        width: '100%',
      }}
    >
      {subjects.length > 0 ? (
        subjects.map((subject) => (
          <Paper
            key={subject.id}
            elevation={4}
            sx={{
              p: 4,
              textAlign: 'center',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              flex: {
                xs: '0 1 calc(100% - 1rem)',
                sm: '0 1 calc(45% - 1rem)',
                md: '0 1 calc(30% - 1rem)',
              },
              backgroundColor: grey[100],
              borderRadius: '16px',
              boxShadow: '0 6px 12px rgba(0, 0, 0, 0.1)',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              animation: `${fadeIn} 0.8s ease-out forwards`,
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 12px 24px rgba(0, 0, 0, 0.15)',
              },
              '&:active': {
                animation: `${clickAnimation} 0.2s ease`,
              },
              opacity: isProcessing ? 0.5 : 1,
            }}
            onClick={() => handleSubjectClick(subject.id)}
          >
            <Typography
              variant="h6"
              sx={{
                fontSize: '1.1rem',
                color: grey[800],
                fontWeight: 600,
              }}
            >
              {subject.sub}
            </Typography>
          </Paper>
        ))
      ) : (
        <Typography
          variant="h6"
          sx={{
            color: grey[600],
            textAlign: 'center',
            mt: 4,
          }}
        >
          No subjects available
        </Typography>
      )}
    </Box>
  </Box>
</Container>

  );
}
