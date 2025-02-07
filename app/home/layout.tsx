// layout.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppBar,
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  CssBaseline,
  Drawer,
  LinearProgress,
  Popover,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
  IconButton,
  Tooltip,
  useMediaQuery,
  createTheme,
  Skeleton, // <-- Import Skeleton from MUI
} from '@mui/material';
import { grey, blue } from '@mui/material/colors';
import { createClient } from '@supabase/supabase-js';
import 'typeface-varela-round';
import HomeIcon from '@mui/icons-material/Home';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Chat as ChatIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { SpeedInsights } from '@vercel/speed-insights/next';

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
  // User/session state
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [userData, setUserData] = useState<any>(null);
  const [userLevel, setUserLevel] = useState({ level: 1, currentExp: 0, nextExp: 100 });
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width:600px)');

  // AI Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  // Button remains enabled
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [restrictedQuestions, setRestrictedQuestions] = useState<string[]>([]);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // New states for loading and typewriter effect
  const [isLoading, setIsLoading] = useState(false);
  const [typingResponse, setTypingResponse] = useState('');

  // Calculate level based on experience
  const calculateLevel = (exp: number | null) => {
    if (!exp || exp <= 0) return { level: 1, currentExp: 0, nextExp: 100 };
    let level = 1;
    let expNeeded = 100;
    while (exp >= expNeeded && level < 100) {
      exp -= expNeeded;
      level++;
      expNeeded += 50;
    }
    return { level, currentExp: exp, nextExp: expNeeded };
  };

  // Session check and user data fetch (runs on mount and on custom events)
  useEffect(() => {
    let isCooldown = false; // Prevent repeated calls in a short period

    const checkSession = async () => {
      try {
        const res = await fetch('/api/check-auth');
        if (res.ok) {
          const data = await res.json();
          setUsername(data.username);
          setUserId(data.id);
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error('Session check failed:', error);
        router.push('/');
      }
    };

    const fetchUserData = async () => {
      const response = await fetch('/api/check-auth');
      if (response.ok) {
        const data = await response.json();
        if (data.profile_pic) {
          data.profile_pic_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${data.profile_pic}`;
        }
        if (data.exp === null) data.exp = 0;
        const levelData = calculateLevel(data.exp);
        setUserLevel(levelData);
        setUserData(data);
      } else {
        router.push('/');
      }
    };

    const handleAction = () => {
      if (isCooldown) return;
      isCooldown = true;
      checkSession();
      fetchUserData();
      setTimeout(() => {
        isCooldown = false;
      }, 5000);
    };

    document.addEventListener('childAction', handleAction);
    handleAction();
    return () => {
      document.removeEventListener('childAction', handleAction);
    };
  }, [router]);

  // Restore saved chat messages and restricted questions from localStorage
  useEffect(() => {
    const storedMessages = JSON.parse(localStorage.getItem('ailice_chat') || '[]') as Message[];
    setMessages(storedMessages);
  }, []);

  useEffect(() => {
    const storedRestricted = JSON.parse(localStorage.getItem('restricted_questions') || '[]');
    setRestrictedQuestions(storedRestricted);
  }, []);

  // Save chat messages and restricted questions when they change
  useEffect(() => {
    localStorage.setItem('ailice_chat', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('restricted_questions', JSON.stringify(restrictedQuestions));
  }, [restrictedQuestions]);

  // Scroll chat to the bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading, typingResponse]);

  // Send message and process bot reply with loading and typewriter animation
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { text: input, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input; // capture input before clearing
    setInput('');

    // Set loading state so the Skeleton appears
    setIsLoading(true);

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map((msg) => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text,
          })),
          newMessage: currentInput,
          restrictedQuestions,
        }),
      });

      const data = await res.json();
      const fullResponse = data.response ?? 'Sorry, something went wrong.';
      // Stop loading; response is ready
      setIsLoading(false);

      // Start typewriter animation for the bot's response
      let index = 0;
      setTypingResponse('');
      const intervalId = setInterval(() => {
        index++;
        setTypingResponse(fullResponse.slice(0, index));
        if (index === fullResponse.length) {
          clearInterval(intervalId);
          // Once finished, add the final bot message and clear the typing state.
          setMessages((prev) => [...prev, { text: fullResponse, sender: 'bot' }]);
          setTypingResponse('');
        }
      }, 50); // Adjust delay (in ms) per character as needed
    } catch {
      setIsLoading(false);
      setMessages((prev) => [...prev, { text: 'Error: Something went wrong.', sender: 'bot' }]);
    }
  };

  // Clear saved chat history
  const clearChat = () => {
    localStorage.removeItem('ailice_chat');
    localStorage.removeItem('restricted_questions');
    setMessages([]);
  };

  // For the profile popover
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAccountSettings = () => {
    router.push('/home/accountsettings');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const open = Boolean(anchorEl);

  return (
    <ThemeProvider theme={theme}>
      <SpeedInsights />
      <CssBaseline />

      {isMobile ? (
        <>
          {/* Mobile header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              margin: '1rem',
            }}
          >
            <Typography
              variant="h4"
              component="div"
              color="primary"
              sx={{
                fontSize: isMobile ? '1.5rem' : '2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <img src="/icons/ailicemascot.png" alt="AILICEMASCOT" style={{ maxHeight: '30px' }} />
              <img src="/icons/ailiceword.png" alt="AILICE" style={{ maxHeight: '30px' }} />
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                Level {userLevel.level}
              </Typography>
              <Box sx={{ position: 'relative', width: isMobile ? 80 : 100 }}>
                <LinearProgress
                  variant="determinate"
                  value={(userLevel.currentExp / userLevel.nextExp) * 100}
                  sx={{ height: 15, borderRadius: 3 }}
                />
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translate(-50%, 0)',
                    lineHeight: '15px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    width: '100%',
                    textAlign: 'center',
                  }}
                >
                  {userLevel.currentExp}/{userLevel.nextExp}
                </Typography>
              </Box>
            </Box>
          </Box>

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
            <BottomNavigationAction
              icon={<HomeIcon sx={{ fontSize: 30, color: blue[500] }} />}
              onClick={() => router.push('/home')}
              sx={{ minWidth: 'auto' }}
            />
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
              sx={{ minWidth: 'auto', padding: 0 }}
            />
            <BottomNavigationAction
              icon={<ArrowBackIcon sx={{ fontSize: 30, color: blue[500] }} />}
              onClick={() => window.history.back()}
              sx={{ minWidth: 'auto' }}
            />
          </BottomNavigation>

          <Drawer anchor="bottom" open={open} onClose={handleClose} sx={{ zIndex: 1200 }}>
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
              <IconButton sx={{ alignSelf: 'flex-end', mb: '1px' }} onClick={handleClose}>
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
                  mb: 1,
                  backgroundColor: blue[300],
                }}
              >
                {!userData?.profile_pic && userData?.username?.[0]?.toUpperCase()}
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                {userData?.username || 'User'}
              </Typography>
              <Typography variant="body2" sx={{ color: grey[700], mb: 2, textAlign: 'center' }}>
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
              <Button variant="contained" color="error" onClick={handleLogout} sx={{ width: '100%' }}>
                Logout
              </Button>
            </Box>
          </Drawer>
        </>
      ) : (
        <>
          {/* Desktop header */}
          <AppBar position="sticky" color="transparent" elevation={0}>
            <Toolbar sx={{ justifyContent: 'space-between' }}>
              <Typography variant="h4" component="div" color="primary" sx={{ fontSize: isMobile ? '1.5rem' : '2rem' }}>
                <img src="/icons/ailicemascot.png" alt="AILICEMASCOT" style={{ maxHeight: '30px' }} />
                <img src="/icons/ailiceword.png" alt="AILICE" style={{ maxHeight: '30px' }} />
              </Typography>
              <Box display="flex" alignItems="center">
                {username && (
                  <>
                    <Tooltip title="Back">
                      <IconButton
                        onClick={() => router.back()}
                        sx={{ width: 40, height: 40, cursor: 'pointer', marginRight: '10px' }}
                      >
                        <ArrowBackIcon sx={{ fontSize: 30, color: blue[500] }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Home">
                      <IconButton
                        onClick={() => router.push('/home')}
                        sx={{ width: 40, height: 40, cursor: 'pointer', marginRight: '10px' }}
                      >
                        <HomeIcon sx={{ fontSize: 30, color: blue[500] }} />
                      </IconButton>
                    </Tooltip>
                    <Box sx={{ display: 'flex', alignItems: 'center', marginRight: '10px', gap: 1 }}>
                      <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                        Level {userLevel.level}
                      </Typography>
                      <Box sx={{ position: 'relative', width: 100 }}>
                        <LinearProgress
                          variant="determinate"
                          value={(userLevel.currentExp / userLevel.nextExp) * 100}
                          sx={{ height: 15, borderRadius: 3 }}
                        />
                        <Typography
                          variant="body2"
                          color="textSecondary"
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: '50%',
                            transform: 'translate(-50%, 0)',
                            lineHeight: '15px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            width: '100%',
                            textAlign: 'center',
                          }}
                        >
                          {userLevel.currentExp}/{userLevel.nextExp}
                        </Typography>
                      </Box>
                    </Box>
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
                        <Typography variant="body2" sx={{ color: grey[700], mb: 2, textAlign: 'center' }}>
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
        </>
      )}

      <main>
        {userId && <input type="hidden" value={userId} />}
        {children}
      </main>

      {/* ----- AI Chat Icon and Window (visible on all pages) ----- */}

      {/* Chat Icon Button */}
      <IconButton
        onClick={() => setIsChatOpen(!isChatOpen)}
        sx={{
          width: 60,
          height: 60,
          cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
          position: 'fixed',
          bottom: isMobile ? 80 : 20,
          right: 20,
          zIndex: theme.zIndex.drawer - 1,
        }}
        disabled={isButtonDisabled}
      >
        <ChatIcon sx={{ fontSize: 35, color: isButtonDisabled ? 'grey' : blue[500] }} />
      </IconButton>

      {/* Chat Window */}
      {isChatOpen && (
        <Box
          sx={{
            position: 'fixed',
            bottom: isMobile ? 140 : 20,
            right: 20,
            width: 350,
            height: 600,
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '16px',
            backgroundColor: 'white',
            display: 'flex',
            flexDirection: 'column',
            zIndex: theme.zIndex.drawer - 1,
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">AILice</Typography>
            <Box>
              <IconButton onClick={clearChat} title="Clear Chat">
                <DeleteIcon />
              </IconButton>
              <IconButton onClick={() => setIsChatOpen(false)} title="Close Chat">
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Chat Messages */}
          <Box
            ref={chatContainerRef}
            sx={{
              flex: 1,
              overflowY: 'auto',
              marginBottom: '8px',
              paddingRight: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              '&::-webkit-scrollbar': { width: '8px' },
              '&::-webkit-scrollbar-thumb': { backgroundColor: blue[400], borderRadius: '4px' },
              '&::-webkit-scrollbar-track': { backgroundColor: '#f0f0f0', borderRadius: '4px' },
            }}
          >
            {messages.map((message, index) => (
              <Typography
                key={index}
                align={message.sender === 'user' ? 'right' : 'left'}
                sx={{
                  backgroundColor: message.sender === 'user' ? blue[400] : 'lightgray',
                  color: message.sender === 'user' ? 'white' : 'black',
                  padding: '8px',
                  borderRadius: '8px',
                  alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  wordBreak: 'break-word',
                }}
              >
                {message.sender === 'user'
                  ? `${userData?.username || 'You'}: ${message.text}`
                  : `AILice: ${message.text}`}
              </Typography>
            ))}
            {/* Skeleton loading indicator */}
            {isLoading && (
              <Skeleton variant="rectangular" height={50} sx={{ margin: '8px 0', borderRadius: 2 }} />
            )}
            {/* Typewriter animated bot response */}
            {!isLoading && typingResponse && (
              <Typography
                align="left"
                sx={{
                  backgroundColor: 'lightgray',
                  color: 'black',
                  padding: '8px',
                  borderRadius: '8px',
                  alignSelf: 'flex-start',
                  maxWidth: '75%',
                  wordBreak: 'break-word',
                }}
              >
                {`AILice: ${typingResponse}`}
              </Typography>
            )}
          </Box>

          {/* Input Field and Send Button */}
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            multiline
            rows={1}
            maxRows={6}
            sx={{ marginBottom: '8px' }}
          />
          <Button variant="contained" onClick={sendMessage} disabled={!input.trim()} fullWidth>
            Send
          </Button>
        </Box>
      )}
    </ThemeProvider>
  );
}
