'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import 'suneditor/dist/css/suneditor.min.css';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface LessonContent {
  id: string;
  content: string;
  content_type: string;
}

const SunEditor = dynamic(() => import('suneditor-react'), { ssr: false });

export default function LessonDetailsTabs() {
  const params = useParams();
  const lessonId = params.lesconId; // use provided parameter name
  const router = useRouter();

  const [currentTab, setCurrentTab] = useState(0);
  const [lessonContent, setLessonContent] = useState<string>('');
  const [gameContent, setGameContent] = useState<string>('');
  const [gameScript, setGameScript] = useState<string>('');
  const [isEditingLesson, setIsEditingLesson] = useState(false);
  const [isEditingGame, setIsEditingGame] = useState(false);
  const [originalLessonContent, setOriginalLessonContent] = useState<string>('');
  const [originalGameContent, setOriginalGameContent] = useState<string>('');
  const [originalGameScript, setOriginalGameScript] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Hidden IDs for content used in deletion/updating.
  const [lessonContentId, setLessonContentId] = useState<string | null>(null);
  const [gameContentId, setGameContentId] = useState<string | null>(null);

  const [userData, setUserData] = useState<any>(null);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [isDiscussionLoading, setIsDiscussionLoading] = useState(false);

  const [replyOpen, setReplyOpen] = useState<{ [key: string]: boolean }>({});
  const [replyInputs, setReplyInputs] = useState<{ [key: string]: string }>({});
  const [replies, setReplies] = useState<{ [key: string]: any[] }>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'Lesson' | 'Game' | null>(null);

  const [isButtonDisabled, setIsButtonDisabled] = useState(false);

  // Snackbar state for confirmations/errors.
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Add new state variables for discussion and reply deletion confirmation dialogs.
  const [confirmDeleteDiscussion, setConfirmDeleteDiscussion] = useState<{ open: boolean; discussionId: string | null }>({ open: false, discussionId: null });
  const [confirmDeleteReply, setConfirmDeleteReply] = useState<{ open: boolean; replyId: string | null; discussionId: string | null }>({ open: false, replyId: null, discussionId: null });

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const handleOpenDeleteDialog = (type: 'Lesson' | 'Game') => {
    setDeleteType(type);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteType(null);
  };

  const handleDeleteContent = async () => {
    setIsButtonDisabled(true);
    if (!deleteType) return;
    try {
      if (deleteType === 'Lesson') {
        if (!lessonContentId) {
          console.error('Lesson Content ID is missing for deletion.');
          return;
        }
        const { error } = await supabase
          .from('lesson_content')
          .delete()
          .eq('id', lessonContentId);
        if (error) {
          console.error('Error deleting Lesson content:', error);
          setSnackbar({ open: true, message: 'Error deleting Lesson content', severity: 'error' });
          return;
        }
        // Reset lesson states.
        setLessonContentId(null);
        setLessonContent('');
        setOriginalLessonContent('');
        setSnackbar({ open: true, message: 'Lesson content deleted successfully', severity: 'success' });
      } else if (deleteType === 'Game') {
        if (!gameContentId) {
          console.error('Game Content ID is missing for deletion.');
          return;
        }
        const { error } = await supabase
          .from('lesson_content')
          .delete()
          .eq('id', gameContentId);
        if (error) {
          console.error('Error deleting Game content:', error);
          setSnackbar({ open: true, message: 'Error deleting Game content', severity: 'error' });
          return;
        }
        // Reset game states.
        setGameContentId(null);
        setGameContent('');
        setOriginalGameContent('');
        setGameScript('');
        setOriginalGameScript('');
        setSnackbar({ open: true, message: 'Game content deleted successfully', severity: 'success' });
      }
    } catch (error) {
      console.error(`Unexpected error deleting ${deleteType} content:`, error);
      setSnackbar({ open: true, message: 'Unexpected error during deletion', severity: 'error' });
    } finally {
      setIsButtonDisabled(false);
      handleCloseDeleteDialog();
    }
  };

  // Add helper functions for discussion deletion confirmation.
  const showDeleteDiscussionDialog = (discussionId: string) => {
    setConfirmDeleteDiscussion({ open: true, discussionId });
  };

  const handleConfirmDeleteDiscussion = async () => {
    if (confirmDeleteDiscussion.discussionId) {
      await handleDeleteMessage(confirmDeleteDiscussion.discussionId);
    }
    setConfirmDeleteDiscussion({ open: false, discussionId: null });
  };

  const handleCancelDeleteDiscussion = () => {
    setConfirmDeleteDiscussion({ open: false, discussionId: null });
  };

  // Add helper functions for reply deletion confirmation.
  const showDeleteReplyDialog = (replyId: string, discussionId: string) => {
    setConfirmDeleteReply({ open: true, replyId, discussionId });
  };

  const handleConfirmDeleteReply = async () => {
    if (confirmDeleteReply.replyId && confirmDeleteReply.discussionId) {
      await handleDeleteReply(confirmDeleteReply.replyId, confirmDeleteReply.discussionId);
    }
    setConfirmDeleteReply({ open: false, replyId: null, discussionId: null });
  };

  const handleCancelDeleteReply = () => {
    setConfirmDeleteReply({ open: false, replyId: null, discussionId: null });
  };

  // Fetch Lesson Content on mount or lessonId change.
  useEffect(() => {
    const fetchLessonContent = async () => {
      setIsLoading(true);
      try {
        const { data: lessonData, error: lessonError } = await supabase
          .from('lesson_content')
          .select('id, content')
          .eq('lessons_id', lessonId)
          .eq('content_type', 'Lesson')
          .limit(1);
        if (lessonError) {
          console.error('Error fetching lesson content:', lessonError);
          return;
        }
        if (lessonData && lessonData.length > 0) {
          const content = lessonData[0].content || '';
          setLessonContentId(lessonData[0].id);
          setLessonContent(content);
          setOriginalLessonContent(content);
        } else {
          // No record yet.
          setLessonContent('');
          setOriginalLessonContent('');
          setLessonContentId(null);
        }
      } catch (error) {
        console.error('Unexpected error fetching lesson content:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLessonContent();
  }, [lessonId]);

  // Fetch Game Content on mount or lessonId change.
  useEffect(() => {
    const fetchGameContent = async () => {
      try {
        const { data, error } = await supabase
          .from('lesson_content')
          .select('id, content, script')
          .eq('lessons_id', lessonId)
          .eq('content_type', 'Game')
          .limit(1);
        if (error) {
          console.error('Error fetching game content:', error);
          return;
        }
        if (data && data.length > 0) {
          const content = data[0].content || '';
          const script = data[0].script || '';
          setGameContentId(data[0].id);
          setGameContent(content);
          setOriginalGameContent(content);
          setGameScript(script);
          setOriginalGameScript(script);
        } else {
          // No record yet.
          setGameContent('');
          setGameScript('');
          setOriginalGameContent('');
          setOriginalGameScript('');
          setGameContentId(null);
        }
      } catch (error) {
        console.error("Unexpected error fetching game content:", error);
      }
    };
    fetchGameContent();
  }, [lessonId]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // When saving, update or insert accordingly.
  const handleSaveLessonContent = async () => {
    setIsButtonDisabled(true);
    try {
      if (lessonContentId) {
        // Update existing record.
        const { error } = await supabase
          .from('lesson_content')
          .upsert({
            id: lessonContentId,
            lessons_id: lessonId,
            content_type: 'Lesson',
            content: lessonContent,
          });
        if (error) throw error;
      } else {
        // Insert new record.
        const { data, error } = await supabase
          .from('lesson_content')
          .insert({
            lessons_id: lessonId,
            content_type: 'Lesson',
            content: lessonContent,
          })
          .select();
        if (error) throw error;
        if (data && data.length > 0) {
          setLessonContentId(data[0].id);
        }
      }
      setOriginalLessonContent(lessonContent);
      setIsEditingLesson(false);
      setSnackbar({ open: true, message: 'Lesson content saved successfully', severity: 'success' });
    } catch (error) {
      console.error('Error saving lesson content:', error);
      setSnackbar({ open: true, message: 'Error saving lesson content', severity: 'error' });
    } finally {
      setIsButtonDisabled(false);
    }
  };

  const handleSaveGameContent = async () => {
    setIsButtonDisabled(true);
    try {
      if (gameContentId) {
        const { error } = await supabase
          .from('lesson_content')
          .upsert({
            id: gameContentId,
            lessons_id: lessonId,
            content_type: 'Game',
            content: gameContent,
            script: gameScript,
          });
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('lesson_content')
          .insert({
            lessons_id: lessonId,
            content_type: 'Game',
            content: gameContent,
            script: gameScript,
          })
          .select();
        if (error) throw error;
        if (data && data.length > 0) {
          setGameContentId(data[0].id);
        }
      }
      setOriginalGameContent(gameContent);
      setOriginalGameScript(gameScript);
      setIsEditingGame(false);
      setSnackbar({ open: true, message: 'Game content saved successfully', severity: 'success' });
    } catch (error) {
      console.error('Error saving game content:', error);
      setSnackbar({ open: true, message: 'Error saving game content', severity: 'error' });
    } finally {
      setIsButtonDisabled(false);
    }
  };

  // Toggle edit mode.
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

  const handleDeleteMessage = async (discussionId: string) => {
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

  const handleDeleteReply = async (replyId: string, discussId: string) => {
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
    removeExistingScript();
    cleanupGlobalGameVars();
  }, [lessonId]);

  // Run the game script when the Game Content tab is active.
  useEffect(() => {
    if (currentTab !== 1 || !gameContent) return;

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
  }, [currentTab, gameContent, gameScript]);

  const handleRefreshGameContent = () => {
    if (currentTab === 1) {
      const gameContainer = document.getElementById('game-container');
      if (gameContainer) {
        gameContainer.innerHTML = '';
        removeExistingScript();
        cleanupGlobalGameVars();
        gameContainer.innerHTML = gameContent;

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
      }
    }
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
          <Tab label="Practice Content" />
          <Tab label="Discussions" />
        </Tabs>

        {currentTab === 0 && (
          <Box mt={2}>
            
            {isEditingLesson ? (
              <>
                {/* Save and Cancel buttons on top-left */}
                <Box mb={2} display="flex" justifyContent="flex-start" gap={2}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveLessonContent}
                    disabled={isButtonDisabled}
                  >
                    Save
                  </Button>
                  <Button variant="outlined" onClick={handleCancelLessonEdit}>
                    Cancel
                  </Button>
                </Box>
                <Box
                  mb={2}
                  id="myToolbar"
                  className="sun-editor"
                  sx={{
                    position: 'sticky',
                    top: '64px', // Adjusted to account for the app bar height
                    zIndex: 1000,
                    backgroundColor: 'white',
                    borderBottom: '1px solid #ddd',
                  }}
                />
                <SunEditor
                  setOptions={{
                    height: 'auto', // Remove height limit
                    toolbarContainer: '#myToolbar',
                    buttonList: [
                      ['undo', 'redo'],
                      ['font', 'fontSize', 'formatBlock'],
                      ['paragraphStyle', 'blockquote'],
                      ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
                      ['fontColor', 'hiliteColor', 'textStyle'],
                      ['removeFormat'],
                      ['outdent', 'indent'],
                      ['align', 'horizontalRule', 'list', 'lineHeight'],
                      ['table', 'link', 'image', 'video', 'audio'],
                      ['fullScreen', 'showBlocks', 'codeView', 'preview', 'print'],
                    ],
                  }}
                  setContents={lessonContent}
                  onChange={(content: string) => setLessonContent(content)}
                />
              </>
            ) : (
              <>
                <Box display="flex" justifyContent="flex-start" alignItems="center" gap={2} mb={2}>
                  <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setIsEditingLesson(true)}>
                    {lessonContentId ? 'Edit' : 'Add'}
                  </Button>
                  {lessonContentId && (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleOpenDeleteDialog('Lesson')}
                      disabled={isButtonDisabled}
                    >
                      Delete 
                    </Button>
                  )}
                </Box>
                <Box
                  sx={{
                    padding: 2,
                    border: '1px solid #eee',
                    borderRadius: 2,
                    backgroundColor: '#fafafa',
                    overflowY: 'auto',
                    maxHeight: '60vh', // Limit height to 60vh
                    textAlign: 'left',
                    fontSize: { xs: '0.8rem', sm: '1rem' },
                    lineHeight: { xs: 1.4, sm: 1.6 },
                  }}
                >
                  <SunEditor
                    height={'auto'}
                    disable={true}
                    setContents={lessonContent}
                    hideToolbar={true}
                  />
                </Box>
              </>
            )}
          </Box>
        )}

        {currentTab === 1 && (
          <Box mt={2}>
            {isEditingGame ? (
              <>
                {/* Save and Cancel buttons on top-left */}
                <Box mb={2} display="flex" justifyContent="flex-start" gap={2}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveGameContent}
                    disabled={isButtonDisabled}
                  >
                    Save
                  </Button>
                  <Button variant="outlined" onClick={handleCancelGameEdit}>
                    Cancel
                  </Button>
                </Box>
                <Typography variant="h6" color="black" mb={1}>
                  Game Content
                </Typography>
                <Box
                  sx={{
                    backgroundColor: '#1e1e1e',
                    padding: 2,
                    borderRadius: 2,
                    border: '1px solid #ccc',
                    mb: 2,
                    color: '#d4d4d4',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                  }}
                >
                  <TextField
                    fullWidth
                    variant="outlined"
                    multiline
                    value={gameContent}
                    onChange={(e) => setGameContent(e.target.value)}
                    sx={{
                      '& .MuiInputBase-root': {
                        backgroundColor: '#1e1e1e',
                        color: '#d4d4d4',
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#3c3c3c',
                      },
                      '& .MuiInputBase-input': {
                        fontFamily: 'monospace',
                      },
                      '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#3c3c3c', // Prevent highlight on focus
                      },
                      height: 'calc(50vh - 150px)',
                      overflowY: 'auto',
                    }}
                  />
                </Box>
                <Typography variant="h6" color="black" mb={1}>
                  Game Script
                </Typography>
                <Box
                  sx={{
                    backgroundColor: '#1e1e1e',
                    padding: 2,
                    borderRadius: 2,
                    border: '1px solid #ccc',
                    color: '#d4d4d4',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                  }}
                >
                  <TextField
                    fullWidth
                    variant="outlined"
                    multiline
                    value={gameScript}
                    onChange={(e) => setGameScript(e.target.value)}
                    sx={{
                      '& .MuiInputBase-root': {
                        backgroundColor: '#1e1e1e',
                        color: '#d4d4d4',
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#3c3c3c',
                      },
                      '& .MuiInputBase-input': {
                        fontFamily: 'monospace',
                      },
                      '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#3c3c3c', // Prevent highlight on focus
                      },
                      height: 'calc(50vh - 150px)',
                      overflowY: 'auto',
                    }}
                  />
                </Box>
              </>
            ) : (
              <>
                <Box display="flex" justifyContent="flex-start" alignItems="center" gap={2} mb={2}>
                  <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setIsEditingGame(true)}>
                    {gameContentId ? 'Edit' : 'Add'}
                  </Button>
                  {gameContentId && (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleOpenDeleteDialog('Game')}
                      disabled={isButtonDisabled}
                    >
                      Delete 
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleRefreshGameContent}
                  >
                    Refresh
                  </Button>
                </Box>
                <Box
                  mt={2}
                  sx={{
                    maxHeight: '70vh',
                    overflowY: 'auto',
                    backgroundColor: '#1e1e1e',
                    color: '#d4d4d4',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    borderRadius: 2,
                    border: '1px solid #3c3c3c',
                    padding: 2,
                    '&::-webkit-scrollbar': { width: '8px' },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: '#555',
                      borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-track': {
                      backgroundColor: '#2e2e2e',
                    },
                  }}
                >
                  <Typography variant="body2" color="#d4d4d4" mb={2}>
                    Switching to other tabs will reset your progression.
                  </Typography>
                  {gameContent ? (
                    <Box id="game-container" dangerouslySetInnerHTML={{ __html: gameContent }} />
                  ) : (
                    <Typography variant="body1" color="#888">
                      Content not available.
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </Box>
        )}

        {currentTab === 2 && (
          <Box mt={2}>
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
                      <IconButton
                        onClick={() => showDeleteDiscussionDialog(msg.id)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <Collapse in={replyOpen[msg.id]} timeout="auto" unmountOnExit>
                      <Box mt={1} p={1} borderTop="1px solid #ddd">
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
                              <IconButton
                                onClick={() => showDeleteReplyDialog(reply.id, msg.id)}
                                color="error"
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
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

        <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete this {deleteType} content? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog} color="primary">
              Cancel
            </Button>
            <Button onClick={handleDeleteContent} color="error" disabled={isButtonDisabled}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={confirmDeleteDiscussion.open} onClose={handleCancelDeleteDiscussion}>
          <DialogTitle>Confirm Comment Deletion</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete this comment? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancelDeleteDiscussion} color="primary">
              Cancel
            </Button>
            <Button onClick={handleConfirmDeleteDiscussion} color="error">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={confirmDeleteReply.open} onClose={handleCancelDeleteReply}>
          <DialogTitle>Confirm Reply Deletion</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete this reply? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancelDeleteReply} color="primary">
              Cancel
            </Button>
            <Button onClick={handleConfirmDeleteReply} color="error">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
