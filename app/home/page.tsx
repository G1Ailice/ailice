'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js'; 
import { Container, Box, Paper, Typography, useMediaQuery } from '@mui/material';
import { keyframes } from '@emotion/react';
import Loading from './loading';
import {grey, blue } from '@mui/material/colors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Subject {
  id: string;
  sub: string;
}

const clickAnimation = keyframes`
  from {
    transform: scale(1.05);
  }
  to {
    transform: scale(0.95);
  }
`;

export default function HomePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); // New state for disabling
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width:600px)');

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await supabase
          .from('subjects')
          .select('id, sub');
  
        const { data, error } = response;
  
        if (error) {
          console.error('Supabase error:', error);
          return;
        }
  
        const validData = Array.isArray(data)
          ? data.filter((item): item is Subject =>
              item && typeof item === 'object' &&
              'id' in item &&
              'sub' in item &&
              typeof item.id === 'string' &&
              typeof item.sub === 'string'
            )
          : [];
  
        setSubjects(validData);
      } catch (error) {
        console.error('Failed to fetch subjects:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSubjects();
  }, []);
  

  const handleSubjectClick = async (id: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    await router.push(`/home/subject/${id}`);
    setIsProcessing(false);
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <Container maxWidth="lg">
      {/* Introduction Section */}
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        textAlign="center"
        padding="2rem"
        marginBottom="2rem"
        sx={{
          backgroundColor: blue[50],
          borderRadius: '12px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          marginTop: "1rem",
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            color: blue[700],
            marginBottom: '0.5rem',
          }}
        >
          Welcome to Ailice
        </Typography>
        <Typography
          variant="body1"
          sx={{
            fontSize: '1.1rem',
            color: grey[800],
            maxWidth: '600px',
          }}
        >
          Ailice is your personalized and adaptive online learning assistant, powered by AI. 
          Explore a wide range of subjects, interact with the AI chatbot, and unlock a tailored learning experience designed just for you.
        </Typography>
      </Box>

      {/* Subjects Section */}
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        padding="2rem"
        sx={{
          backgroundColor: grey[300],
          borderRadius: '12px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 500,
            color: grey[800],
            marginBottom: '1.5rem',
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
          gap={2}
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
                  padding: '2rem',
                  textAlign: 'center',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  flex: {
                    xs: '0 1 calc(100% - 1rem)', // Full width on extra small screens
                    sm: '0 1 calc(50% - 1rem)', // Half width on small screens
                    md: '0 1 calc(33% - 1rem)', // Third width on medium screens and above
                  },
                  backgroundColor: grey[100],
                  borderRadius: '12px',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.2)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  },
                  opacity: isProcessing ? 0.5 : 1,
                }}
                onClick={() => handleSubjectClick(subject.id)}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontSize: '1rem',
                    color: grey[800],
                    fontWeight: 500,
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
                marginTop: '2rem',
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
