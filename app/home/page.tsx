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
  Button,
  Divider
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

const clickAnimation = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(0.97); }
  100% { transform: scale(1); }
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
  
  const [user, setUser] = useState<User | null>(null);
  const [achievements, setAchievements] = useState<(UserAcv & Partial<Achievement>)[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const router = useRouter();
  const isMobile = useMediaQuery('(max-width:600px)');

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

  useEffect(() => {
    if (!user) return;
    const fetchAchievements = async () => {
      setAchievementsLoading(true);
      try {
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
        const achievementIds = userAcvs.map((item) => item.achv_id);
        const { data: achvDetails, error: achvError } = await supabase
          .from('achievements')
          .select('id, name, description, image')
          .in('id', achievementIds);
        if (achvError) {
          console.error('Error fetching achievement details:', achvError);
          return;
        }
        const achvMap = new Map<string, Achievement>();
        achvDetails?.forEach((achv) => {
          achvMap.set(achv.id, achv);
        });
        const combined = userAcvs.map((item) => ({
          ...item,
          ...achvMap.get(item.achv_id),
        }));
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

  const handleSubjectClick = async (id: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    await router.push(`/home/subject/${id}`);
    setIsProcessing(false);
  };

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
        // Remove minHeight and overflow restrictions so the container fits its content.
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
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 2,
          mt: 2,
        }}
      >
        {/* Subjects Section */}
        <Paper
          elevation={3}
          sx={{
            p: 2,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${blue[50]} 0%, ${blue[100]} 100%)`,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Available Subjects
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <Box sx={{ pr: 1 }}>
            {subjects.length > 0 ? (
              <Box display="flex" flexWrap="wrap" gap={1} justifyContent="center">
                {subjects.map((subject) => (
                  <Paper
                    key={subject.id}
                    elevation={2}
                    sx={{
                      p: 1.5,
                      width: isMobile ? '45%' : '90%',
                      textAlign: 'center',
                      backgroundColor: grey[100],
                      borderRadius: 2,
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      '&:active': { transform: 'scale(0.97)' },
                      opacity: isProcessing ? 0.6 : 1,
                    }}
                    onClick={() => handleSubjectClick(subject.id)}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {subject.sub}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" align="center" color="textSecondary">
                No subjects available
              </Typography>
            )}
          </Box>
        </Paper>
  
        {/* Achievements Section */}
        <Paper
          elevation={3}
          sx={{
            p: 2,
            borderRadius: 2,
            backgroundColor: grey[200],
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              My Achievements
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            >
              {sortOrder === 'asc' ? 'Oldest' : 'Newest'}
            </Button>
          </Box>
          <Divider sx={{ mb: 1 }} />
          <Box sx={{ pr: 1 }}>
            {achievementsLoading ? (
              <Box display="flex" justifyContent="center" alignItems="center">
                <CircularProgress size={24} />
              </Box>
            ) : achievements.length > 0 ? (
              <Box display="grid" gap={1} gridTemplateColumns={{ xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }}>
                {achievements.map((ach) => (
                  <Paper
                    key={ach.achv_id}
                    elevation={1}
                    sx={{
                      p: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5,
                      backgroundColor: grey[50],
                      borderRadius: 2,
                    }}
                  >
                    <Box
                      component="img"
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/achivements/${ach.image}`}
                      alt={ach.name}
                      sx={{ width: '100%', maxWidth: 80, borderRadius: 1 }}
                    />
                    <Typography variant="subtitle2" align="center" sx={{ fontWeight: 600 }}>
                      {ach.name}
                    </Typography>
                    <Typography variant="caption" align="center" color="textSecondary">
                      {formatDate(ach.time_date)}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" align="center" color="textSecondary">
                You don't have any achievements yet.
              </Typography>
            )}
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
