'use client'

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Typography, Container, Box, Paper, Tabs, Tab, CircularProgress, useTheme, Skeleton } from '@mui/material';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface LessonContent {
  id: string;
  content: string;
  content_type: string;
}

export default function LessonDetailsTabs() {
  const { lessonId } = useParams();
  const [lessonContent, setLessonContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);
  const theme = useTheme();
  const [gameContent, setGameContent] = useState('');
  const [gameScript, setGameScript] = useState('');
  const [gameLoaded, setGameLoaded] = useState(false); // New state to track if game is loaded

  useEffect(() => {
    const fetchLessonContent = async () => {
      try {
        const { data, error } = await supabase
          .from('lesson_content')
          .select('content, content_type')
          .eq('lessons_id', lessonId)
          .eq('content_type', 'Lesson')
          .single();

        if (error) {
          console.error('Supabase error:', error);
          setLessonContent(null);
          return;
        }

        setLessonContent(data?.content || null);
      } catch (error) {
        console.error('Failed to fetch lesson content:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (lessonId) {
      fetchLessonContent();
    }
  }, [lessonId]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);

    if (newValue === 1) {
      const fetchGameContent = async () => {
        try {
          const { data, error } = await supabase
            .from('lesson_content')
            .select('content, script')
            .eq('lessons_id', lessonId)
            .eq('content_type', 'Game')
            .single();

          if (error) {
            console.error('Error fetching game content:', error);
            setGameContent('<p>Game content not available.</p>');
            setGameScript('');
            return;
          }

          // Set content first, then script
          setGameContent(data?.content || '<p>Game content not available.</p>');
          setGameScript(data?.script || '');
        } catch (error) {
          console.error('Unexpected error fetching game content:', error);
          setGameContent('<p>Game content not available.</p>');
          setGameScript('');
        }
      };

      fetchGameContent();
    } else {
      setGameContent('');
      setGameScript('');
    }
  };

  useEffect(() => {
    if (currentTab === 1 && gameContent && !gameLoaded) {
      const runGameScript = () => {
        try {
          // Check if the script already exists to avoid redeclaration
          let existingScript = document.getElementById('game-script');
          if (!existingScript) {
            const scriptContentMatch = gameScript.match(/<script[^>]*>([\s\S]*?)<\/script>/);
            const scriptContent = scriptContentMatch ? scriptContentMatch[1] : '';

            if (scriptContent) {
              const script = document.createElement('script');
              script.id = 'game-script'; // Add an ID to uniquely identify this script tag
              script.type = 'text/javascript';
              script.textContent = scriptContent;
              document.body.appendChild(script);
            }
          }
        } catch (error) {
          console.error('Error appending script:', error);
        }
      };

      const gameContainer = document.getElementById('game-container');
      if (gameContainer) {
        // Clear previous game content to avoid duplicates
        gameContainer.innerHTML = ''; // Clear old content

        // Render the content
        gameContainer.innerHTML = gameContent;

        // Then run the script
        runGameScript();

        // Set gameLoaded to true after content and script have been appended
        setGameLoaded(true);
      }

      // Cleanup the script when leaving the game tab
      return () => {
        let existingScript = document.getElementById('game-script');
        if (existingScript) {
          document.body.removeChild(existingScript);
        }
      };
    }
  }, [currentTab, gameContent, gameScript, gameLoaded]);

  if (isLoading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box marginTop="1rem">
        <Paper elevation={3} style={{ padding: '1rem' }}>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab label="Lesson" />
            <Tab label="Practice" />
            <Tab label="Video Lecture" />
          </Tabs>
          {currentTab === 0 && (
            <Box
              mt={2}
              sx={{
                overflowY: 'auto',
                maxHeight: '67vh',
                padding: '1rem',
                textAlign: 'left',
                fontSize: { xs: '0.875rem', sm: '1rem' },
                lineHeight: { xs: '1.4', sm: '1.6' },
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: theme.palette.primary.main,
                  borderRadius: '4px',
                  border: '2px solid #fff',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: theme.palette.grey[500],
                  borderRadius: '4px',
                },
                '@media (max-width:600px)': {
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                },
                '& table': {
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: { xs: '0.75rem', sm: '1rem' },
                },
                '& th, & td': {
                  border: '1px solid #ddd',
                  padding: '8px',
                  textAlign: 'left',
                  fontSize: { xs: '0.75rem', sm: '1rem' },
                },
                '& th': {
                  backgroundColor: theme.palette.background.default,
                },
              }}
              dangerouslySetInnerHTML={{ __html: lessonContent || '<p>Lesson content not found.</p>' }}
            />
          )}
          {currentTab === 1 && (
            <Box mt={2}>
              <Typography variant="body2" color="error" mb={2}>
                Switching to other tabs will reset your progression.
              </Typography>
              {gameContent ? (
                <Box
                  mt={2}
                  id="game-container"
                  dangerouslySetInnerHTML={{
                    __html: gameContent,
                  }}
                />
              ) : (
                <Skeleton animation="wave" variant="rectangular" width="100%" height={100} />
              )}
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
}
