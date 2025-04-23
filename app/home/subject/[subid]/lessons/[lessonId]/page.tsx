'use client';

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
    TextField,
    Button,
    IconButton,
    Collapse,
    Snackbar,
    Alert,
  } from '@mui/material';
  import DeleteIcon from '@mui/icons-material/Delete';
  import SunEditor from 'suneditor-react';
  import 'suneditor/dist/css/suneditor.min.css';


  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  interface LessonContent {
    id: string;
    content: string;
    content_type: string;
  }

  export default function LessonDetailsTabs() {
    const params = useParams();
    const lessonId = params.lessonId; 

    const router = useRouter();
    const theme = useTheme();

    // State for lesson and game content.
    const [lessonContent, setLessonContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentTab, setCurrentTab] = useState(0);
    const [gameContent, setGameContent] = useState('');
    const [gameScript, setGameScript] = useState('');
    const [gameLoaded, setGameLoaded] = useState(false);
    const [gameLessonId, setGameLessonId] = useState<string | null>(null);

    // States for discussions.
    const [userData, setUserData] = useState<any>(null);
    const [discussionInput, setDiscussionInput] = useState('');
    const [discussions, setDiscussions] = useState<any[]>([]);
    const [isDiscussionLoading, setIsDiscussionLoading] = useState(false);

    // States for replies.
    const [replyOpen, setReplyOpen] = useState<{ [key: string]: boolean }>({});
    const [replyInputs, setReplyInputs] = useState<{ [key: string]: string }>({});
    const [replies, setReplies] = useState<{ [key: string]: any[] }>({});

    // State for discussion limit warning.
    const [openDiscussionLimitWarning, setOpenDiscussionLimitWarning] = useState(false);
    const [openProfanityWarning, setOpenProfanityWarning] = useState(false);

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

    // Fetch current user data using check-auth.
    useEffect(() => {
      const fetchUserData = async () => {
        try {
          const authResponse = await fetch('/api/check-auth', {
            method: 'GET',
            credentials: 'include',
          });
          if (!authResponse.ok) {
            router.push('/');
            return;
          }
          const data = await authResponse.json();
          setUserData(data);
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      };
      fetchUserData();
    }, [router]);

    // Fetch the lesson content.
    useEffect(() => {
      const fetchLessonContent = async () => {
        setIsLoading(true);
        try {
          if (!lessonId) return;

          const { data: lessonData, error: lessonError } = await supabase
            .from('lesson_content')
            .select('content, content_type')
            .eq('lessons_id', lessonId)
            .eq('content_type', 'Lesson');

          if (lessonError) {
            console.error('Error fetching lesson content:', lessonError);
            setLessonContent(null);
          } else {
            setLessonContent(lessonData?.[0]?.content || null);
          }

          const { data: gameData, error: gameError } = await supabase
            .from('lesson_content')
            .select('content, script')
            .eq('lessons_id', lessonId)
            .eq('content_type', 'Game');

          if (gameError) {
            console.error('Error fetching game content:', gameError);
            setGameContent('');
            setGameScript('');
          } else {
            setGameContent(gameData?.[0]?.content || '');
            setGameScript(gameData?.[0]?.script || '');
          }
        } catch (error) {
          console.error('Unexpected error fetching lesson content:', error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchLessonContent();
    }, [lessonId]);

    // Fetch game content when switching to Practice tab.
    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
      // If leaving the Practice tab, reset game state.
      if (newValue !== 1) {
        setGameContent('');
        setGameScript('');
        setGameLoaded(false);
        setGameLessonId(null);
        removeExistingScript();
        cleanupGlobalGameVars();
      }
      setCurrentTab(newValue);

      if (newValue === 1 && lessonId) {
        const fetchGameContent = async () => {
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
              .eq('content_type', 'Game');

            if (error) {
              console.error('Error fetching game content:', error);
              setGameContent('<p>Game content not available.</p>');
              setGameScript('');
              return;
            }
            setGameContent(data?.[0]?.content || '<p>Game content not available.</p>');
            setGameScript(data?.[0]?.script || '');
            setGameLessonId(Array.isArray(lessonId) ? lessonId[0] : lessonId);
          } catch (error) {
            console.error('Unexpected error fetching game content:', error);
            setGameContent('<p>Game content not available.</p>');
            setGameScript('');
          }
        };

        fetchGameContent();
      }
    };

    // Run the game script when Practice tab is active.
    useEffect(() => {
      if (currentTab !== 1 || !gameContent || lessonId !== gameLessonId) return;

      const runGameScript = () => {
        removeExistingScript();
        const scriptContentMatch = gameScript.match(/<script[^>]*>([\s\S]*?)<\/script>/);
        const rawScriptContent = scriptContentMatch ? scriptContentMatch[1] : gameScript;
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
        gameContainer.innerHTML = '';
        removeExistingScript();
        cleanupGlobalGameVars();
        gameContainer.innerHTML = gameContent;
        runGameScript();
      }

      return () => {
        if (currentTab !== 1) {
          removeExistingScript();
          cleanupGlobalGameVars();
        }
      };
    }, [currentTab, gameContent, gameScript, lessonId, gameLessonId]);

    // Fetch discussions for the current lesson.
    const fetchDiscussions = async () => {
      if (!lessonId) return;
      setIsDiscussionLoading(true);
      try {
        const { data, error } = await supabase
          .from('discussion')
          .select('id, user_id, content, time_date')
          .eq('lesson_id', lessonId);
        if (error) {
          console.error('Error fetching discussions:', error);
          setDiscussions([]);
        } else {
          // Extract unique user_ids from the discussion messages.
          const userIds = [...new Set(data.map((d: any) => d.user_id))];
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, username, profile_pic')
            .in('id', userIds);
          if (usersError) {
            console.error('Error fetching users for discussions:', usersError);
          }
          // Map user_id to user details.
          const userMap: { [key: string]: any } = {};
          if (usersData) {
            usersData.forEach((u: any) => {
              userMap[u.id] = u;
            });
          }
          // Combine discussion messages with user info.
          const combined = data.map((d: any) => ({
            ...d,
            username: userMap[d.user_id]?.username || 'Unknown',
            user_profile_pic: userMap[d.user_id]?.profile_pic || '',
          }));
          // Sort: current user's messages come first, then by oldest time_date.
          combined.sort((a: any, b: any) => {
            if (a.user_id === userData?.id && b.user_id !== userData?.id) {
              return -1;
            } else if (a.user_id !== userData?.id && b.user_id === userData?.id) {
              return 1;
            } else {
              return new Date(a.time_date).getTime() - new Date(b.time_date).getTime();
            }
          });
          setDiscussions(combined);
        }
      } catch (error) {
        console.error('Unexpected error fetching discussions:', error);
        setDiscussions([]);
      } finally {
        setIsDiscussionLoading(false);
      }
    };

    // When switching to the Discussions tab, fetch the discussion messages.
    useEffect(() => {
      if (currentTab === 2 && lessonId && userData) {
        fetchDiscussions();
      }
    }, [currentTab, lessonId, userData]);

    async function checkProfanity(message: string): Promise<boolean> {
      try {
        const res = await fetch('/api/profanity', {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ message })
        });
        const data = await res.json();
        return data.isProfane;
      } catch (error) {
        console.error("Error checking message for profanity:", error);
        // Default to allowing the message if there's an error.
        return false;
      }
    }    
    
    const handleSendMessage = async () => {
      if (!discussionInput.trim()) return;
      if (discussionInput.length > 280) return;
    
      // Check for profanity before posting
      const isProfane = await checkProfanity(discussionInput);
      if (isProfane) {
        setOpenProfanityWarning(true);
        return;
      }
    
      // Check if user already created 2 discussions for this lesson.
      const { count } = await supabase
        .from('discussion')
        .select('id', { count: 'exact', head: true })
        .eq('lesson_id', lessonId)
        .eq('user_id', userData.id);
      if (count !== null && count >= 2) {
        setOpenDiscussionLimitWarning(true);
        return;
      }
      const now = new Date();
      const philippineTime = now.toLocaleString('en-US', { timeZone: 'Asia/Manila' });
      try {
        const { error } = await supabase
          .from('discussion')
          .insert([
            {
              content: discussionInput,
              user_id: userData.id,
              lesson_id: lessonId,
              time_date: philippineTime,
            },
          ]);
        if (error) {
          console.error('Error sending message:', error);
          return;
        }
        setDiscussionInput('');
        fetchDiscussions();
      } catch (error) {
        console.error('Unexpected error sending message:', error);
      }
    };
    

    // Handle deletion of a discussion message.
    // First, delete any replies associated with the discussion.
    const handleDeleteMessage = async (discussionId: string, messageUserId: string) => {
      if (messageUserId !== userData?.id) return;
      try {
        // Delete associated replies first.
        const { error: replyError } = await supabase
          .from('discus_reply')
          .delete()
          .eq('discuss_id', discussionId);
        if (replyError) {
          console.error('Error deleting associated replies:', replyError);
        }
        // Then delete the main discussion.
        const { error } = await supabase
          .from('discussion')
          .delete()
          .eq('id', discussionId);
        if (error) {
          console.error('Error deleting discussion:', error);
          return;
        }
        fetchDiscussions();
      } catch (error) {
        console.error('Unexpected error deleting discussion:', error);
      }
    };

    // --- Reply Functions ---

    // Fetch replies for a specific discussion message.
    const fetchRepliesForMessage = async (discussId: string) => {
      try {
        const { data, error } = await supabase
          .from('discus_reply')
          .select('id, user_id, content, time_date')
          .eq('discuss_id', discussId);
        if (error) {
          console.error('Error fetching replies for discussion', discussId, error);
          return;
        }
        if (data) {
          const replyUserIds = [...new Set(data.map((r: any) => r.user_id))];
          const { data: replyUsers, error: replyUsersError } = await supabase
            .from('users')
            .select('id, username, profile_pic')
            .in('id', replyUserIds);
          if (replyUsersError) {
            console.error('Error fetching users for replies:', replyUsersError);
          }
          const userMap: { [key: string]: any } = {};
          if (replyUsers) {
            replyUsers.forEach((u: any) => {
              userMap[u.id] = u;
            });
          }
          let combinedReplies = data.map((r: any) => ({
            ...r,
            username: userMap[r.user_id]?.username || 'Unknown',
            user_profile_pic: userMap[r.user_id]?.profile_pic || '',
          }));
          // Sort replies: oldest reply appears at the top.
          combinedReplies.sort(
            (a, b) => new Date(a.time_date).getTime() - new Date(b.time_date).getTime()
          );
          setReplies((prev) => ({ ...prev, [discussId]: combinedReplies }));
        }
      } catch (err) {
        console.error('Unexpected error fetching replies for message:', discussId, err);
      }
    };

    // Toggle reply section for a given discussion message.
    const toggleReplySection = (discussId: string) => {
      setReplyOpen((prev) => {
        const newOpen = { ...prev, [discussId]: !prev[discussId] };
        if (newOpen[discussId]) {
          fetchRepliesForMessage(discussId);
        }
        return newOpen;
      });
    };

    // Handle sending a reply for a specific discussion message.
    const handleSendReply = async (discussId: string) => {
      const replyText = replyInputs[discussId];
      if (!replyText || replyText.trim().length === 0) return;
    
      // Check for profanity before posting the reply
      const isProfane = await checkProfanity(replyText);
      if (isProfane) {
        setOpenProfanityWarning(true);
        return;
      }
    
      const now = new Date();
      const philippineTime = now.toLocaleString('en-US', { timeZone: 'Asia/Manila' });
      try {
        const { error } = await supabase
          .from('discus_reply')
          .insert([
            {
              content: replyText,
              user_id: userData.id,
              lesson_id: lessonId,
              discuss_id: discussId,
              time_date: philippineTime,
            },
          ]);
        if (error) {
          console.error('Error sending reply:', error);
          return;
        }
        setReplyInputs((prev) => ({ ...prev, [discussId]: '' }));
        fetchRepliesForMessage(discussId);
      } catch (error) {
        console.error('Unexpected error sending reply:', error);
      }
    };
    

    // Handle deletion of a reply.
    const handleDeleteReply = async (replyId: string, replyUserId: string, discussId: string) => {
      if (replyUserId !== userData?.id) return;
      try {
        const { error } = await supabase
          .from('discus_reply')
          .delete()
          .eq('id', replyId);
        if (error) {
          console.error('Error deleting reply:', error);
          return;
        }
        fetchRepliesForMessage(discussId);
      } catch (error) {
        console.error('Unexpected error deleting reply:', error);
      }
    };

    // Handle closing the discussion limit warning.
    const handleCloseDiscussionWarning = (
      event?: React.SyntheticEvent | Event,
      reason?: string
    ) => {
      if (reason === 'clickaway') {
        return;
      }
      setOpenDiscussionLimitWarning(false);
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
              {gameContent && <Tab label="Practice" />}
              <Tab label="Discussions" />
            </Tabs>
            {currentTab === 0 && (
              <Box
                sx={{
                  overflowY: 'auto',
                  maxHeight: '60vh',
                  p: 0.5,
                  textAlign: 'left',
                  fontSize: { xs: '0.8rem', sm: '1rem' },
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
                }}
              >
                <SunEditor
                  height={'auto'}
                  disable={true}
                  hideToolbar={true}
                  setContents={lessonContent || '<p>Lesson content not found.</p>'}
                  setOptions={{
                    showPathLabel: false, 
                  }}
                />
              </Box>
            )}
            {currentTab === 1 && (
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
            {currentTab === 2 && (
              <Box mt={2}>
                {/* Discussion Input */}
                <Box display="flex" alignItems="center" mb={2}>
                  {userData?.profile_pic && (
                    <Box mr={2} sx={{ width: 40, height: 40, flexShrink: 0 }}>
                      <img
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${userData.profile_pic}`}
                        alt="Profile Pic"
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                    </Box>
                  )}
                  <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Type your message..."
                    value={discussionInput}
                    onChange={(e) => setDiscussionInput(e.target.value)}
                    inputProps={{ maxLength: 280 }}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSendMessage}
                    sx={{ ml: 2, whiteSpace: 'nowrap' }}
                  >
                    Post
                  </Button>
                </Box>
                {/* Discussion Messages */}
                <Box
                  sx={{
                    maxHeight: '55vh',
                    overflowY: 'auto',
                    p: 1,
                    border: '1px solid #ddd',
                    borderRadius: 2,
                    backgroundColor: '#fafafa',
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
                  }}
                >
                  {isDiscussionLoading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" p={2}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : discussions.length > 0 ? (
                    discussions.map((msg) => (
                      // Your existing discussion message component code
                      <Box key={msg.id} sx={{ display: 'flex', flexDirection: 'column', border: '1px solid #ccc', borderRadius: 2, p: 1, mb: 1, backgroundColor: '#fff' }}>
                        {/* Discussion header */}
                        <Box display="flex" alignItems="center">
                          {msg.user_profile_pic && (
                            <Box sx={{ width: 30, height: 30, flexShrink: 0, marginRight: 1 }}>
                              <img
                                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${msg.user_profile_pic}`}
                                alt="User Pic"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                }}
                              />
                            </Box>
                          )}
                          <Box>
                            <Typography variant="subtitle2">{msg.username}</Typography>
                            <Typography variant="body2" sx={{ margin: 0 }}>
                              {msg.content}
                            </Typography>
                            <Typography variant="caption">{msg.time_date}</Typography>
                          </Box>
                        </Box>
                        <Box display="flex" justifyContent="space-between" mt={1}>
                          <Button size="small" onClick={() => toggleReplySection(msg.id)}>
                            {replyOpen[msg.id] ? 'Hide Replies' : 'Show Replies'}
                          </Button>
                          {msg.user_id === userData?.id && (
                            <IconButton onClick={() => handleDeleteMessage(msg.id, msg.user_id)} color="error" size="small">
                              <DeleteIcon />
                            </IconButton>
                          )}
                        </Box>
                        {/* Reply Section (collapsible) */}
                        <Collapse in={replyOpen[msg.id]} timeout="auto" unmountOnExit>
                          <Box mt={1} p={1} borderTop="1px solid #ddd">
                            <Box display="flex" alignItems="center" mb={1}>
                              <TextField
                                fullWidth
                                variant="outlined"
                                size="small"
                                placeholder="Write a reply..."
                                value={replyInputs[msg.id] || ''}
                                onChange={(e) =>
                                  setReplyInputs((prev) => ({ ...prev, [msg.id]: e.target.value }))
                                }
                                inputProps={{ maxLength: 280 }}
                              />
                              <Button variant="contained" color="primary" size="small" sx={{ ml: 1 }} onClick={() => handleSendReply(msg.id)}>
                                Reply
                              </Button>
                            </Box>
                            {/* Replies List */}
                            {replies[msg.id] && replies[msg.id].length > 0 ? (
                              replies[msg.id].map((reply) => (
                                <Box key={reply.id} display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                                  <Box display="flex" alignItems="center">
                                    {reply.user_profile_pic && (
                                      <Box sx={{ width: 25, height: 25, flexShrink: 0, marginRight: 1 }}>
                                        <img
                                          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${reply.user_profile_pic}`}
                                          alt="Reply User Pic"
                                          style={{
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                          }}
                                        />
                                      </Box>
                                    )}
                                    <Box>
                                      <Typography variant="subtitle2" fontSize="0.9rem">
                                        {reply.username}
                                      </Typography>
                                      <Typography variant="body2" fontSize="0.8rem" sx={{ margin: 0 }}>
                                        {reply.content}
                                      </Typography>
                                      <Typography variant="caption" fontSize="0.7rem">
                                        {reply.time_date}
                                      </Typography>
                                    </Box>
                                  </Box>
                                  {reply.user_id === userData?.id && (
                                    <IconButton onClick={() => handleDeleteReply(reply.id, reply.user_id, msg.id)} color="error" size="small">
                                      <DeleteIcon />
                                    </IconButton>
                                  )}
                                </Box>
                              ))
                            ) : (
                              <Typography variant="caption" color="textSecondary">
                                No replies yet.
                              </Typography>
                            )}
                          </Box>
                        </Collapse>
                      </Box>
                    ))
                  ) : (
                    <Typography variant="body1" align="center" sx={{ p: 2 }}>
                      There is currently no discussion ongoing.
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
          </Paper>
        </Box>
        {/* Discussion Limit Warning Snackbar */}
        <Snackbar
          open={openDiscussionLimitWarning}
          autoHideDuration={6000}
          onClose={handleCloseDiscussionWarning}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseDiscussionWarning} severity="warning" sx={{ width: '100%' }}>
            You can only create up to 2 discussions per lesson.
          </Alert>
        </Snackbar>

        <Snackbar
          open={openProfanityWarning}
          autoHideDuration={6000}
          onClose={() => setOpenProfanityWarning(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert onClose={() => setOpenProfanityWarning(false)} severity="warning" sx={{ width: '100%' }}>
            Your message contains inappropriate language and cannot be posted.
          </Alert>
        </Snackbar>
      </Container>
    );
  }
