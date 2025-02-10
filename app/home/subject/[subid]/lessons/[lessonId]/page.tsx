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
  const [gameLoaded, setGameLoaded] = useState(false); 
  const router = useRouter();

  useEffect(() => {
    const fetchLessonContent = async () => {
      setIsLoading(true); // Start the loading state
  
      try {
        // Check authentication first
        const authResponse = await fetch('/api/check-auth', {
          method: 'GET',
          credentials: 'include',
        });
  
        if (!authResponse.ok) {
          router.push('/');
          return; // Exit early if not authenticated
        }
  
        // Fetch lesson content after authentication
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
        setIsLoading(false); // End the loading state
      }
    };
  
    if (lessonId) {
      fetchLessonContent();
    }
  }, [lessonId, router]);
  

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
    <Container
      maxWidth="lg"
      sx={{
        py: -2,
        backgroundColor: "background.default",
        minHeight: "100vh",
      }}
    >
      <Box sx={{ mt: 4 }}>
        <Paper
          elevation={6}
          sx={{
            p: 3,
            borderRadius: 3,
            backgroundColor: "white",
            boxShadow: "0 8px 16px rgba(0, 0, 0, 0.1)",
          }}
        >
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              mb: 3,
            }}
          >
            <Tab label="Lesson" />
            <Tab label="Practice" />
            <Tab label="Video Lecture" />
          </Tabs>
          {currentTab === 0 && (
            <Box
              mt={2}
              sx={{
                overflowY: "auto",
                maxHeight: "60vh",
                p: 2,
                textAlign: "left",
                fontSize: { xs: "0.875rem", sm: "1rem" },
                lineHeight: { xs: 1.4, sm: 1.6 },
                "&::-webkit-scrollbar": { width: "8px" },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: "primary.main",
                  borderRadius: "4px",
                  border: "2px solid #fff",
                },
                "&::-webkit-scrollbar-track": {
                  backgroundColor: "grey.300",
                  borderRadius: "4px",
                },
                "@media (max-width:600px)": {
                  p: 1,
                  fontSize: "0.75rem",
                },
                "& table": {
                  width: "100%",
                  borderCollapse: "collapse",
                },
                "& th, & td": {
                  border: "1px solid #ddd",
                  p: 1,
                  textAlign: "left",
                },
                "& th": {
                  backgroundColor: "grey.100",
                },
              }}
              dangerouslySetInnerHTML={{
                __html: lessonContent || "<p>Lesson content not found.</p>",
              }}
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
                  dangerouslySetInnerHTML={{ __html: gameContent }}
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
