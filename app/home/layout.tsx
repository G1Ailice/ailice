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
  Skeleton,
  CircularProgress,
  Divider,
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
      paper: '#fff',
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

  // New state to prevent rendering until auth check completes
  const [authChecked, setAuthChecked] = useState(false);

  // AI Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [restrictedQuestions, setRestrictedQuestions] = useState<string[]>([]);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // States for loading and typewriter effect
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
  
    const handleAction = async () => {
      if (isCooldown) return;
      isCooldown = true;
  
      try {
        // Check session and get user data
        const res = await fetch('/api/check-auth');
        if (res.ok) {
          const data = await res.json();
  
          // If the user's role is Admin, redirect to /adminhome and exit
          if (data.role === 'Admin') {
            router.push('/adminhome');
            return;
          }
  
          // Otherwise, proceed normally (for example, if the role is Student)
          setUsername(data.username);
          setUserId(data.id);
  
          // Fetch additional user data details:
          if (data.profile_pic) {
            data.profile_pic_url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${data.profile_pic}`;
          }
          if (data.exp === null) data.exp = 0;
          const levelData = calculateLevel(data.exp);
          setUserLevel(levelData);
          setUserData(data);
  
          // Check if there is an active trial for the user
          const { data: trialData, error } = await supabase
            .from('trial_data')
            .select('*')
            .eq('user_id', data.id)
            .eq('status', 'Ongoing');
  
          if (error) {
            console.error('Error fetching trial data:', error);
          }
  
          if (trialData && trialData.length > 0) {
            const nowManila = new Date(
              new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
            ).getTime();
  
            const activeTrialExists = trialData.some(trial => {
              const trialEndTime = new Date(trial.end_time).getTime();
              return nowManila < trialEndTime;
            });
  
            setIsButtonDisabled(activeTrialExists);
          } else {
            setIsButtonDisabled(false);
          }
          // Authentication is confirmed – render the layout
          setAuthChecked(true);
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error('Error during session check:', error);
        router.push('/');
      }
  
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

  useEffect(() => {
    if (isButtonDisabled) {
      setIsChatOpen(false);
    }
  }, [isButtonDisabled]);

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
    const currentInput = input;
    setInput('');

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
      setIsLoading(false);

      // Typewriter animation for bot’s response
      let index = 0;
      setTypingResponse('');
      const intervalId = setInterval(() => {
        index++;
        setTypingResponse(fullResponse.slice(0, index));
        if (index === fullResponse.length) {
          clearInterval(intervalId);
          setMessages((prev) => [...prev, { text: fullResponse, sender: 'bot' }]);
          setTypingResponse('');
        }
      }, 50);
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

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      clearChat(); // Reset AI chat history on logout
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Profile popover handlers
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAccountSettings = () => {
    router.push('/home/accountsettings');
  };

  const openPopover = Boolean(anchorEl);

  if (!authChecked) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: grey[100],
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
<ThemeProvider theme={theme}>
  <SpeedInsights />
  <CssBaseline />
  {isMobile ? (
    <>
      {/* MOBILE HEADER */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: theme.zIndex.appBar, // ensure it appears on top
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          backgroundColor: '#fff',
          padding: '0.5rem 1rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <Typography
          variant="h4"
          component="div"
          color="primary"
          sx={{
            fontSize: '1.5rem',
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
          <Box sx={{ position: 'relative', width: 80 }}>
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

      {/* Add a top margin/padding to your main content to prevent it from hiding behind the fixed header */}
      <Box sx={{ marginTop: '70px' }}>
        {/* MOBILE BOTTOM NAVIGATION & DRAWER remain unchanged */}
        <BottomNavigation
          sx={{
            position: 'fixed',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#fff',
            borderRadius: '30px',
            boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',
            zIndex: 1000,
            width: '90%',
            maxWidth: 400,
            justifyContent: 'space-around',
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

        <Drawer
          anchor="bottom"
          open={openPopover}
          onClose={handleClose}
          PaperProps={{
            sx: {
              borderRadius: '12px 12px 0 0',
              background: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)',
              p: 2,
              boxShadow: '0px -4px 10px rgba(0, 0, 0, 0.1)',
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <IconButton sx={{ alignSelf: 'flex-end' }} onClick={handleClose}>
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
              variant="text"
              onClick={handleAccountSettings}
              sx={{
                width: '100%',
                color: 'text.primary',
                textTransform: 'none',
              }}
            >
              Account Settings
            </Button>
            <Divider sx={{ width: '100%', my: 1, borderStyle: 'dashed' }} />
            <Button
              variant="text"
              onClick={() =>
                window.location.href =
                  "https://docs.google.com/forms/d/e/1FAIpQLScQUGdmUaG2TzA3NO-pKSHpftlCsgKMgtoaYswbjWtzZocqpA/viewform"
              }
              sx={{
                width: '100%',
                color: 'text.primary',
                textTransform: 'none',
              }}
            >
              System Survey
            </Button>
            <Divider sx={{ width: '100%', my: 1, borderStyle: 'dashed' }} />
            <Button
              variant="text"
              onClick={handleLogout}
              sx={{
                width: '100%',
                color: 'red',
                textTransform: 'none',
              }}
            >
              Logout
            </Button>
          </Box>
        </Drawer>
      </Box>
    </>
  ) : (
    <>
      {/* DESKTOP APPBAR & POPOVER (Unchanged from previous design) */}
      <AppBar
        position="sticky"
        elevation={3}
        sx={{
          backgroundColor: '#fff',
          boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',
          borderRadius: '0 0 8px 8px',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h4" component="div" color="primary" sx={{ fontSize: '2rem' }}>
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
                  open={openPopover}
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
                  sx={{
                    '& .MuiPaper-root': {
                      background: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)',
                      padding: 2,
                      borderRadius: '12px',
                      boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
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
                        fontSize: '1.25rem',
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
                      variant="text"
                      onClick={handleAccountSettings}
                      sx={{
                        width: '100%',
                        color: 'text.primary',
                        textTransform: 'none',
                      }}
                    >
                      Account Settings
                    </Button>
                    <Divider sx={{ width: '100%', my: 1, borderStyle: 'dashed' }} />
                    <Button
                      variant="text"
                      onClick={() =>
                        window.location.href =
                          "https://docs.google.com/forms/d/e/1FAIpQLScQUGdmUaG2TzA3NO-pKSHpftlCsgKMgtoaYswbjWtzZocqpA/viewform"
                      }
                      sx={{
                        width: '100%',
                        color: 'text.primary',
                        textTransform: 'none',
                      }}
                    >
                      System Survey
                    </Button>
                    <Divider sx={{ width: '100%', my: 1, borderStyle: 'dashed' }} />
                    <Button
                      variant="text"
                      onClick={handleLogout}
                      sx={{
                        width: '100%',
                        color: 'red',
                        textTransform: 'none',
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

  <IconButton
    onClick={() => {
      if (!isButtonDisabled) {
        setIsChatOpen(!isChatOpen);
      }
    }}
    disabled={isButtonDisabled}
    sx={{
      width: 60,
      height: 60,
      position: 'fixed',
      bottom: isMobile ? 80 : 20,
      right: 20,
      backgroundColor: theme.palette.primary.main,
      boxShadow: '0px 4px 10px rgba(0,0,0,0.3)',
      borderRadius: '50%',
      '&:hover': { backgroundColor: theme.palette.primary.dark },
      zIndex: theme.zIndex.drawer - 1,
    }}
  >
    <ChatIcon sx={{ fontSize: 30, color: '#fff' }} />
  </IconButton>

  {/* Updated Chat Box */}
  {isChatOpen && (
    <Box
      sx={{
        position: 'fixed',
        bottom: isMobile ? 80 : 20,
        right: isMobile ? 0 : 20,
        width: isMobile ? '100%' : 350,
        height: isMobile ? 'calc(100vh - 80px)' : 600,
        borderRadius: isMobile ? 0 : '16px',
        backgroundColor: '#fff',
        boxShadow: '0px 8px 20px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: theme.zIndex.drawer,
        transition: 'all 0.3s ease-in-out',
      }}
    >
      {/* Chat Box Header */}
      <Box
        sx={{
          background: 'linear-gradient(90deg, #2196F3, #21CBF3)',
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6" sx={{ color: '#fff' }}>
          AILice Chat
        </Typography>
        <Box>
          <IconButton onClick={clearChat} title="Clear Chat">
            <DeleteIcon sx={{ color: '#fff' }} />
          </IconButton>
          <IconButton onClick={() => setIsChatOpen(false)} title="Close Chat">
            <CloseIcon sx={{ color: '#fff' }} />
          </IconButton>
        </Box>
      </Box>

      {/* Chat Messages Container */}
      <Box
        ref={chatContainerRef}
        sx={{
          flex: 1,
          p: 2,
          overflowY: 'auto',
          backgroundColor: '#f7f7f7',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.map((message, index) => (
          <Typography
            key={index}
            align={message.sender === 'user' ? 'right' : 'left'}
            sx={{
              backgroundColor: message.sender === 'user' ? blue[400] : 'lightgray',
              color: message.sender === 'user' ? '#fff' : '#000',
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
        {isLoading && (
          <Skeleton variant="rectangular" height={50} sx={{ margin: '8px 0', borderRadius: 2 }} />
        )}
        {!isLoading && typingResponse && (
          <Typography
            align="left"
            sx={{
              backgroundColor: 'lightgray',
              color: '#000',
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
      <Box sx={{ p: 2, borderTop: '1px solid #eee', backgroundColor: '#fff' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isLoading && typingResponse === '') {
              e.preventDefault();
              sendMessage();
            }
          }}
          multiline
          rows={1}
          maxRows={6}
          sx={{ mb: 2 }}
        />
        <Button
          variant="contained"
          onClick={sendMessage}
          disabled={!input.trim() || isLoading || typingResponse !== ''}
          fullWidth
          sx={{
            borderRadius: 2,
            py: 1.5,
            fontSize: '1rem',
            backgroundColor: theme.palette.primary.main,
            '&:hover': { backgroundColor: theme.palette.primary.dark },
          }}
        >
          Send
        </Button>
      </Box>
    </Box>
  )}
</ThemeProvider>
  );
}
