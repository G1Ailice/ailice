'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Typography, Container, Box, Paper, Button, Grid, TextField, IconButton, useTheme, Tooltip } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { Chat as ChatIcon, Close as CloseIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { grey, blue, red } from '@mui/material/colors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Lesson {
  id: string;
  lesson_title: string;
  content: string;
}

type Message = { text: string; sender: "user" | "bot" };


export default function LessonDetails() {
  const { subjectId, lessonId } = useParams();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);  
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [restrictedQuestions, setRestrictedQuestions] = useState<string[]>([]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; // Scroll to the bottom
    }
  }, [messages]); //  

  useEffect(() => {
    const fetchUserData = async () => {
      const response = await fetch('/api/check-auth');
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      } else {
        console.log('nothing');
      }
    };
    fetchUserData();
  }, []);  
  

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        // Fetch user info
        const response = await fetch('/api/check-auth');
        const data = await response.json();

        if (data.id) {
          // Check if there's any ongoing status for the user
          const { data: progressData, error } = await supabase
            .from('progress_assessment')
            .select('status')
            .eq('user_id', data.id)
            .eq('status', 'ongoing');

          if (error) {
            console.error(error);
            setIsButtonDisabled(false);
            return;
          }

          // If any "ongoing" status exists, disable the button
          if (progressData.length > 0) {
            setIsButtonDisabled(true);
          } else {
            setIsButtonDisabled(false);
          }
        }
      } catch (error) {
        console.error('Error checking user status:', error);
        setIsButtonDisabled(false);
      }
    };

    checkUserStatus();
  }, []);

  useEffect(() => {
    const fetchLessonDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('lessons')
          .select('id, lesson_title, content')
          .eq('id', lessonId)
          .single();
  
        if (error) {
          console.error('Supabase error:', error);
          setLesson(null);
          return;
        }
  
        setLesson(data as Lesson); // Type assertion to make sure `data` is treated as `Lesson`
      } catch (error) {
        console.error('Failed to fetch lesson details:', error);
      } finally {
        setIsLoading(false);
      }
    };
  
    if (lessonId) {
      fetchLessonDetails();
    }
  }, [lessonId]);

  useEffect(() => {
    const storedMessages = JSON.parse(localStorage.getItem("ailice_chat") || "[]") as Message[];
    setMessages(storedMessages);
  }, []);
  
  useEffect(() => {
    const storedRestricted = JSON.parse(localStorage.getItem('restricted_questions') || '[]');
    setRestrictedQuestions(storedRestricted);
  }, []);

  useEffect(() => {
    localStorage.setItem("ailice_chat", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('restricted_questions', JSON.stringify(restrictedQuestions));
  }, [restrictedQuestions]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { text: input, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((msg) => ({
            role: msg.sender === "user" ? "user" : "assistant",
            content: msg.text,
          })),
          newMessage: input,
          restrictedQuestions, // Send updated restricted questions to the server
        }),
      });

      const data = await res.json();
      const botResponse: Message = { text: data.response ?? "Sorry, something went wrong.", sender: "bot" };
      setMessages((prev) => [...prev, botResponse]);
    } catch {
      setMessages((prev) => [...prev, { text: "Error: Something went wrong.", sender: "bot" }]);
    }
  };

  const clearChat = () => {
    localStorage.removeItem('ailice_chat');
    localStorage.removeItem('restricted_questions');
    setMessages([]);
  };

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
      <Box display="flex" flexDirection="column" alignItems="center" marginTop="1rem"  sx={{ position: 'relative'}}>
        {lesson ? (
          <Paper 
            elevation={3} 
            style={{
              padding: '1rem',
              textAlign: 'center',
              width: '100%',
              position: 'relative',
            }}
            >
              <Button
                variant="contained"
                color="primary"
                sx={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  display: { xs: 'none', sm: 'block' }, // Hide on mobile (xs), show on larger screens (sm+)
                }}
                onClick={() => window.history.back()}
              >
                Back
              </Button>
            <IconButton
              onClick={() => setIsChatOpen(!isChatOpen)}
              sx={{
                width: 60,
                height: 60,
                cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
                position: 'absolute',
                top: '0px',
                right: '10px',
              }}
              disabled={isButtonDisabled}
            >
                <ChatIcon sx={{
                  fontSize: 35,
                  color: isButtonDisabled ? 'grey' : blue[500],
                }} />
            </IconButton>
            <Typography variant="h5" style={{ marginTop: '40px' }}>{lesson.lesson_title}</Typography>
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
              dangerouslySetInnerHTML={{ __html: lesson.content }}
            />
          </Paper>
        ) : (
          <Box textAlign="center">
            <Typography variant="h6" gutterBottom>
              Lesson not found.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => (window.location.href = '/home')}
            >
              Home
            </Button>
          </Box>
        )}
      </Box>
      {isChatOpen && (
        <Box
        sx={{
          position: 'fixed',
          bottom: '20px',
          right: '10px',
          width: '350px',
          height: '600px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '16px',
          backgroundColor: 'white',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2000,
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
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: blue[400],
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: '#f0f0f0',
              borderRadius: '4px',
            },
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
              {message.sender === 'user' ? `${userData?.username || 'You'}:${message.text}` : `AILice: ${message.text}`}
            </Typography>
          ))}
        </Box>
  
        {/* Input Field */}
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
    </Container>
  );
}
