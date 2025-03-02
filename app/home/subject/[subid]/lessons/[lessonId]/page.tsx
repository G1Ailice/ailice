'use client'

declare global {
  interface Window {
    questions?: any;
    startGame?: any;
  }
}

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Typography,
  Container,
  Box,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  useTheme,
  Skeleton,
} from '@mui/material';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface LessonContent {
  id: string;
  content: string;
  content_type: string;
}

export default function LessonDetailsTabs() {
  // Normalize lessonId to be a string or null.
  const params = useParams();
  const lessonId =
    typeof params.lessonId === 'string'
      ? params.lessonId
      : Array.isArray(params.lessonId)
      ? params.lessonId[0]
      : null;

  const [lessonContent, setLessonContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);
  const theme = useTheme();
  const [gameContent, setGameContent] = useState('');
  const [gameScript, setGameScript] = useState('');
  const [gameLoaded, setGameLoaded] = useState(false);
  // Keep track of the lesson ID for which the game content was fetched.
  const [gameLessonId, setGameLessonId] = useState<string | null>(null);
  const router = useRouter();

  // Utility: remove previously appended game script element.
  const removeExistingScript = () => {
    const existingScript = document.getElementById('game-script');
    if (existingScript) {
      existingScript.remove();
    }
  };

  // Utility: try to clean up known global variables created by the game script.
  const cleanupGlobalGameVars = () => {
    try {
      // If the game script declares "questions" and "startGame", remove them.
      if (typeof window.questions !== 'undefined') {
        try {
          delete window.questions;
        } catch {
          window.questions = undefined;
        }
      }
      if (typeof window.startGame !== 'undefined') {
        try {
          delete window.startGame;
        } catch {
          window.startGame = undefined;
        }
      }
      // Add other identifiers as needed...
    } catch (error) {
      console.error('Error cleaning up global game vars:', error);
    }
  };

  // On component mount, remove any lingering game script.
  useEffect(() => {
    removeExistingScript();
    cleanupGlobalGameVars();
  }, []);

  // When lessonId changes, reset game state and remove any previously appended game script.
  useEffect(() => {
    setGameContent('');
    setGameScript('');
    setGameLoaded(false);
    setGameLessonId(null);
    removeExistingScript();
    cleanupGlobalGameVars();
  }, [lessonId]);

  // Fetch the lesson content.
  useEffect(() => {
    const fetchLessonContent = async () => {
      setIsLoading(true);
      try {
        // Check authentication first.
        const authResponse = await fetch('/api/check-auth', {
          method: 'GET',
          credentials: 'include',
        });
        if (!authResponse.ok) {
          router.push('/');
          return;
        }
        // Fetch lesson content after authentication.
        if (!lessonId) return; // Skip if lessonId is null.
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
  }, [lessonId, router]);

  // Handle tab changes.
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    // If leaving the Practice tab, reset game state and remove any script element.
    if (newValue !== 1) {
      setGameContent('');
      setGameScript('');
      setGameLoaded(false);
      setGameLessonId(null);
      removeExistingScript();
      cleanupGlobalGameVars();
    }
    setCurrentTab(newValue);

    // If switching to the Practice tab, fetch game content.
    if (newValue === 1 && lessonId) {
      const fetchGameContent = async () => {
        // Reset state before fetching.
        setGameContent('');
        setGameScript('');
        setGameLoaded(false);
        setGameLessonId(null);
        removeExistingScript();
        cleanupGlobalGameVars();
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

          // Save the fetched game content, script, and associated lesson ID.
          setGameContent(data?.content || '<p>Game content not available.</p>');
          setGameScript(data?.script || '');
          setGameLessonId(lessonId);
        } catch (error) {
          console.error('Unexpected error fetching game content:', error);
          setGameContent('<p>Game content not available.</p>');
          setGameScript('');
        }
      };

      fetchGameContent();
    }
  };

  useEffect(() => {
    if (currentTab !== 1 || !gameContent || lessonId !== gameLessonId) return;
  
    const runGameScript = () => {
      // Remove any existing script tag
      removeExistingScript();
  
      // Extract the raw script content.
      const scriptContentMatch = gameScript.match(/<script[^>]*>([\s\S]*?)<\/script>/);
      const rawScriptContent = scriptContentMatch ? scriptContentMatch[1] : gameScript;
      // Wrap the content in an IIFE to isolate its scope.
      const wrappedScriptContent = `(function(){ ${rawScriptContent} })();`;
  
      try {
        const script = document.createElement('script');
        script.id = 'game-script';
        script.type = 'text/javascript';
        script.text = wrappedScriptContent;
        document.body.appendChild(script);
      } catch (error) {
        console.error('Error appending wrapped script:', error);
      }
    };
  
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      // Remove old content and globals before adding new content.
      gameContainer.innerHTML = '';
      removeExistingScript();
      cleanupGlobalGameVars();
  
      // Set new game content.
      gameContainer.innerHTML = gameContent;
      // Run the new game script.
      runGameScript();
    }
  
    // Cleanup only when leaving the Practice tab or unmounting.
    return () => {
      if (currentTab !== 1) {
        removeExistingScript();
        cleanupGlobalGameVars();
      }
    };
  }, [currentTab, gameContent, gameScript, lessonId, gameLessonId]);   

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
        backgroundColor: 'background.default',
        minHeight: '70vh',
      }}
    >
      <Box sx={{ mt: 4 }}>
        <Paper
          elevation={6}
          sx={{
            p: 3,
            borderRadius: 3,
            backgroundColor: 'white',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
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
              borderColor: 'divider',
              mb: 3,
            }}
          >
            <Tab label="Lesson" />
            <Tab label="Practice" />
          </Tabs>
          {currentTab === 0 && (
            <Box
              mt={2}
              sx={{
                overflowY: 'auto',
                maxHeight: '60vh',
                p: 0.5,
                textAlign: 'left',
                fontSize: { xs: '0.800rem', sm: '1rem' },
                lineHeight: { xs: 1.4, sm: 1.6 },
                '&::-webkit-scrollbar': { width: '5px' },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'primary.main',
                  borderRadius: '4px',
                  border: '2px solid #fff',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: 'grey.300',
                  borderRadius: '4px',
                },
                '@media (max-width:600px)': {
                  p: 1,
                  fontSize: '0.75rem',
                },
                '& table': {
                  width: '100%',
                  borderCollapse: 'collapse',
                },
                '& th, & td': {
                  border: '1px solid #ddd',
                  p: 1,
                  textAlign: 'left',
                },
                '& th': {
                  backgroundColor: 'grey.100',
                },
              }}
              dangerouslySetInnerHTML={{
                __html: lessonContent || '<p>Lesson content not found.</p>',
              }}
            />
          )}
          {currentTab === 1 && (
            // Limit the height of the Practice tab while making it responsive.
            <Box mt={2} sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <Typography variant="body2" color="error" mb={2}>
                Switching to other tabs will reset your progression.
              </Typography>
              {gameContent ? (
                <Box mt={2} id="game-container" dangerouslySetInnerHTML={{ __html: gameContent }} />
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
