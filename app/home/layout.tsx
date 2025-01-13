'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TextField, Drawer, AppBar, Toolbar, Typography, Box, Button, CssBaseline, ThemeProvider, createTheme, Popover, useMediaQuery, Avatar,
 BottomNavigation, BottomNavigationAction} from '@mui/material';
import { grey, blue } from '@mui/material/colors';
import { createClient } from '@supabase/supabase-js';
import 'typeface-varela-round';
import HomeIcon from '@mui/icons-material/Home';
import IconButton from '@mui/material/IconButton';
import { SpeedInsights } from "@vercel/speed-insights/next"
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import Tooltip from '@mui/material/Tooltip';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: blue[500],
    },
    background: {
      default: grey[100],
      paper: grey[200],
    },
  },
  typography: {
    fontFamily: 'Varela Round, sans-serif',
  },
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Message {
  text: string;
  sender: 'user' | 'bot';
}

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width:600px)');
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    // Function to check the user's session
    const checkSession = async () => {
      try {
        // Api request
        const res = await fetch('/api/check-auth');
        
        if (res.ok) {
          // If the response is successful, extract the user data
          const data = await res.json();
          setUsername(data.username); 
          setUserId(data.id);         
        } else {
          // If the response indicates an error, redirect the user to the home page
          router.push('/');
        }
      } catch (error) {
        // Log any errors during the session check and redirect the user to the home page
        console.error('Session check failed:', error);
        router.push('/');
      }
    };
  
    checkSession();
  }, [router]); // Effect re-runs only when the router changes
  

  useEffect(() => {
    const fetchUserData = async () => {
      const response = await fetch('/api/check-auth');
      if (response.ok) {
        const data = await response.json();
        if (data.profile_pic) {
          data.profile_pic_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${data.profile_pic}`;
        }
        setUserData(data);
      } else {
        router.push('/');
      }
    };
    fetchUserData();
  }, [router]);  

  useEffect(() => {
    // Periodically check for any assessments that have reached their time limit and finalize them
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('progress_assessment')
          .select('id, end_time, overallscore')
          .is('overallscore', null);  // Only fetch assessments that are not finished

        if (error) {
          console.error('Error fetching progress assessments:', error);
          return;
        }

        if (data) {
          const now = new Date();
          for (const assessment of data) {
            const endTime = new Date(assessment.end_time);
            if (now >= endTime) {
              // Calculate score and finalize this assessment
              await finalizeAssessment(assessment.id);
            }
          }
        }
      } catch (error) {
        console.error('Error during assessment finalization check:', error);
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, []);

  const finalizeAssessment = async (progressAssessmentId: string) => {
    try {
      // Fetch related questions and calculate the score
      const { data: questions, error } = await supabase
        .from('progress_questions')
        .select('questions_id, inputted_answer, qpoints')
        .eq('progress_assessmentid', progressAssessmentId);

      if (error) {
        console.error('Error fetching questions for assessment finalization:', error);
        return;
      }

      let totalScore = 0;
      if (questions) {
        for (const question of questions) {
          totalScore += question.qpoints;
        }
      }

      // Update overall score and mark assessment as finished
      await supabase
        .from('progress_assessment')
        .update({ overallscore: totalScore, status: 'finished' })
        .eq('id', progressAssessmentId);
      
      console.log(`Assessment ${progressAssessmentId} finalized with score: ${totalScore}`);
    } catch (error) {
      console.error('Error finalizing assessment:', error);
    }
  }; 

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleRefresh = () => {
    window.location.reload(); // Refreshes the page
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAccountSettings = () => {
    router.push('/home/accountsettings');
  };

  const open = Boolean(anchorEl);
  return (
    <ThemeProvider theme={theme}>
      <SpeedInsights />
      <CssBaseline />
      {isMobile ? (
        <>
          <Typography
            variant="h4"
            component="div"
            color="primary"
            sx={{ fontSize: isMobile ? '1.5rem' : '2rem', marginLeft: "1rem", marginTop: "1rem" }}
          >
            <img src="/icons/ailicemascot.png" alt="AILICEMASCOT" style={{ maxHeight: '30px' }} />
            <img src="/icons/ailiceword.png" alt="AILICE" style={{ maxHeight: '30px' }} />
          </Typography>      
          <BottomNavigation
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: grey[200],
              borderTop: '1px solid',
              borderColor: grey[400],
              zIndex: 1000,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '8px 16px',
            }}
          >
            {/* Avatar Button */}
            <BottomNavigationAction
              icon={
                <Avatar
                  src={
                    userData?.profile_pic
                      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${userData.profile_pic}`
                      : undefined
                  }
                  sx={{
                    width: 50,
                    height: 50,
                    backgroundColor: blue[200],
                    border: '2px solid',
                    borderColor: blue[500],
                    borderRadius: '50%',
                  }}
                >
                  {!userData?.profile_pic && userData?.username?.[0]?.toUpperCase()}
                </Avatar>
              }
              onClick={handleClick}
              sx={{
                minWidth: 'auto',
                padding: '0',
              }}
            />

            {/* Home Button */}
            <BottomNavigationAction
              icon={<HomeIcon sx={{ fontSize: 30, color: blue[500] }} />}
              onClick={() => router.push('/home')}
              sx={{
                minWidth: 'auto',
              }}
            />
            
            {/* Refresh Button */}
            <BottomNavigationAction
              icon={<RefreshIcon sx={{ fontSize: 30, color: blue[500] }} />}
              onClick={handleRefresh}
              sx={{
                minWidth: 'auto',
              }}
            />

            {/* Back Button */}
            <BottomNavigationAction
              icon={<ArrowBackIcon sx={{ fontSize: 30, color: blue[500] }} />}
              onClick={() => window.history.back()}
              sx={{
                minWidth: 'auto',
              }}
            />
          </BottomNavigation>

          <Drawer
            anchor="bottom"
            open={open}
            onClose={handleClose}
            sx={{
              zIndex: 1200,
            }}
          >
            <Box
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: blue[200],
                boxShadow: 3,
              }}
            >
              <IconButton
                sx={{ alignSelf: 'flex-end', mb: 1 }}
                onClick={handleClose}
              >
                <CloseIcon />
              </IconButton>
              <Avatar
                src={
                  userData?.profile_pic
                    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${userData.profile_pic}`
                    : undefined
                }
                sx={{
                  width: 80,
                  height: 80,
                  mb: 2,
                  backgroundColor: blue[300],
                }}
              >
                {!userData?.profile_pic && userData?.username?.[0]?.toUpperCase()}
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                {userData?.username || 'User'}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: grey[700], mb: 2, textAlign: 'center' }}
              >
                {userData?.email || 'user@example.com'}
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleAccountSettings}
                sx={{ marginBottom: '8px', width: '100%' }}
              >
                Account Settings
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleLogout}
                sx={{ width: '100%' }}
              >
                Logout
              </Button>
            </Box>
          </Drawer>
        </>
      ) : (
        <AppBar position="sticky" color="transparent" elevation={0}>
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Typography
              variant="h4"
              component="div"
              color="primary"
              sx={{ fontSize: isMobile ? '1.5rem' : '2rem' }}
            >
              <img src="/icons/ailicemascot.png" alt="AILICEMASCOT" style={{ maxHeight: '30px' }} />
              <img src="/icons/ailiceword.png" alt="AILICE" style={{ maxHeight: '30px' }} />
            </Typography>
  
            <Box display="flex" alignItems="center">
              {username && (
                <>
                  <Tooltip title="Back">
                    <IconButton
                      onClick={() => router.back()} // Navigate to the previous page
                      sx={{
                        width: 40,
                        height: 40,
                        cursor: 'pointer',
                        marginRight: '10px',
                      }}
                    >
                      <ArrowBackIcon sx={{ fontSize: 30, color: blue[500] }} />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Home">
                    <IconButton
                      onClick={() => router.push('/home')}
                      sx={{
                        width: 40,
                        height: 40,
                        cursor: 'pointer',
                        marginRight: '10px',
                      }}
                    >
                      <HomeIcon sx={{ fontSize: 30, color: blue[500] }} />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Refresh">
                    <IconButton
                      onClick={handleRefresh}
                      sx={{
                        width: 40,
                        height: 40,
                        cursor: 'pointer',
                        marginRight: '10px',
                      }}
                    >
                      <RefreshIcon sx={{ fontSize: 30, color: blue[500] }} />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Profile">
                    <Avatar
                      onClick={handleClick}
                      src={
                        userData?.profile_pic
                          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${userData.profile_pic}`
                          : undefined
                      }
                      sx={{
                        width: 40,
                        height: 40,
                        cursor: 'pointer',
                        backgroundColor: blue[200],
                        border: '2px solid',
                        borderColor: blue[500],
                        borderRadius: '50%',
                      }}
                    >
                      {!userData?.profile_pic && userData?.username?.[0]?.toUpperCase()}
                    </Avatar>
                  </Tooltip>

                  <Popover
                    open={open}
                    anchorEl={anchorEl}
                    onClose={handleClose}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'center',
                    }}
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        backgroundColor: blue[200],
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        borderRadius: '4px',
                      }}
                    >
                      <Avatar
                        src={
                          userData?.profile_pic
                            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${userData.profile_pic}`
                            : undefined
                        }
                        sx={{
                          width: 80,
                          height: 80,
                          mb: 2,
                          backgroundColor: blue[300],
                        }}
                      >
                        {!userData?.profile_pic && userData?.username?.[0]?.toUpperCase()}
                      </Avatar>
  
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 'bold',
                          fontSize: isMobile ? '1rem' : '1.25rem',
                          mb: 1,
                          textAlign: 'center',
                        }}
                      >
                        {userData?.username || 'User'}
                      </Typography>
  
                      <Typography
                        variant="body2"
                        sx={{
                          color: grey[700],
                          mb: 2,
                          textAlign: 'center',
                        }}
                      >
                        {userData?.email || 'user@example.com'}
                      </Typography>
  
                      <Button
                        variant="contained"
                        color="secondary"
                        onClick={handleAccountSettings}
                        sx={{
                          marginBottom: '8px',
                          fontSize: isMobile ? '0.75rem' : '1rem',
                          width: '100%',
                        }}
                      >
                        Account Settings
                      </Button>
                      <Button
                        variant="contained"
                        color="error"
                        onClick={handleLogout}
                        sx={{
                          fontSize: isMobile ? '0.75rem' : '1rem',
                          width: '100%',
                        }}
                      >
                        Logout
                      </Button>
                    </Box>
                  </Popover>
                </>
              )}
            </Box>
          </Toolbar>
        </AppBar>
      )}
  
      <main>
        {userId && <input type="hidden" value={userId} />}
        {children}
      </main>
    </ThemeProvider>
  );
  
}
