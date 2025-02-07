"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import Checkbox from "@mui/material/Checkbox";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import Slide from "@mui/material/Slide";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { createClient } from "@supabase/supabase-js";

// Initialize the Supabase client using public keys.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Helper function to format seconds to HH:MM:SS
 */
const formatTime = (seconds: number) => {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
};

interface Question {
  id: string;
  qcontent: string;
  qtype: "Single" | "Multiple" | "Input";
  qcorrectanswer: string[];
  qselection: string[];
  qpoints: number;
}

type AnswerValue = string | string[];

const TrialPage = () => {
  const router = useRouter();
  const { subid, trialId, trial_dataId } = useParams();

  // Authentication and trial state
  const [userId, setUserId] = useState<string | null>(null);
  const [trialData, setTrialData] = useState<any>(null);
  const [trialInfo, setTrialInfo] = useState<any>(null);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Questions and answers state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, AnswerValue>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hasFinished, setHasFinished] = useState<boolean>(false);

  // Dialog state and star criteria
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [finalScore, setFinalScore] = useState<number>(0);
  const [allScore, setAllScore] = useState<number>(0);
  const [allocatedTime, setAllocatedTime] = useState<number>(0);
  const [attemptMessage, setAttemptMessage] = useState<string>("");

  // Ref for countdown timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Slide animation direction ("left" for next, "right" for prev)
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Authenticate
        const resAuth = await fetch("/api/check-auth");
        if (resAuth.status !== 200) {
          router.push("/login");
          return;
        }
        const userData = await resAuth.json();
        setUserId(userData.id);

        // Get trial_data
        const { data: trialDataRes, error: trialDataError } = await supabase
          .from("trial_data")
          .select("id, user_id, start_time, end_time, status")
          .eq("id", trial_dataId)
          .eq("user_id", userData.id)
          .single();
        if (trialDataError || !trialDataRes) {
          setError("Trial data not found.");
          setLoading(false);
          return;
        }
        setTrialData(trialDataRes);
        if (trialDataRes.status === "Finished") {
          router.push("/home");
          return;
        }

        // Get trial info
        const { data: trialInfoRes, error: trialInfoError } = await supabase
          .from("trials")
          .select("id, trial_title, time, allscore")
          .eq("id", trialId)
          .single();
        if (trialInfoError || !trialInfoRes) {
          setError("Trial information not found.");
          setLoading(false);
          return;
        }
        setTrialInfo(trialInfoRes);
        setAllocatedTime(trialInfoRes.time);
        setAllScore(trialInfoRes.allscore);

        // Calculate initial remaining time (adjusted to UTC+8)
        const startTime = new Date(trialDataRes.start_time);
        const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
        const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        const remaining = trialInfoRes.time - elapsedSeconds;
        setRemainingTime(remaining > 0 ? remaining : 0);

        // Get questions and shuffle them only once.
        const { data: questionsRes, error: questionsError } = await supabase
          .from("questions")
          .select("id, qcontent, qtype, qcorrectanswer, qselection, qpoints")
          .eq("trial_id", trialId);
        if (questionsError || !questionsRes || questionsRes.length === 0) {
          setError("No questions found for this trial.");
          setLoading(false);
          return;
        }
        // Shuffle once and store the result.
        const shuffledQuestions = [...questionsRes].sort(() => Math.random() - 0.5);
        setQuestions(shuffledQuestions);
        setLoading(false);
      } catch (err) {
        setError("An error occurred while fetching data.");
        setLoading(false);
      }
    };

    fetchData();
  }, [router, trial_dataId, trialId]);

  useEffect(() => {
    if (!trialData || !trialInfo) return;

    timerRef.current = setInterval(() => {
      const startTime = new Date(trialData.start_time);
      const now = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
      const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      const remaining = trialInfo.time - elapsedSeconds;
      if (remaining <= 0) {
        setRemainingTime(0);
        (async () => {
          await supabase
            .from("trial_data")
            .update({ status: "Finished", time_concluded: 0 })
            .eq("id", trial_dataId);
        })();
        finishSubmission(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        setRemainingTime(remaining);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [trialData, trialInfo, trial_dataId]);

  const handleAnswerChange = (question: Question, value: AnswerValue) => {
    setUserAnswers((prev) => ({
      ...prev,
      [question.id]: value,
    }));
  };

  const handlePrev = () => {
    if (isSubmitting) return;
    setSlideDirection("right");
    setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = () => {
    if (isSubmitting) return;
    setSlideDirection("left");
    setCurrentQuestionIndex((prev) => Math.min(prev + 1, questions.length - 1));
  };

  const finishSubmission = async (overrideRemaining?: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (hasFinished) return;
    setHasFinished(true);
    setIsSubmitting(true);

    let totalPoints = 0;
    // Loop through each question, calculate points, and insert a q_data record.
    for (const question of questions) {
      const userAnswer = userAnswers[question.id];
      let awardedPoint = 0;
      if (question.qtype === "Single") {
        if (typeof userAnswer === "string" && question.qcorrectanswer[0] === userAnswer) {
          awardedPoint = question.qpoints;
        }
      } else if (question.qtype === "Multiple") {
        if (Array.isArray(userAnswer)) {
          const correctCount = userAnswer.filter((ans) =>
            question.qcorrectanswer.includes(ans)
          ).length;
          awardedPoint = correctCount;
        }
      } else if (question.qtype === "Input") {
        if (
          typeof userAnswer === "string" &&
          question.qcorrectanswer.some(
            (corr) => corr.trim().toLowerCase() === userAnswer.trim().toLowerCase()
          )
        ) {
          awardedPoint = question.qpoints;
        }
      }
      totalPoints += awardedPoint;
      await supabase.from("q_data").insert([
        {
          q_id: question.id,
          t_dataid: trial_dataId,
          uanswer: userAnswer,
          upoints: awardedPoint,
        },
      ]);
    }

    const finalRemaining = overrideRemaining !== undefined ? overrideRemaining : remainingTime;

    // Compute stars.
    const star1 = true;
    const star2 = star1 && (allScore > 0 ? totalPoints / allScore >= 0.7 : false);
    const star3 = star2 && (allocatedTime > 0 ? remainingTime / allocatedTime >= 0.35 : false);
    const starCount = 1 + (star2 ? 1 : 0) + (star3 ? 1 : 0);

    // Calculate new evaluation score.
    const rawEval = (((totalPoints / allScore) + (remainingTime / allocatedTime)) / 2) * 100;
    const newEval = Number(rawEval.toFixed(1));

    // Update current trial_data record.
    await supabase
      .from("trial_data")
      .update({
        score: totalPoints,
        status: "Finished",
        time_concluded: finalRemaining,
        star: starCount,
        eval_score: newEval.toString()
      })
      .eq("id", trial_dataId);

    let localAttemptMessage = "";

    // Fetch all attempts for the current trial and user.
    const { data: allAttempts } = await supabase
      .from("trial_data")
      .select("id, eval_score")
      .eq("trial_id", trialId)
      .eq("user_id", userId);

    if (allAttempts && allAttempts.length >= 2) {
      // Convert each eval_score from text to a number.
      const attempts = allAttempts.map((att) => ({
        id: att.id,
        eval: parseFloat(att.eval_score) || 0,
      }));
      // Determine the maximum evaluation score.
      const maxEval = Math.max(...attempts.map((a) => a.eval));
      // Identify attempts with an evaluation score lower than the maximum.
      const lowerAttempts = attempts.filter((a) => a.eval < maxEval);
      // Delete all attempts that have a lower score.
      for (const lowerAttempt of lowerAttempts) {
        // First, delete associated q_data records using the low eval trial_data id.
        await supabase.from("q_data").delete().eq("t_dataid", lowerAttempt.id);
        // Then, delete the trial_data record.
        await supabase.from("trial_data").delete().eq("id", lowerAttempt.id);
      }
      // If the current attempt was among the ones deleted, then it did not beat the best.
      if (lowerAttempts.some((a) => a.id === trial_dataId)) {
        localAttemptMessage = "Try again next time";
      } else {
        localAttemptMessage = "You beat your previous attempt";
      }
    } else {
      localAttemptMessage = "Good job completing the trial";
    }

    setFinalScore(totalPoints);
    setAttemptMessage(localAttemptMessage);
    setOpenDialog(true);
    setIsSubmitting(false);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    router.push("/home");
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: "center", mt: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  // For dialog display: recompute stars.
  const star1Display = true;
  const star2Display = star1Display && (allScore > 0 ? finalScore / allScore >= 0.7 : false);
  const star3Display = star2Display && (allocatedTime > 0 ? remainingTime / allocatedTime >= 0.35 : false);

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <Container maxWidth="md" sx={{ mt: 4, p: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 3, textAlign: "center" }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: "bold" }}>
          {trialInfo?.trial_title || "Trial"}
        </Typography>
        <Typography variant="h6" sx={{ mt: 1, color: "primary.main" }}>
          Remaining Time: {formatTime(remainingTime)}
        </Typography>
      </Box>

      <Box sx={{ mb: 4 }}>
        {currentQuestion && (
          <Slide in={true} direction={slideDirection} timeout={300} mountOnEnter unmountOnExit key={currentQuestion.id}>
            <Paper elevation={3} sx={{ p: { xs: 2, md: 3 } }}>
              {/* Numbered question header */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: "medium" }}>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="body1"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.qcontent }}
                  sx={{ fontSize: { xs: "1rem", md: "1.25rem" } }}
                />
              </Box>
              {currentQuestion.qtype === "Single" && (
                <FormControl component="fieldset" fullWidth>
                  <RadioGroup
                    value={userAnswers[currentQuestion.id] || ""}
                    onChange={(e) => handleAnswerChange(currentQuestion, e.target.value)}
                  >
                    {currentQuestion.qselection.map((option, index) => (
                      <FormControlLabel
                        key={option}
                        value={option}
                        control={<Radio />}
                        label={`${index + 1}. ${option}`}
                        sx={{ fontSize: { xs: "0.9rem", md: "1rem" } }}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              )}
              {currentQuestion.qtype === "Multiple" && (
                <FormControl component="fieldset" fullWidth>
                  {currentQuestion.qselection.map((option, index) => {
                    const selected: string[] = Array.isArray(userAnswers[currentQuestion.id])
                      ? (userAnswers[currentQuestion.id] as string[])
                      : [];
                    const maxSelections = currentQuestion.qcorrectanswer.length;
                    const disableCheckbox = !selected.includes(option) && selected.length >= maxSelections;
                    return (
                      <FormControlLabel
                        key={option}
                        control={
                          <Checkbox
                            checked={selected.includes(option)}
                            onChange={(e) => {
                              let newSelections: string[] = [...selected];
                              if (e.target.checked) {
                                if (newSelections.length < maxSelections) {
                                  newSelections.push(option);
                                }
                              } else {
                                newSelections = newSelections.filter((sel) => sel !== option);
                              }
                              handleAnswerChange(currentQuestion, newSelections);
                            }}
                            disabled={disableCheckbox}
                          />
                        }
                        label={`${index + 1}. ${option}`}
                        sx={{ fontSize: { xs: "0.9rem", md: "1rem" } }}
                      />
                    );
                  })}
                </FormControl>
              )}
              {currentQuestion.qtype === "Input" && (
                <TextField
                  fullWidth
                  label="Your Answer"
                  value={userAnswers[currentQuestion.id] || ""}
                  onChange={(e) => handleAnswerChange(currentQuestion, e.target.value)}
                  sx={{ my: 2 }}
                />
              )}
            </Paper>
          </Slide>
        )}
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6}>
          <Button
            variant="contained"
            fullWidth
            onClick={handlePrev}
            disabled={isSubmitting || currentQuestionIndex === 0}
          >
            Prev
          </Button>
        </Grid>
        <Grid item xs={6}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleNext}
            disabled={isSubmitting || currentQuestionIndex === questions.length - 1}
          >
            Next
          </Button>
        </Grid>
      </Grid>

      <Box sx={{ textAlign: "center", mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => finishSubmission()}
          disabled={isSubmitting}
          sx={{ px: 4, py: 1.5, fontSize: "1rem" }}
        >
          Finish
        </Button>
      </Box>

      <Dialog open={openDialog} onClose={handleDialogClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ textAlign: "center", fontWeight: "bold" }}>
          Trial Done!
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: "center", mb: 2 }}>
            <Typography variant="h6">{trialInfo?.trial_title}</Typography>
            <Typography variant="subtitle1">
              Score: {finalScore} / {allScore}
            </Typography>
            <Typography variant="subtitle1">
              Remaining Time: {formatTime(remainingTime)} ({remainingTime} seconds)
            </Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1 }}>
            {star1Display ? <StarIcon color="warning" fontSize="large" /> : <StarBorderIcon fontSize="large" />}
            {star2Display ? <StarIcon color="warning" fontSize="large" /> : <StarBorderIcon fontSize="large" />}
            {star3Display ? <StarIcon color="warning" fontSize="large" /> : <StarBorderIcon fontSize="large" />}
          </Box>
          {attemptMessage && (
            <Box sx={{ mt: 2, textAlign: "center" }}>
              <Typography variant="body1" color="secondary">
                {attemptMessage}
              </Typography>
            </Box>
          )}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">
              * First Star: Awarded for completing the trial.
            </Typography>
            <Typography variant="body2">
              * Second Star: Awarded if your score is at least 70% of the total score and you have earned the first star.
            </Typography>
            <Typography variant="body2">
              * Third Star: Awarded if you finish with at least 35% of the time remaining and you have earned the second star.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center" }}>
          <Button onClick={handleDialogClose} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TrialPage;
