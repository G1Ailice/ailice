'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Typography, Container, Box, Paper, Button, Grid, TextField, IconButton, useTheme, Dialog, DialogActions, DialogContent, DialogTitle, 
  Accordion, AccordionSummary, AccordionDetails ,useMediaQuery, Card } from '@mui/material';
import { Chat as ChatIcon, Close as CloseIcon, Lock, LockOpen } from '@mui/icons-material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Loading from '../../loading';
import { v4 as uuidv4 } from 'uuid';
import { blue, grey, yellow, red} from '@mui/material/colors';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Subject {
  id: string;
  sub: string;
}

interface Lesson {
  id: string;
  lesson_title: string;
  status: 'Open' | 'Locked'; 
  unlocked_by?: string;      
  score_to_unlock?: number;  
  lesson_no: number; 
  content_no: number;
}

interface Attempt {
  id: string;
  overallscore: number;
  assessment_taken: number;
  end_time: string;
  status: string;  // Add status here
}

interface Assessment {
  id: string;
  assessment_title: string;
  lesson_id: string;
  time_limit: number;
  allscore: number; 
}

interface Message {
  text: string;
  sender: 'user' | 'bot';
}


export default function SubjectPage() {
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<{ title: string; time_limit: number; id: string; allscore: number; } | null>(null);
  const { id } = useParams();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProgress, setUserProgress] = useState<string[]>([]); // Track completed lessons by lesson ID
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // Detects small screens
  const [attemptData, setAttemptData] = useState<{ overallscore: number; assessment_taken: number; end_time: string; id: string; status: string;}[]>([]);
  const [isProceeding, setIsProceeding] = useState(false); 

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/check-auth');
        if (res.ok) {
          const data = await res.json();
          setUserId(data.id);
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error('Session check failed:', error);
        router.push('/');
      }
    };

    checkSession();
  }, [router]);

  useEffect(() => {
    const checkTimeLimitAndStatus = async () => {
      if (!userId) return;
  
      // Fetch assessment attempts
      const { data: attempts, error } = await supabase
        .from('progress_assessment')
        .select('id, end_time, status')
        .eq('user_id', userId)
        .eq('assessment_id', selectedAssessment?.id);
  
      if (error) {
        console.error('Error fetching attempts:', error);
        return;
      }
  
      attempts?.forEach(async (attempt) => {
        const endTime = new Date(attempt.end_time);
        const isTimeExceeded = new Date() > endTime;
  
        if (isTimeExceeded && attempt.status !== 'finished') {
          // Update status to 'finished' if the time limit is reached
          const { error: updateError } = await supabase
            .from('progress_assessment')
            .update({ status: 'finished' })
            .eq('id', attempt.id);
  
          if (updateError) {
            console.error('Error updating status:', updateError);
          }
        }
      });
    };
  
    if (selectedAssessment) {
      checkTimeLimitAndStatus();
    }
  }, [selectedAssessment, userId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch subject
        const { data: subjectData, error: subjectError } = await supabase
          .from('subjects')
          .select('id, sub')
          .eq('id', id)
          .single();
        if (subjectError) throw subjectError;
        if (!subjectData) throw new Error('Subject data is empty');
        setSubject(subjectData);
  
        // Fetch lessons with status, unlocked_by, score_to_unlock, and lesson_no attributes
        const { data: lessonsData, error: lessonsError } = await supabase
          .from('lessons')
          .select('id, lesson_title, status, unlocked_by, score_to_unlock, lesson_no, content_no')
          .eq('subject_id', id)
          .order('lesson_no', { ascending: true });
        if (lessonsError) throw lessonsError;
  
        setLessons(lessonsData || []);
  
        // Fetch assessments
        const lessonIds = lessonsData?.map((lesson) => lesson.id) || [];
        const { data: assessmentsData, error: assessmentsError } = await supabase
          .from('assessments')
          .select('id, assessment_title, lesson_id, time_limit, allscore')
          .in('lesson_id', lessonIds);
        if (assessmentsError) throw assessmentsError;
        setAssessments(assessmentsData || []);
  
        // Fetch user progress for lessons
        if (userId) {
          const { data: progressData, error: progressError } = await supabase
            .from('progress_lesson')
            .select('lesson_id')
            .eq('user_id', userId);
          if (progressError) throw progressError;
          setUserProgress(progressData?.map((progress) => progress.lesson_id) || []);
  
          // Fetch progress for assessments
          const { data: progressAssessmentsData, error: progressAssessmentsError } = await supabase
            .from('progress_assessment')
            .select('assessment_id, overallscore')
            .eq('user_id', userId);
          if (progressAssessmentsError) throw progressAssessmentsError;
  
          // Unlock lessons based on progress (percentage-based unlocking)
          const updatedLessons = lessonsData.map((lesson) => {
            if (lesson.status === 'Locked' && Array.isArray(lesson.unlocked_by)) {
              const isUnlocked = lesson.unlocked_by.some((assessmentId) => {
                const matchingAssessment = assessmentsData.find(
                  (assessment) => assessment.id === assessmentId
                );
                const progressForAssessment = progressAssessmentsData.find(
                  (progress) => progress.assessment_id === assessmentId
                );
  
                if (matchingAssessment && progressForAssessment) {
                  const requiredPercentage = lesson.score_to_unlock; // e.g., 80 for 80%
                  const totalScore = matchingAssessment.allscore;
                  const achievedScore = progressForAssessment.overallscore;
  
                  return (achievedScore / totalScore) * 100 >= requiredPercentage;
                }
  
                return false;
              });
  
              return isUnlocked ? { ...lesson, status: 'Open' } : lesson;
            }
            return lesson;
          });
  
          setLessons(updatedLessons);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };
  
    if (id) {
      fetchData();
    }
  }, [id, userId]);
  
  
  
  // Group lessons by lesson_no
  const groupedLessons = lessons.reduce(
    (groups, lesson) => {
      const groupKey = lesson.lesson_no || 'No Lesson Number'; // Group by lesson_no
      if (!groups[groupKey]) {
        groups[groupKey] = { noGroup: [], easy: [], moderate: [], hard: [] };
      }
  
      // Group lessons by content_no
      if (lesson.content_no === 1) {
        groups[groupKey].noGroup.push(lesson);
      } else if (lesson.content_no === 2) {
        groups[groupKey].easy.push(lesson);
      } else if (lesson.content_no === 3) {
        groups[groupKey].moderate.push(lesson);
      } else if (lesson.content_no === 4) {
        groups[groupKey].hard.push(lesson);
      }
  
      // Sort each group based on lesson title
      const sortLessons = (lessons: Lesson[]) =>
        lessons.sort((a, b) => {
          const getNumericPrefix = (title: string) => {
            const match = title.match(/^Lesson (\d+(?:\.\d+)?)/); // Match "Lesson X" or "Lesson X.Y"
            return match ? parseFloat(match[1]) : Number.MAX_VALUE; // Assign max value if no match
          };
          return getNumericPrefix(a.lesson_title) - getNumericPrefix(b.lesson_title);
        });
  
      // Apply sorting
      groups[groupKey].noGroup = sortLessons(groups[groupKey].noGroup);
      groups[groupKey].easy = sortLessons(groups[groupKey].easy);
      groups[groupKey].moderate = sortLessons(groups[groupKey].moderate);
      groups[groupKey].hard = sortLessons(groups[groupKey].hard);
  
      return groups;
    },
    {} as Record<string, { noGroup: Lesson[]; easy: Lesson[]; moderate: Lesson[]; hard: Lesson[] }>
  );
  
  
  const handleLessonClick = async (lessonId: string) => {
    if (!userId) return;

    const { data: progressData, error: progressError } = await supabase
      .from('progress_lesson')
      .select('*')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .single();

    if (progressError && progressError.code !== 'PGRST116') {
      console.error('Error fetching progress data:', progressError);
    }

    if (!progressData) {
      const { error: insertError } = await supabase
        .from('progress_lesson')
        .insert([{ user_id: userId, lesson_id: lessonId }]);
      if (insertError) {
        console.error('Error inserting progress data:', insertError);
      }
    }

    router.push(`/home/subject/${id}/lessons/${lessonId}`);
  };


