'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import DOMPurify from 'dompurify';
import {
  Typography,
  Container,
  Box,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  TextField,
  Button,
  IconButton,
  Collapse,
  Snackbar,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';

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
  const lessonId = params.lesconId; // Use lesconId instead of lessonId

  const router = useRouter();

  const [currentTab, setCurrentTab] = useState(0);
  const [lessonContent, setLessonContent] = useState<string | null>(null);
  const [gameContent, setGameContent] = useState<string | null>(null);
  const [gameScript, setGameScript] = useState<string | null>(null);
  const [isEditingLesson, setIsEditingLesson] = useState(false);
  const [isEditingGame, setIsEditingGame] = useState(false);
  const [originalLessonContent, setOriginalLessonContent] = useState<string | null>(null);
  const [originalGameContent, setOriginalGameContent] = useState<string | null>(null);
  const [originalGameScript, setOriginalGameScript] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [userData, setUserData] = useState<any>(null);
  // Remove discussion posting input state:
  // const [discussionInput, setDiscussionInput] = useState('');
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [isDiscussionLoading, setIsDiscussionLoading] = useState(false);

  const [replyOpen, setReplyOpen] = useState<{ [key: string]: boolean }>({});
  const [replyInputs, setReplyInputs] = useState<{ [key: string]: string }>({});
  const [replies, setReplies] = useState<{ [key: string]: any[] }>({});

  const [openDiscussionLimitWarning, setOpenDiscussionLimitWarning] = useState(false);
  const [openProfanityWarning, setOpenProfanityWarning] = useState(false);

  useEffect(() => {
    const fetchLessonContent = async () => {
      setIsLoading(true);
      try {
        const { data: lessonData } = await supabase
          .from('lesson_content')
          .select('content')
          .eq('lessons_id', lessonId)
          .eq('content_type', 'Lesson')
          .limit(1);

        const { data: gameData } = await supabase
          .from('lesson_content')
          .select('content, script')
          .eq('lessons_id', lessonId)
          .eq('content_type', 'Game')
          .limit(1);

        setLessonContent(lessonData?.[0]?.content || null);
        setOriginalLessonContent(lessonData?.[0]?.content || null);
        setGameContent(gameData?.[0]?.content || null);
        setOriginalGameContent(gameData?.[0]?.content || null);
        setGameScript(gameData?.[0]?.script || null);
        setOriginalGameScript(gameData?.[0]?.script || null);
      } catch (error) {
        console.error('Error fetching lesson content:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLessonContent();
  }, [lessonId]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleSaveLessonContent = async () => {
    try {
      await supabase
        .from('lesson_content')
        .upsert({
          lessons_id: lessonId,
          content_type: 'Lesson',
          content: lessonContent,
        });
      setOriginalLessonContent(lessonContent);
      setIsEditingLesson(false);
    } catch (error) {
      console.error('Error saving lesson content:', error);
    }
  };

  const handleSaveGameContent = async () => {
    try {
      await supabase
        .from('lesson_content')
        .upsert({
          lessons_id: lessonId,
          content_type: 'Game',
          content: gameContent,
          script: gameScript,
        });
      setOriginalGameContent(gameContent);
      setOriginalGameScript(gameScript);
      setIsEditingGame(false);
    } catch (error) {
      console.error('Error saving game content:', error);
    }
  };

  const handleAddContent = async (type: 'Lesson' | 'Game') => {
    try {
      await supabase
        .from('lesson_content')
        .insert({
          lessons_id: lessonId,
          content_type: type,
          content: '',
          ...(type === 'Game' && { script: '' }),
        });
      if (type === 'Lesson') {
        setLessonContent('');
        setOriginalLessonContent('');
      }
      if (type === 'Game') {
        setGameContent('');
        setOriginalGameContent('');
        setGameScript('');
        setOriginalGameScript('');
      }
    } catch (error) {
      console.error(`Error adding ${type} content:`, error);
    }
  };

  const handleCancelLessonEdit = () => {
    setLessonContent(originalLessonContent);
    setIsEditingLesson(false);
  };

  const handleCancelGameEdit = () => {
    setGameContent(originalGameContent);
    setGameScript(originalGameScript);
    setIsEditingGame(false);
  };

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
        const userIds = [...new Set(data.map((d: any) => d.user_id))];
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, username, profile_pic')
          .in('id', userIds);
        if (usersError) {
          console.error('Error fetching users for discussions:', usersError);
        }
        const userMap: { [key: string]: any } = {};
        if (usersData) {
          usersData.forEach((u: any) => {
            userMap[u.id] = u;
          });
        }
        const combined = data.map((d: any) => ({
          ...d,
          username: userMap[d.user_id]?.username || 'Unknown',
          user_profile_pic: userMap[d.user_id]?.profile_pic || '',
        }));
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

  useEffect(() => {
    if (currentTab === 2 && lessonId && userData) {
      fetchDiscussions();
    }
  }, [currentTab, lessonId, userData]);

  // The discussion posting functionality (sending a message) has been removed.
  // The reply functionality remains so users can see and post replies if desired.

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
        combinedReplies.sort(
          (a, b) => new Date(a.time_date).getTime() - new Date(b.time_date).getTime()
        );
        setReplies((prev) => ({ ...prev, [discussId]: combinedReplies }));
      }
    } catch (err) {
      console.error('Unexpected error fetching replies for message:', discussId, err);
    }
  };

  const toggleReplySection = (discussId: string) => {
    setReplyOpen((prev) => {
      const newOpen = { ...prev, [discussId]: !prev[discussId] };
      if (newOpen[discussId]) {
        fetchRepliesForMessage(discussId);
      }
      return newOpen;
    });
  };

  // Reply posting functions remain so users can reply to discussions.
  // If you wish to disable reply posting as well, you could remove or disable this function.
  const handleSendReply = async (discussId: string) => {
    const replyText = replyInputs[discussId];
    if (!replyText || replyText.trim().length === 0) return;

    // Posting reply – you might want to check for profanity here if needed.
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

  const handleDeleteMessage = async (discussionId: string, messageUserId: string) => {
    if (messageUserId !== userData?.id) return;
    try {
      const { error: replyError } = await supabase
        .from('discus_reply')
        .delete()
        .eq('discuss_id', discussionId);
      if (replyError) {
        console.error('Error deleting associated replies:', replyError);
      }
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
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
        <Tabs value={currentTab} onChange={handleTabChange} variant="fullWidth">
          <Tab label="Lesson Content" />
          <Tab label="Game Content" />
          <Tab label="Discussions" />
        </Tabs>

        {currentTab === 0 && (
          <Box mt={2}>
            {lessonContent === null ? (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleAddContent('Lesson')}
              >
                Add Lesson Type
              </Button>
            ) : isEditingLesson ? (
              <>
                <TextField
                  fullWidth
                  multiline
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  sx={{
                    height: 'calc(100vh - 300px)',
                    overflowY: 'auto',
                  }}
                />
                <Box mt={2} display="flex" gap={2}>
                  <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveLessonContent}>
                    Save
                  </Button>
                  <Button variant="outlined" onClick={handleCancelLessonEdit}>
                    Cancel
                  </Button>
                </Box>
              </>
            ) : (
              <>
                <Box
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(lessonContent || ''),
                  }}
                />
                <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setIsEditingLesson(true)} sx={{ mt: 2 }}>
                  Edit
                </Button>
              </>
            )}
          </Box>
        )}

        {currentTab === 1 && (
          <Box mt={2}>
            {gameContent === null ? (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleAddContent('Game')}
              >
                Add Game Type
              </Button>
            ) : isEditingGame ? (
              <>
                <TextField
                  fullWidth
                  multiline
                  label="Game Content"
                  value={gameContent}
                  onChange={(e) => setGameContent(e.target.value)}
                  sx={{
                    height: 'calc(50vh - 150px)',
                    overflowY: 'auto',
                    mb: 2,
                  }}
                />
                <TextField
                  fullWidth
                  multiline
                  label="Game Script"
                  value={gameScript}
                  onChange={(e) => setGameScript(e.target.value)}
                  sx={{
                    height: 'calc(50vh - 150px)',
                    overflowY: 'auto',
                  }}
                />
                <Box mt={2} display="flex" gap={2}>
                  <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveGameContent}>
                    Save
                  </Button>
                  <Button variant="outlined" onClick={handleCancelGameEdit}>
                    Cancel
                  </Button>
                </Box>
              </>
            ) : (
              <>
                <Box
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(gameContent || ''),
                  }}
                />
                <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setIsEditingGame(true)} sx={{ mt: 2 }}>
                  Edit
                </Button>
              </>
            )}
          </Box>
        )}

        {currentTab === 2 && (
          <Box mt={2}>
            {/* Discussion posting section removed.
                The component now only displays existing discussions and replies. */}
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
                  <Box key={msg.id} sx={{ display: 'flex', flexDirection: 'column', border: '1px solid #ccc', borderRadius: 2, p: 1, mb: 1, backgroundColor: '#fff' }}>
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
                    <Collapse in={replyOpen[msg.id]} timeout="auto" unmountOnExit>
                      <Box mt={1} p={1} borderTop="1px solid #ddd">
                        {/* Reply input remains active so that users can respond */}
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
                  There are currently no discussions.
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Paper>
    </Container>
  );
}
