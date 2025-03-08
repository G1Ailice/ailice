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
  Button
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

interface User {
  id: string;
  username: string;
  email: string;
  profile_pic?: string | null;
  exp: number;
  visibility: string;
}

interface UserAcv {
  user_id: string;
  achv_id: string;
  time_date: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  image: string;
}

// Animations
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

// Helper to format the date to Philippine Time (Asia/Manila)
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

export default function HomePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // New states for auth and achievements
  const [user, setUser] = useState<User | null>(null);
  const [achievements, setAchievements] = useState<(UserAcv & Partial<Achievement>)[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const router = useRouter();
  const isMobile = useMediaQuery('(max-width:600px)');

  // Check authentication on mount and store user data
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

  // Fetch subjects from Supabase
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const { data, error } = await supabase.from('subjects').select('id, sub');

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

  // Fetch achievements once user data is available
  useEffect(() => {
    if (!user) return;

    const fetchAchievements = async () => {
      setAchievementsLoading(true);
      try {
        // 1. Fetch user's achievement records (user_acv)
        const { data: userAcvs, error: userAcvError } = await supabase
          .from('user_acv')
          .select('user_id, achv_id, time_date')
          .eq('user_id', user.id);

        if (userAcvError) {
          console.error('Error fetching user achievements:', userAcvError);
          return;
        }

        if (!userAcvs || userAcvs.length === 0) {
          setAchievements([]);
          return;
        }

        // 2. Get list of achievement IDs from user_acv records
        const achievementIds = userAcvs.map((item) => item.achv_id);

        // 3. Fetch achievement details from achievements table
        const { data: achvDetails, error: achvError } = await supabase
          .from('achievements')
          .select('id, name, description, image')
          .in('id', achievementIds);

        if (achvError) {
          console.error('Error fetching achievement details:', achvError);
          return;
        }

        // Map achievements by id for quick lookup
        const achvMap = new Map<string, Achievement>();
        achvDetails?.forEach((achv) => {
          achvMap.set(achv.id, achv);
        });

        // Merge each user_acv record with its achievement details
        const combined = userAcvs.map((item) => ({
          ...item,
          ...achvMap.get(item.achv_id),
        }));

        // Sort achievements by time_date (oldest first or reverse)
        combined.sort((a, b) => {
          return sortOrder === 'asc'
            ? new Date(a.time_date).getTime() - new Date(b.time_date).getTime()
            : new Date(b.time_date).getTime() - new Date(a.time_date).getTime();
        });
        setAchievements(combined);
      } catch (error) {
        console.error('Failed to fetch achievements:', error);
      } finally {
        setAchievementsLoading(false);
      }
    };

    fetchAchievements();
  }, [user, sortOrder]);

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
      {/* Subjects Section */}
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
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

{/* My Achivements Section */}
<Box
  display="flex"
  flexDirection="column"
  alignItems="center"
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
    My Achivements:
  </Typography>
  <Button
    variant="contained"
    onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
    sx={{ mb: 3 }}
  >
    Sort: {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
  </Button>
  {achievementsLoading ? (
    <CircularProgress />
  ) : achievements.length > 0 ? (
    // Wrapper Box with fixed height and scrolling enabled
    <Box
      sx={{
        width: '100%',
        maxHeight: '300px', // Reduced height from 400px to 300px
        overflowY: 'auto',
      }}
    >
      <Box
        display="grid"
        gridTemplateColumns={{
          xs: 'repeat(1, 1fr)', // 1 column for extra-small devices
          sm: 'repeat(2, 1fr)', // 2 columns for small devices
          md: 'repeat(3, 1fr)', // 3 columns for medium devices
          lg: 'repeat(4, 1fr)', // 4 columns for large devices and up
        }}
        gap={2}
        sx={{ width: '100%' }}
      >
        {achievements.map((ach) => (
          <Paper
            key={ach.achv_id}
            elevation={3}
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              backgroundColor: grey[50],
              borderRadius: '12px',
            }}
          >
            <Box
              component="img"
              src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/achivements/${ach.image}`}
              alt={ach.name}
              sx={{
                width: '100%',
                maxWidth: 150,
                borderRadius: '8px',
              }}
            />
            <Typography variant="h6" sx={{ fontWeight: 600, color: grey[800], textAlign: 'center' }}>
              {ach.name}
            </Typography>
            <Typography variant="body2" sx={{ color: grey[700], textAlign: 'center' }}>
              {ach.description}
            </Typography>
            <Typography variant="caption" sx={{ color: grey[600] }}>
              {formatDate(ach.time_date)}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  ) : (
    <Typography
      variant="h6"
      sx={{
        color: grey[600],
        textAlign: 'center',
        mt: 4,
      }}
    >
      You don't have any achievements yet.
    </Typography>
  )}
</Box>


    </Container>
  );
}
