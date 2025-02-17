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
import HelpTwoToneIcon from "@mui/icons-material/HelpTwoTone";
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

/**
 * Helper function to get current Philippine (Manila) time as an ISO string.
 */
const getManilaTimeISO = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const manila = new Date(utc + 8 * 60 * 60000);
  return manila.toISOString();
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

/**
 * Memoized component for question content.
 * This prevents re-rendering the embed (e.g., video) if the question content hasn't changed.
 */
const MemoizedQuestionContent = React.memo(({ qcontent }: { qcontent: string }) => {
  return (
    <Typography
      variant="body1"
      dangerouslySetInnerHTML={{ __html: qcontent }}
      sx={{ fontSize: { xs: "0.9rem", md: "1.25rem" }, lineHeight: 1.6 }}
    />
  );
});

const TrialPage = () => {
  const router = useRouter();
  const { subid, trialId, trial_dataId } = useParams();
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

  // New state for gained EXP info
  const [gainedExp, setGainedExp] = useState<number>(0);
  const [tabSwitched, setTabSwitched] = useState<boolean>(false);

  // Keep a ref of the finish state for tab-blur handling.
  const isFinishedRef = useRef(false);
  useEffect(() => {
    isFinishedRef.current = hasFinished;
  }, [hasFinished]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log("Visibility changed:", document.visibilityState);
      if (document.visibilityState === "hidden" && !isFinishedRef.current) {
        setTabSwitched(true);
      }
    };

    const handleBlur = () => {
      console.log("Window blurred");
      if (!isFinishedRef.current) {
        setTabSwitched(true);
      }
    };

    const handleFocus = () => {
      console.log("Window focused");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const [hiddenAchvAchieved, setHiddenAchvAchieved] = useState<boolean>(false);
  const [hiddenAchvDetails, setHiddenAchvDetails] = useState<{
    name: string;
    description: string;
    image: string;
  } | null>(null);

  // Ref for countdown timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Slide animation direction ("left" for next, "right" for prev)
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("left");

  // Keys for localStorage
  const questionOrderKey = `trialOrder_${trialId}`;
  const userAnswersKey = `userAnswers_${trial_dataId}`;
  const currentIndexKey = `currentQuestionIndex_${trial_dataId}`;

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

        // Get trial info (including hd_condition and hd_achv_id)
        const { data: trialInfoRes, error: trialInfoError } = await supabase
          .from("trials")
          .select(
            "id, trial_title, time, allscore, exp_gain, first_exp, hd_condition, hd_achv_id"
          )
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

        // Get questions and determine order.
        const { data: questionsRes, error: questionsError } = await supabase
          .from("questions")
          .select("id, qcontent, qtype, qcorrectanswer, qselection, qpoints")
          .eq("trial_id", trialId);
        if (questionsError || !questionsRes || questionsRes.length === 0) {
          setError("No questions found for this trial.");
          setLoading(false);
          return;
        }

        // Check if a question order is saved in localStorage.
        const savedOrder = localStorage.getItem(questionOrderKey);
        let finalQuestions: Question[];
        if (savedOrder) {
          finalQuestions = JSON.parse(savedOrder);
        } else {
          finalQuestions = [...questionsRes].sort(() => Math.random() - 0.5);
          localStorage.setItem(questionOrderKey, JSON.stringify(finalQuestions));
        }
        setQuestions(finalQuestions);
        setLoading(false);
      } catch (err) {
        setError("An error occurred while fetching data.");
        setLoading(false);
      }
    };

    fetchData();
  }, [router, trial_dataId, trialId, questionOrderKey]);

  // Restore user's answers and current question index from localStorage.
  useEffect(() => {
    const savedAnswers = localStorage.getItem(userAnswersKey);
    if (savedAnswers) {
      setUserAnswers(JSON.parse(savedAnswers));
    }
    const savedIndex = localStorage.getItem(currentIndexKey);
    if (savedIndex !== null) {
      setCurrentQuestionIndex(Number(savedIndex));
    }
  }, [userAnswersKey, currentIndexKey]);

  // Save user's answers to localStorage when they change.
  useEffect(() => {
    localStorage.setItem(userAnswersKey, JSON.stringify(userAnswers));
  }, [userAnswers, userAnswersKey]);

  // Save current question index to localStorage when it changes.
  useEffect(() => {
    localStorage.setItem(currentIndexKey, currentQuestionIndex.toString());
  }, [currentQuestionIndex, currentIndexKey]);

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
  
    const storedAnswers = JSON.parse(localStorage.getItem(userAnswersKey) || "{}");
  
    // Ensure that remainingTime is never undefined by defaulting to 0.
    const finalRemainingValue =
      overrideRemaining !== undefined ? overrideRemaining : (remainingTime || 0);
    setRemainingTime(finalRemainingValue);
  
    let totalPoints = 0;
    for (const question of questions) {
      const userAnswer = storedAnswers[question.id];
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
  
    if (tabSwitched) {
      totalPoints = Math.floor(totalPoints * 0.8);
    }
  
    const star1 = true;
    const star2 = star1 && (allScore > 0 ? totalPoints / allScore >= 0.7 : false);
    const star3 =
      star2 && (allocatedTime > 0 ? finalRemainingValue / allocatedTime >= 0.35 : false);
    const starCount = 1 + (star2 ? 1 : 0) + (star3 ? 1 : 0);
  
    const rawEval =
      (((totalPoints / allScore) * 0.6) + ((finalRemainingValue / allocatedTime) * 0.4)) * 100;
    const newEval = Number(rawEval.toFixed(1));
  
    await supabase
      .from("trial_data")
      .update({
        score: totalPoints,
        status: "Finished",
        time_concluded: finalRemainingValue,
        star: starCount,
        eval_score: newEval.toString(),
      })
      .eq("id", trial_dataId);
  
    const expGain = trialInfo.exp_gain ? Number(trialInfo.exp_gain) : 0;
    const gainedExpStars = (starCount / 3) * expGain;
  
    const { count: attemptCount } = await supabase
      .from("trial_data")
      .select("id", { count: "exact", head: true })
      .eq("trial_id", trialId)
      .eq("user_id", userId);
  
    const bonusExp =
      attemptCount === 1 && trialInfo.first_exp ? Number(trialInfo.first_exp) : 0;
    const totalExpGained = gainedExpStars + bonusExp;
  
    const { data: userRecord } = await supabase
      .from("users")
      .select("exp")
      .eq("id", userId)
      .single();
    const currentExp = userRecord && userRecord.exp ? Number(userRecord.exp) : 0;
    const newExp = currentExp + totalExpGained;
    await supabase.from("users").update({ exp: newExp }).eq("id", userId);
  
    setGainedExp(totalExpGained);
  
    let localAttemptMessage = "";
    const { data: allAttempts } = await supabase
      .from("trial_data")
      .select("id, eval_score")
      .eq("trial_id", trialId)
      .eq("user_id", userId);
  
    if (allAttempts && allAttempts.length >= 2) {
      const attempts = allAttempts.map((att) => ({
        id: att.id,
        eval: parseFloat(att.eval_score) || 0,
      }));
      const maxEval = Math.max(...attempts.map((a) => a.eval));
      const bestAttempts = attempts.filter((a) => a.eval === maxEval);
      let attemptsToDelete: { id: string; eval: number }[] = [];
      if (bestAttempts.length > 1) {
        attemptsToDelete = bestAttempts.slice(1);
      }
      const lowerAttempts = attempts.filter((a) => a.eval < maxEval);
      attemptsToDelete = attemptsToDelete.concat(lowerAttempts);
  
      for (const att of attemptsToDelete) {
        await supabase.from("q_data").delete().eq("t_dataid", att.id);
        await supabase.from("trial_data").delete().eq("id", att.id);
      }
      localAttemptMessage = attemptsToDelete.some((a) => a.id === trial_dataId)
        ? "Try again next time"
        : "You beat your previous attempt";
    } else {
      localAttemptMessage = "Good job completing the trial";
    }
  
    setFinalScore(totalPoints);
    setAttemptMessage(localAttemptMessage);
  
    // --- Hidden Achievement Condition Fix ---
    if (trialInfo.hd_achv_id) {
      const { data: existingAcv } = await supabase
        .from("user_acv")
        .select("id")
        .eq("user_id", userId)
        .eq("achv_id", trialInfo.hd_achv_id)
        .maybeSingle();
      if (existingAcv) {
        const { data: achvData, error: achvError } = await supabase
          .from("achievements")
          .select("name, description, image")
          .eq("id", trialInfo.hd_achv_id)
          .single();
        if (achvError || !achvData) {
          console.error("Error fetching achievement details:", achvError);
        } else {
          setHiddenAchvAchieved(true);
          setHiddenAchvDetails(achvData);
        }
      } else if (trialInfo.hd_condition) {
        let hiddenAchieved = false;
        try {
          const score = totalPoints;
          // Use remainingTime (or 0 if falsy) to ensure proper evaluation.
          const effectiveTimeRemaining = finalRemainingValue || 0;
          const timeAllocated = allocatedTime;
          const allScoreVal = trialInfo.allscore;
          const { count: attemptCount } = await supabase
            .from("trial_data")
            .select("id", { count: "exact", head: true })
            .eq("trial_id", trialId)
            .eq("user_id", userId);
          // Ensure your hd_condition string in the database accounts for the possibility of timeRemaining being 0.
          // For example, your condition could be:
          // "(!timeRemaining || timeRemaining === 0) && score === 0"
          hiddenAchieved = Function(
            "score",
            "timeRemaining",
            "timeAllocated",
            "allScoreVal",
            "attemptCount",
            "return " + trialInfo.hd_condition
          )(score, effectiveTimeRemaining, timeAllocated, allScoreVal, attemptCount);
        } catch (e) {
          console.error("Error evaluating hidden achievement condition:", e);
        }
        if (hiddenAchieved) {
          const philippineTime = getManilaTimeISO();
          const { error: insertError } = await supabase
            .from("user_acv")
            .insert([{ user_id: userId, achv_id: trialInfo.hd_achv_id, time_date: philippineTime }]);
          if (insertError) {
            console.error("Error inserting user achievement:", insertError);
          }
          const { data: achvData, error: achvError } = await supabase
            .from("achievements")
            .select("name, description, image")
            .eq("id", trialInfo.hd_achv_id)
            .single();
          if (achvError || !achvData) {
            console.error("Error fetching achievement details:", achvError);
          } else {
            setHiddenAchvAchieved(true);
            setHiddenAchvDetails(achvData);
          }
        } else {
          setHiddenAchvAchieved(false);
          setHiddenAchvDetails(null);
        }
      }
    }
    // --- End of Hidden Achievement Fix ---
  
    localStorage.removeItem(questionOrderKey);
    localStorage.removeItem(userAnswersKey);
    localStorage.removeItem(currentIndexKey);
  
    await new Promise((resolve) => setTimeout(resolve, 1500));
  
    setOpenDialog(true);
    setIsSubmitting(false);
  
    triggerAction();
  };  

  const triggerAction = () => {
    const event = new Event("childAction");
    document.dispatchEvent(event);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    router.back();
  };

  if (loading) {
    return (
      <Container
        maxWidth="sm"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '80vh'
        }}
      >
        <CircularProgress />
      </Container>
    );
  }
  

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ mt: { xs: 2, md: 4 } }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const star1Display = true;
  const star2Display = star1Display && (allScore > 0 ? finalScore / allScore >= 0.7 : false);
  const star3Display = star2Display && (allocatedTime > 0 ? remainingTime / allocatedTime >= 0.35 : false);

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <Container maxWidth="md" sx={{ mt: { xs: 1, md: 2 }, p: { xs: 0.8, md: 1 }, overflowX: "hidden" }}>
      {/* Header Section */}
      <Box sx={{ mb: { xs: 1, md: 2 }, textAlign: "center" }}>
        <Typography variant="h2" component="h1" sx={{ fontWeight: "bold", fontSize: { xs: "1.5rem", md: "2rem" } }}>
          {trialInfo?.trial_title || "Trial"}
        </Typography>
        <Typography variant="h2" sx={{ color: "primary.main", fontSize: { xs: "1rem", md: "1.25rem" } }}>
          Remaining Time: {formatTime(remainingTime)}
        </Typography>
      </Box>
      
      <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
        {currentQuestion && (
          <Slide
            in={true}
            direction={slideDirection}
            timeout={300}
            mountOnEnter
            unmountOnExit
            key={currentQuestion.id}
          >
            <Paper
              elevation={3}
              sx={{
                p: { xs: 1.5, md: 2 },
                borderRadius: "12px",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
                backgroundColor: "white",
              }}
            >
              <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
                <Typography variant="h6" sx={{ fontWeight: "medium", fontSize: { xs: "0.8rem", md: "1rem" } }}>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </Typography>
              </Box>
              <Box sx={{ mb: { xs: 0.8, md: 1 } }}>
                <MemoizedQuestionContent qcontent={currentQuestion.qcontent} />
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
                        control={<Radio sx={{ fontSize: { xs: "0.6rem", md: "0.8rem" } }} />}
                        label={`${index + 1}. ${option}`}
                        sx={{ fontSize: { xs: "0.75rem", md: "1rem" } }}
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
                    const disableCheckbox =
                      !selected.includes(option) && selected.length >= maxSelections;
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
                            sx={{ fontSize: { xs: "0.75rem", md: "1rem" } }}
                          />
                        }
                        label={`${index + 1}. ${option}`}
                        sx={{ fontSize: { xs: "0.75rem", md: "1rem" } }}
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
                  sx={{ my: { xs: 1, md: 2 }, fontSize: { xs: "0.75rem", md: "1rem" } }}
                />
              )}
            </Paper>
          </Slide>
        )}
      </Box>

      {/* Navigation Buttons */}
      <Grid container spacing={2} sx={{ mb: { xs: 1.5, md: 2 } }}>
        <Grid item xs={6}>
          <Button
            variant="contained"
            fullWidth
            onClick={handlePrev}
            disabled={isSubmitting || currentQuestionIndex === 0}
            sx={{
              borderRadius: "8px",
              boxShadow: "0px 2px 4px rgba(0,0,0,0.2)",
              textTransform: "none",
              fontSize: { xs: "0.75rem", md: "1rem" },
              "&:hover": { boxShadow: "0px 4px 8px rgba(0,0,0,0.3)" },
            }}
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
            sx={{
              borderRadius: "8px",
              boxShadow: "0px 2px 4px rgba(0,0,0,0.2)",
              textTransform: "none",
              fontSize: { xs: "0.75rem", md: "1rem" },
              "&:hover": { boxShadow: "0px 4px 8px rgba(0,0,0,0.3)" },
            }}
          >
            Next
          </Button>
        </Grid>
      </Grid>

      {/* Finish Button */}
      <Box sx={{ textAlign: "center", mb: { xs: 1, md: 2 } }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => finishSubmission()}
          disabled={isSubmitting}
          sx={{
            px: { xs: 2, md: 4 },
            py: { xs: 1, md: 1.5 },
            fontSize: { xs: "0.75rem", md: "1rem" },
            borderRadius: "8px",
            boxShadow: "0px 2px 4px rgba(0,0,0,0.2)",
            textTransform: "none",
            "&:hover": { boxShadow: "0px 4px 8px rgba(0,0,0,0.3)" },
          }}
        >
          Finish
        </Button>
      </Box>

      {/* Finish Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleDialogClose}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: "16px",
            boxShadow: "0px 4px 20px rgba(0,0,0,0.1)",
            p: 0,
          },
        }}
      >
        <DialogTitle
          sx={{
            textAlign: "center",
            fontWeight: "bold",
            backgroundColor: "primary.main",
            color: "white",
            py: { xs: 1.5, md: 2 },
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            fontSize: { xs: "1rem", md: "1.25rem" },
          }}
        >
          Trial Completed!
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ textAlign: "center", mb: { xs: 1, md: 2 } }}>
            <Typography variant="h6" sx={{ mt: { xs: 1, md: 2 }, fontSize: { xs: "1rem", md: "1.25rem" } }}>
              {trialInfo?.trial_title}
            </Typography>
            <Typography variant="subtitle1" sx={{ mt: { xs: 0.5, md: 1 }, fontSize: { xs: "0.8rem", md: "1rem" } }}>
              Score: {finalScore} / {allScore}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontSize: { xs: "0.8rem", md: "1rem" } }}>
              Remaining Time: {formatTime(remainingTime)} ({remainingTime} seconds)
            </Typography>
          </Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 1,
              mb: { xs: 1, md: 2 },
            }}
          >
            {star1Display ? (
              <StarIcon color="warning" sx={{ fontSize: { xs: "1.5rem", md: "2rem" } }} />
            ) : (
              <StarBorderIcon sx={{ fontSize: { xs: "1.5rem", md: "2rem" } }} />
            )}
            {star2Display ? (
              <StarIcon color="warning" sx={{ fontSize: { xs: "1.5rem", md: "2rem" } }} />
            ) : (
              <StarBorderIcon sx={{ fontSize: { xs: "1.5rem", md: "2rem" } }} />
            )}
            {star3Display ? (
              <StarIcon color="warning" sx={{ fontSize: { xs: "1.5rem", md: "2rem" } }} />
            ) : (
              <StarBorderIcon sx={{ fontSize: { xs: "1.5rem", md: "2rem" } }} />
            )}
          </Box>
          {/* Hidden Achievement Section */}
          <Box sx={{ mt: { xs: 1, md: 2 }, textAlign: "center" }}>
            {hiddenAchvAchieved && hiddenAchvDetails ? (
              <Box sx={{ textAlign: "center", mb: { xs: 1, md: 2 } }}>
                <Typography variant="body2" sx={{ fontWeight: "bold", mb: { xs: 0.5, md: 1 }, fontSize: { xs: "0.75rem", md: "0.875rem" } }}>
                  Hidden Achievement Earned
                </Typography>
                <Box
                  component="img"
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/achivements/${hiddenAchvDetails.image}`}
                  alt={hiddenAchvDetails.name}
                  sx={{ maxWidth: { xs: "80px", md: "100px" }, mb: { xs: 0.5, md: 1 }, borderRadius: "8px" }}
                />
                <Typography variant="h6" sx={{ fontSize: { xs: "1rem", md: "1.25rem" } }}>{hiddenAchvDetails.name}</Typography>
                <Typography variant="body2" sx={{ fontSize: { xs: "0.75rem", md: "0.875rem" } }}>
                  Condition: {hiddenAchvDetails.description}
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  mt: { xs: 1, md: 2 },
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                }}
              >
                <HelpTwoToneIcon color="disabled" sx={{ fontSize: { xs: "1rem", md: "1.5rem" } }} />
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: "0.75rem", md: "0.875rem" } }}>
                  Secret Achievement Remains Locked
                </Typography>
              </Box>
            )}
          </Box>
          {/* Gained EXP Section */}
          <Box sx={{ mt: { xs: 1, md: 2 }, textAlign: "center" }}>
            <Typography variant="h6" sx={{ color: "green", fontSize: { xs: "1rem", md: "1.25rem" } }}>
              Gained Exp: +{gainedExp}
            </Typography>
          </Box>
          {attemptMessage && (
            <Box sx={{ mt: { xs: 1, md: 2 }, textAlign: "center" }}>
              <Typography variant="body1" color="secondary" sx={{ fontSize: { xs: "0.75rem", md: "0.875rem" } }}>
                {attemptMessage}
              </Typography>
            </Box>
          )}
          {/* Display penalty warning if the user switched tabs */}
          {tabSwitched && (
            <Box sx={{ mt: { xs: 1, md: 2 }, textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: "red", fontWeight: "bold", fontSize: { xs: "0.75rem", md: "0.875rem" } }}>
                You can't switch tabs during trial – please try not to cheat (-20% score)
              </Typography>
            </Box>
          )}
          <Box sx={{ mt: { xs: 1, md: 2 } }}>
            <Typography variant="body2" align="center" sx={{ fontSize: { xs: "0.65rem", md: "0.875rem" } }}>
              * First Star: Awarded for completing the trial.
            </Typography>
            <Typography variant="body2" align="center" sx={{ fontSize: { xs: "0.65rem", md: "0.875rem" } }}>
              * Second Star: Awarded if your score is at least 70% of the total score and you have earned the first star.
            </Typography>
            <Typography variant="body2" align="center" sx={{ fontSize: { xs: "0.65rem", md: "0.875rem" } }}>
              * Third Star: Awarded if you finish with at least 35% of the time remaining and you have earned the second star.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: { xs: 1, md: 2 } }}>
          <Button onClick={handleDialogClose} variant="contained" color="primary" sx={{ px: { xs: 2, md: 4 }, py: { xs: 1, md: 1 }, fontSize: { xs: "0.75rem", md: "1rem" } }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TrialPage;
