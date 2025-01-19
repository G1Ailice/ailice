'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Container, Typography, Box, Button, TextField, RadioGroup, Radio, FormControlLabel, Checkbox, FormGroup , Paper} from '@mui/material';
import Loading from '../../../../../../loading';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Assessment {
  id: string;
  assessment_title: string;
  lesson_id: string;
  time_limit: number;
  questions: Question[];
}

interface Question {
  id: string;
  qcontent: string;
  qselection: string[];
  qtype: 'selection' | 'word' | 'multiple_selection';
  qcorrectanswer: string | string[];
  qpoints: number;
  files: string ;
}

export default function AssessmentPage() {
  const [resultMessage, setResultMessage] = useState<JSX.Element | null>(null);
  const { id, assessmentId, progress_assessmentId } = useParams();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<{ [key: string]: string | string[] }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);  // Track current question index
  const router = useRouter();
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  

  useEffect(() => {
    const loadAnswersFromSupabase = async () => {
      if (!progress_assessmentId) {
        console.error('Progress Assessment ID is missing!');
        return;
      }
  
      const { data, error } = await supabase
        .from('progress_questions')
        .select('questions_id, inputted_answer')
        .eq('progress_assessmentid', progress_assessmentId);
  
      if (error) {
        console.error('Error loading answers:', error);
        return;
      }
  
      if (!data || data.length === 0) {
        return;
      }
  
      const loadedAnswers = data.reduce((acc: { [key: string]: string | string[] }, curr: any) => {
        const question = assessment?.questions.find(q => q.id === curr.questions_id);
  
        // Ensure multiple selection answers are stored as arrays
        if (question?.qtype === 'multiple_selection') {
          acc[curr.questions_id] = Array.isArray(curr.inputted_answer) ? curr.inputted_answer : JSON.parse(curr.inputted_answer);
        } else {
          acc[curr.questions_id] = curr.inputted_answer;
        }
        return acc;
      }, {});
  
      setAnswers(loadedAnswers);
    };
  
    loadAnswersFromSupabase();
  }, [progress_assessmentId, assessment]);


  useEffect(() => {
    const checkProgressAssessment = async () => {
      if (!progress_assessmentId) {
        router.push('/home');
        return;
      }
  
      const { data, error } = await supabase
        .from('progress_assessment')
        .select('overallscore, status, assessment_id, assessment_taken, user_id, start_time, end_time')
        .eq('id', progress_assessmentId)
        .single();
  
      if (error || !data) {
        router.push('/home');
        return;
      }
  
      // Fetch user data from the check-auth API
      const userResponse = await fetch('/api/check-auth');
      const userData = await userResponse.json();
  
      if (userResponse.status === 401 || userData.message === 'Not authenticated') {
        console.error('User not authenticated');
        setIsLoadingProgress(false);
        return;
      }
  
      // Check if the user_id in progress_assessment matches the fetched user_id
      if (data?.user_id !== userData.id) {
        // Redirect to /home if user_id does not match
        router.push('/home');
        return;
      }
  
      if (data?.status === 'finished') {
        const { data: assessmentData, error: assessmentError } = await supabase
          .from('assessments')
          .select('assessment_title, allscore')
          .eq('id', data.assessment_id)
          .single();
  
        if (assessmentError) {
          console.error('Error fetching assessment data:', assessmentError);
        } else {
          const scorePercentage = (data.overallscore / assessmentData.allscore) * 100;
          const resultMessage = scorePercentage >= 70
            ? 'Good Job! You did great!'
            : 'Try again next time. Review your materials before you take an assessment.';
  
          setResultMessage(
            <Box sx={{ border: '1px solid #ccc', borderRadius: '8px', backgroundColor: 'grey.200', padding: 2 }}>
              <Typography variant="h5">{assessmentData.assessment_title}</Typography>
              <Typography variant="body1">Progress Assessment ID: {progress_assessmentId}</Typography>
              <Typography variant="body1">
                Score: {data.overallscore}/{assessmentData.allscore}
              </Typography>
              <Typography variant="body1">Taken during: {new Date(data.assessment_taken).toLocaleString()}</Typography>
              <Typography variant="body1">{resultMessage}</Typography>
            </Box>
          );
        }
      }
      
      const now = new Date().getTime();
      const endTime = new Date(data.end_time).getTime();
      const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000)); // Convert to seconds
  
      setTimeRemaining(timeRemaining);
  
      setIsLoadingProgress(false);
    };
  
    checkProgressAssessment();
  }, [progress_assessmentId]);
  
  
  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        const { data, error } = await supabase
          .from('assessments')
          .select('*, questions (*)')
          .eq('id', assessmentId)
          .single();

        if (error) throw error;
        setAssessment(data as Assessment);
      } catch (err) {
        console.error('Failed to fetch assessment:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (assessmentId) {
      fetchAssessment();
    }
  }, [assessmentId]);

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timer);
            setIsExpired(true);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
  
      return () => clearInterval(timer); // Clear interval on unmount
    }
  }, [timeRemaining]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const saveAnswerToSupabase = async (questionId: string, answer: string | string[]) => {
    if (!progress_assessmentId) {
      console.error('Progress Assessment ID is missing!');
      return;
    }
  
    if (!questionId) {
      console.error('Question ID is missing!');
      return;
    }
  
    if (!answer) {
      return;
    }
  
    const question = assessment?.questions.find(q => q.id === questionId);
    const qpoints = question?.qpoints || 0;
  
    const { data, error } = await supabase
      .from('progress_questions')
      .select('id')
      .eq('questions_id', questionId)
      .eq('progress_assessmentid', progress_assessmentId)
      .single();
  
    if (error && error.code !== 'PGRST116') {  // Handle any other errors
      console.error('Error checking if answer exists:', error);
      return;
    }
  
    if (!data) {
      // Insert new answer
      const { error: insertError } = await supabase.from('progress_questions').insert({
        questions_id: questionId,
        progress_assessmentid: progress_assessmentId,
        inputted_answer: answer,
        qpoints: qpoints,
      });
  
      if (insertError) {
        console.error('Error inserting answer:', insertError);
      }
    } else {
      // Update existing answer
      const { error: updateError } = await supabase
        .from('progress_questions')
        .update({ inputted_answer: answer, qpoints: qpoints })
        .eq('questions_id', questionId)
        .eq('progress_assessmentid', progress_assessmentId);
  
      if (updateError) {
        console.error('Error updating answer:', updateError);
      }
    }
  };

  const handleAnswerChange = (questionId: string, answer: string | string[]) => {
    // Only update the answers state, don't call saveAnswerToSupabase yet
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };


  const handleMultipleSelectionChange = async (questionId: string, option: string) => {
    setAnswers(prev => {
      const question = assessment?.questions.find(q => q.id === questionId);
      const allowedLimit = Array.isArray(question?.qcorrectanswer) ? question.qcorrectanswer.length : 1;
      const existingAnswers = Array.isArray(prev[questionId]) ? prev[questionId] : [];
  
      const updatedAnswers = existingAnswers.includes(option)
        ? existingAnswers.filter(ans => ans !== option) // Deselect if already selected
        : existingAnswers.length < allowedLimit
        ? [...existingAnswers, option] // Add answer if under the limit
        : existingAnswers;
  
      return { ...prev, [questionId]: updatedAnswers };
    });
  };

  const handleNext = async () => {
    if (isActionInProgress) return;
    setIsActionInProgress(true);
  
    if (assessment) {
      const currentQuestion = assessment.questions[currentQuestionIndex];
      const currentAnswer = answers[currentQuestion.id];
  
      await saveAnswerToSupabase(currentQuestion.id, currentAnswer);
    }
  
    if (currentQuestionIndex < (assessment?.questions.length ?? 0) - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  
    setIsActionInProgress(false);
  };
  
  const handlePrevious = async () => {
    if (isActionInProgress) return;
    setIsActionInProgress(true);
  
    if (assessment) {
      const currentQuestion = assessment.questions[currentQuestionIndex];
      const currentAnswer = answers[currentQuestion.id];
  
      await saveAnswerToSupabase(currentQuestion.id, currentAnswer);
    }
  
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  
    setIsActionInProgress(false);
  };
  
  const handleFinish = async () => {
    if (isActionInProgress) return;
    setIsActionInProgress(true);
  
    if (!assessment) {
      setIsActionInProgress(false);
      return;
    }
  
    let score = 0;
  
    for (const question of assessment.questions) {
      const userAnswer = answers[question.id];
      let questionScore = 0;
  
      await saveAnswerToSupabase(question.id, userAnswer);
  
      if (question.qtype === "multiple_selection" && Array.isArray(question.qcorrectanswer)) {
        const correctAnswers = question.qcorrectanswer;
        const userAnswers = Array.isArray(userAnswer) ? userAnswer : [];
        const matchingAnswers = userAnswers.filter((ans) => correctAnswers.includes(ans));
        questionScore = (matchingAnswers.length / correctAnswers.length) * question.qpoints;
      } else if (Array.isArray(question.qcorrectanswer)) {
        const correctAnswers = question.qcorrectanswer;
        const matchingAnswer = correctAnswers.includes(userAnswer as string);
        questionScore = matchingAnswer ? question.qpoints : 0;
      } else {
        questionScore = question.qcorrectanswer === userAnswer ? question.qpoints : 0;
      }
  
      score += questionScore;
  
      await supabase
        .from("progress_questions")
        .update({
          inputted_answer: userAnswer,
          qpoints: questionScore,
        })
        .eq("questions_id", question.id)
        .eq("progress_assessmentid", progress_assessmentId);
    }
  
    await supabase
      .from("progress_assessment")
      .update({ overallscore: score, status: "finished" })
      .eq("id", progress_assessmentId);
  
    window.location.reload(); // Reload the page instead of using router.push
  
    setIsActionInProgress(false);
  };

  if (isLoading || isLoadingProgress) {
    return <Loading />; 
  }

  if (!assessment) {
    return (
      <Container>
        <Typography variant="h5">Assessment not found</Typography>
      </Container>
    );
  }

  if (isExpired) {
    useEffect(() => {
      const timer = setTimeout(() => {
        window.location.reload(); // Reload the page after 5 seconds
      }, 5000);
  
      return () => clearTimeout(timer); // Clear the timeout if the component is unmounted before 5 seconds
    }, []); // Empty dependency array ensures this effect runs once when `isExpired` is true
  
    return (
      <Container>
        <Typography variant="h5" color="error">Time's up! You can no longer take this assessment.</Typography>
        <Typography variant="body1" color="textSecondary">The page will refresh shortly...</Typography>
        <Button onClick={() => router.back()} variant="contained" color="primary" style={{ marginTop: '1rem' }}>
          Back to Subject
        </Button>
      </Container>
    );
  }

  const currentQuestion = assessment.questions[currentQuestionIndex];

  return (
    <Container>
    {resultMessage ? (
      <Box mt={4}>
        {resultMessage}
      </Box>
    ) : (
      <Box mt={4}>
        <Typography variant="h4">{assessment.assessment_title}</Typography>

        {/* Wrap Time Remaining and Mute button in a Box with flex layout */}
        <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" color="primary">
            Time Remaining: {formatTime(timeRemaining)}
          </Typography>

          {/* Mute button moved to the right */}
        </Box>

        <Box mt={3}>
          {/* Wrap the question and selections in a Paper component */}
          <Paper elevation={3} style={{ padding: '1rem' }}>
            {/* Question Content with HTML and CSS support */}
            <Typography
              variant="body1"
              dangerouslySetInnerHTML={{ __html: `${currentQuestionIndex + 1}. ${currentQuestion.qcontent}` }}
            />

            {/* Display associated image or video if the 'files' attribute exists */}
            {currentQuestion.files && (
              <Box mt={2} display="flex" justifyContent="center">
                {currentQuestion.files.endsWith('.mp4') || currentQuestion.files.endsWith('.webm') ? (
                  <video controls style={{ maxWidth: '100%', maxHeight: '400px' }}>
                    <source src={currentQuestion.files} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <img
                    src={currentQuestion.files}
                    alt="Associated visual content"
                    style={{ maxWidth: '100%', maxHeight: '200px' }}
                  />
                )}
              </Box>
            )}

            {/* Question Type Logic */}
            {currentQuestion.qtype === 'selection' ? (
              <RadioGroup
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              >
                {currentQuestion.qselection.map((option, i) => (
                  <FormControlLabel key={i} value={option} control={<Radio />} label={option} />
                ))}
              </RadioGroup>
            ) : currentQuestion.qtype === 'multiple_selection' ? (
              <FormGroup>
                {currentQuestion.qselection.map((option, i) => (
                  <FormControlLabel
                    key={i}
                    control={
                      <Checkbox
                        checked={Array.isArray(answers[currentQuestion.id]) && answers[currentQuestion.id].includes(option)}
                        onChange={() => handleMultipleSelectionChange(currentQuestion.id, option)}
                      />
                    }
                    label={option}
                  />
                ))}
              </FormGroup>
            ) : (
              <TextField
                variant="outlined"
                fullWidth
                placeholder="Type your answer here"
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              />
            )}
          </Paper>
        </Box>

        <Box mt={2}>
          <Button onClick={handlePrevious} variant="contained" color="secondary" disabled={currentQuestionIndex === 0}>
            Previous
          </Button>
          <Button onClick={handleNext} variant="contained" color="primary" style={{ marginLeft: '1rem' }} disabled={currentQuestionIndex === assessment.questions.length - 1}>
            Next
          </Button>
        </Box>

        <Button onClick={handleFinish} variant="contained" color="primary" style={{ marginTop: '1rem' }}>
          Finish Assessment
        </Button>
      </Box>
    )}
  </Container>
  );
}