// Function to handle deletion of an attempt
  const handleDeleteAttempt = async (attemptId: string) => {
    if (!userId) return;

    try {
      // Step 1: Delete associated records in progress_questions
      const { data: progressQuestionsData, error: progressQuestionsError } = await supabase
        .from('progress_questions')
        .delete()
        .eq('progress_assessmentid', attemptId);

      if (progressQuestionsError) {
        console.error('Failed to delete associated questions:', progressQuestionsError);
        return; // Exit if there is an error in deleting questions
      }

      // Step 2: Delete the attempt from progress_assessment
      const { data, error } = await supabase
        .from('progress_assessment')
        .delete()
        .eq('id', attemptId)
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to delete attempt:', error);
      } else {
        // Remove the attempt from the state after successful deletion
        setAttemptData(prevState => prevState.filter(attempt => attempt.id !== attemptId));
      }
    } catch (error) {
      console.error('Error deleting attempt:', error);
    }
  };

  // Function to check if there is an ongoing attempt
  const isOngoingAttempt = () => {
    const ongoingAttempt = attemptData.find((attempt) => attempt.status === 'ongoing' && new Date() < new Date(attempt.end_time));
    return ongoingAttempt ? true : false;
  };

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };
  

  const handleAssessmentClick = async (assessment: { id: string; assessment_title: string; time_limit: number; allscore: number; }) => {
    if (!userId) return;
  
    // Set the selected assessment to open the dialog
    setSelectedAssessment({ title: assessment.assessment_title, time_limit: assessment.time_limit, id: assessment.id, allscore: assessment.allscore });
    setOpenDialog(true);
  
    try {
      // Fetch previous attempts for the selected assessment, including end_time and id
      const { data: attemptData, error } = await supabase
        .from('progress_assessment')
        .select('overallscore, assessment_taken, end_time, id, status')  // Include status
        .eq('user_id', userId)
        .eq('assessment_id', assessment.id);

  
      if (error) throw error;
  
      // Set attempt data to state if available
      if (attemptData) {
        setAttemptData(attemptData);
      }
    } catch (err) {
      console.error('Failed to fetch assessment attempts:', err);
    }
  };
  

  const handleProceed = async () => {
    if (!selectedAssessment || !userId || isProceeding) return;
  
    setIsProceeding(true);
  
    let progressAssessmentId;
    let isUniqueId = false;
  
    try {
      while (!isUniqueId) {
        progressAssessmentId = uuidv4();
  
        // Check if the generated ID already exists in the `progress_assessment` table
        const { data: existingId, error: checkError } = await supabase
          .from('progress_assessment')
          .select('id')
          .eq('id', progressAssessmentId)
          .single();
  
        if (checkError && checkError.code !== 'PGRST116') {
          console.error("ID Check Error:", checkError);
          throw checkError;
        }
  
        if (!existingId) {
          isUniqueId = true;
        }
      }
  
      const startTime = new Date().toISOString();
      const endTime = new Date(Date.now() + selectedAssessment.time_limit * 1000).toISOString();
  
      // Insert into the `progress_assessment` table with status set to 'ongoing'
      const { data, error } = await supabase
        .from('progress_assessment')
        .insert([
          {
            id: progressAssessmentId,
            assessment_id: selectedAssessment.id,
            user_id: userId,
            start_time: startTime,
            end_time: endTime,
            status: 'ongoing', // Set status to ongoing
          },
        ]);
  
      if (error) {
        console.error("Insert Error:", error);
        throw error;
      }
  
      console.log("Insert Success:", data);
  
      router.push(`/home/subject/${id}/assessment/${selectedAssessment.id}/${progressAssessmentId}`);
    } catch (err) {
      console.error('Failed to create progress_assessment record:', err);
    } finally {
      setIsProceeding(false);
    }
  };
  
  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <Container maxWidth="lg">
      <Box display="flex" flexDirection="column" alignItems="center" marginTop="1rem" sx={{ position: 'relative' }}>
        {subject ? (
          <Paper
            elevation={3}
            style={{
              padding: isMobile ? '1rem' : '2rem',
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
  
            <Typography variant="h5" style={{ fontSize: isMobile ? '1.25rem' : '1.5rem' }}>
              {subject.sub}
            </Typography>
  
            <Box
              mt={2}
              sx={{
                overflowY: 'auto',
                maxHeight: '70vh',
                padding: '1rem',
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
              }}
            >
              {Object.keys(groupedLessons).map((lessonGroup) => (
                <Accordion key={lessonGroup}>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      backgroundColor: blue[100],
                      padding: '1rem',
                      borderRadius: '4px',
                      '&:hover': {
                        backgroundColor: blue[200],
                      },
                    }}
                  >
                    <Typography variant="h6">Lesson {lessonGroup}</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ padding: '1rem' }}>
                    {['noGroup', 'easy', 'moderate', 'hard'].map((contentGroup) => (
                      groupedLessons[lessonGroup as keyof typeof groupedLessons][contentGroup as keyof typeof groupedLessons[typeof lessonGroup]].length > 0 && (
                        <Paper
                          key={contentGroup}
                          elevation={1}
                          sx={{
                            marginBottom: '1rem',
                            padding: '1rem',
                            backgroundColor:
                              contentGroup === 'noGroup'
                                ? grey[50]
                                : contentGroup === 'easy'
                                ? blue[50]
                                : contentGroup === 'moderate'
                                ? yellow[50]
                                : contentGroup === 'hard'
                                ? red[50]
                                : theme.palette.background.paper,
                          }}
                        >
                          {contentGroup !== 'noGroup' && (
                            <Typography variant="subtitle1" sx={{ marginBottom: '0.5rem' }}>
                              {contentGroup.charAt(0).toUpperCase() + contentGroup.slice(1)}
                            </Typography>
                          )}
                          <Grid container spacing={4} justifyContent="center">
                            {groupedLessons[lessonGroup as keyof typeof groupedLessons][contentGroup as keyof typeof groupedLessons[typeof lessonGroup]].map(
                              (lesson: Lesson) => (
                                <Grid
                                  key={lesson.id}
                                  item
                                  xs={12}
                                  sm={6}
                                  md={4}
                                  lg={3}
                                >
                                  <Card
                                    elevation={3}
                                    sx={{
                                      padding: '1rem',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '1rem', // Space between lesson and assessments
                                      backgroundColor: theme.palette.background.paper,
                                      borderRadius: '12px',
                                      maxWidth: '100%', // Allow the card to adjust to the container
                                      width: 'auto', // Resize based on content width
                                    }}
                                  >
                                    {/* Lesson Button */}
                                    <Button
                                      variant="contained"
                                      sx={{
                                        fontSize: { xs: '0.9rem', sm: '1rem' }, // Responsive font size
                                        textTransform: 'none',
                                        padding: { xs: '0.5rem 1rem', sm: '0.75rem 1.5rem' }, // Responsive padding
                                        borderRadius: '8px',
                                        backgroundColor: lesson.status === 'Open' ? theme.palette.primary.main : theme.palette.grey[400],
                                        color: theme.palette.common.white,
                                        cursor: lesson.status === 'Open' ? 'pointer' : 'not-allowed',
                                        width: '100%', // Full-width for consistent button alignment
                                        '&:hover': {
                                          backgroundColor: lesson.status === 'Open' ? theme.palette.primary.dark : theme.palette.grey[400],
                                        },
                                        '&:active': {
                                          backgroundColor: lesson.status === 'Open' ? theme.palette.primary.light : theme.palette.grey[400],
                                        },
                                      }}
                                      onClick={() => lesson.status === 'Open' && handleLessonClick(lesson.id)}
                                      disabled={lesson.status !== 'Open'}
                                    >
                                      {lesson.lesson_title}
                                    </Button>
                                    <Box
                                      display="flex"
                                      flexWrap="wrap"
                                      justifyContent="center"
                                      alignItems="center"
                                      gap="0.5rem" // Space between assessment buttons
                                    >
                                      {assessments
                                        .filter((assessment) => assessment.lesson_id === lesson.id)
                                        .map((assessment) => (
                                          <Button
                                            key={assessment.id}
                                            variant="outlined"
                                            sx={{
                                              fontSize: { xs: '0.8rem', sm: '0.9rem' }, // Responsive font size
                                              textTransform: 'none',
                                              padding: { xs: '0.5rem', sm: '0.5rem 1rem' }, // Responsive padding
                                              borderRadius: '8px',
                                              borderColor: theme.palette.success.main,
                                              color: userProgress.includes(lesson.id) ? theme.palette.success.main : theme.palette.grey[400],
                                              width: 'auto', // Allow resizing based on text
                                              minWidth: '100px', // Ensure buttons have a minimum size
                                              maxWidth: '100%', // Prevent overflowing
                                              '&:hover': {
                                                borderColor: userProgress.includes(lesson.id)
                                                  ? theme.palette.success.dark
                                                  : theme.palette.grey[400],
                                                backgroundColor: userProgress.includes(lesson.id)
                                                  ? theme.palette.success.light
                                                  : theme.palette.grey[200],
                                              },
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleAssessmentClick(assessment);
                                            }}
                                            disabled={!userProgress.includes(lesson.id)}
                                            startIcon={userProgress.includes(lesson.id) ? <LockOpen /> : <Lock />}
                                          >
                                            {assessment.assessment_title}
                                          </Button>
                                        ))}
                                    </Box>
                                  </Card>
                                </Grid>
                              )
                            )}
                          </Grid>
                        </Paper>
                      )
                    ))}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </Paper>
        ) : (
          <Typography variant="h6" style={{ fontSize: isMobile ? '1rem' : '1.25rem' }}>Subject not found.</Typography>
        )}
      </Box>
  
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>
          {selectedAssessment?.title}<br /><br />
          <Typography variant="body1">You might wanna review before proceeding, are you sure?</Typography>
          <Typography variant="body1">Time Limit: ({formatTime(selectedAssessment?.time_limit || 0)})</Typography>
          <Typography variant="body1">Overall Score: {selectedAssessment?.allscore}</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="h6">Previous Attempts:</Typography>
          {attemptData && attemptData.length > 0 ? (
            <Box mt={2}>
              {attemptData.map((attempt, index) => {
                const assessmentTakenDate = new Date(attempt.assessment_taken);
                const formattedDate = assessmentTakenDate.toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                  second: 'numeric',
                  hour12: true,
                });

                const endTime = new Date(attempt.end_time);
                const hasTimeRemaining = new Date() < endTime;

                return (
                  <Box key={index} mt={1} p={1} border="1px solid #ccc" borderRadius="4px" position="relative">
                    <Box mb={3}>
                      <Typography>Attempt {index + 1}:</Typography>
                      <Typography>Score: {attempt.overallscore}/{selectedAssessment?.allscore}</Typography>
                      <Typography>Taken During: {formattedDate}</Typography>
                    </Box>

                    <Box position="absolute" top="10px" right="10px" display="flex" alignItems="center">
                      {/* Continue Button */}
                      {attempt.status !== 'finished' && hasTimeRemaining && (
                        <IconButton
                        onClick={() =>
                          selectedAssessment && router.push(`/home/subject/${id}/assessment/${selectedAssessment.id}/${attempt.id}`)
                        }
                        color="primary"
                        style={{ marginRight: '10px', borderRadius: '4px' }} // Set borderRadius here
                      >
                        <Typography variant="body2" style={{ marginRight: '5px' }}>
                          You still have time
                        </Typography>
                        <PlayArrowIcon /> {/* Icon for Continue */}
                      </IconButton>
                      )}

                      {/* Delete Button */}
                      <IconButton onClick={() => handleDeleteAttempt(attempt.id)}>
                        <CloseIcon color="error" />
                      </IconButton>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Typography>No attempts yet.</Typography>
          )}
        </DialogContent>

        <DialogActions>
          {/* Check for ongoing attempt */}
          {attemptData && attemptData.some((attempt) => attempt.status !== 'finished') ? (
            <Typography variant="body2" color="error">
              Finish previous attempt to proceed.
            </Typography>
          ) : attemptData && attemptData.length >= 3 ? (
            <Typography variant="body2" color="error">
              3 Attempts reached. Remove other attempts to proceed.
            </Typography>
          ) : (
            <Button
              onClick={handleProceed}
              color="primary"
              autoFocus
              disabled={isProceeding || isOngoingAttempt()}
            >
              {isProceeding ? 'Processing...' : 'Proceed'}
            </Button>
          )}
          <Button onClick={() => setOpenDialog(false)} color="error">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );  
}

