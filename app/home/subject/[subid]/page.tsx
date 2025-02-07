"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
  CircularProgress,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useTheme } from "@mui/material/styles";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const LessonsPage = () => {
  const { subid } = useParams();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [subjectName, setSubjectName] = useState("");
  const [lessons, setLessons] = useState<any[]>([]);
  const [trials, setTrials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [selectedTrial, setSelectedTrial] = useState<any>(null);
  // Tracking an ongoing trial record (if any) for the logged user
  const [ongoingTrial, setOngoingTrial] = useState<any>(null);
  // Prefetched finished trial records for the current user.
  const [finishedTrials, setFinishedTrials] = useState<any[]>([]);
  // Flag to prevent multiple clicks while processing an action
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch initial data and finished trials on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const authResponse = await fetch("/api/check-auth", {
          method: "GET",
          credentials: "include",
        });
        if (!authResponse.ok) {
          router.push("/");
          return;
        }
        const { data: subjectData } = await supabase
          .from("subjects")
          .select("sub")
          .eq("id", subid)
          .single();
        setSubjectName(subjectData?.sub || "Unknown Subject");

        const { data: lessonData } = await supabase
          .from("lessons")
          .select("*")
          .eq("subject_id", subid);
        setLessons(lessonData?.sort((a, b) => a.lesson_no - b.lesson_no) || []);

        const { data: trialData } = await supabase.from("trials").select("*");
        setTrials(trialData || []);

        // Fetch finished trial records for current user
        const userData = await authResponse.json();
        const userId = userData.id;
        const { data: finishedData, error: finishedError } = await supabase
          .from("trial_data")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "Finished");
        if (finishedError) {
          console.error("Error fetching finished trial records:", finishedError);
        } else {
          setFinishedTrials(finishedData || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [subid, router]);

  // Check ongoing trial data for the logged-in user
  useEffect(() => {
    const checkOngoingTrial = async () => {
      try {
        const authResponse = await fetch("/api/check-auth", {
          method: "GET",
          credentials: "include",
        });
        if (!authResponse.ok) {
          console.error("Authentication failed for ongoing trial check");
          return;
        }
        const userData = await authResponse.json();
        const userId = userData.id;
        const { data, error } = await supabase
          .from("trial_data")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "Ongoing");
        if (error) {
          console.error("Error fetching ongoing trial:", error);
          return;
        }
        // Calculate current Philippine time (UTC+8)
        const now = new Date();
        const offsetMs = 8 * 60 * 60 * 1000;
        const currentTime = new Date(now.getTime() + offsetMs);
        let ongoing = null;
        if (data && data.length > 0) {
          // Loop through ongoing trials. If a trial's end_time has passed, update its status.
          for (const trial of data) {
            const trialEndTime = new Date(trial.end_time);
            if (trialEndTime <= currentTime) {
              // Update trial status to "Finished"
              const { error: updateError } = await supabase
                .from("trial_data")
                .update({ status: "Finished" })
                .eq("id", trial.id);
              if (updateError) {
                console.error("Error updating trial status:", updateError);
              }
            } else {
              // Save the first trial that is still ongoing
              ongoing = trial;
              break;
            }
          }
        }
        setOngoingTrial(ongoing);
      } catch (error) {
        console.error("Error checking ongoing trial:", error);
      }
    };
    checkOngoingTrial();
  }, []);

  // Generate a 6-digit UUID
  const generate6DigitUUID = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Helper to ensure the generated id is unique in the trial_data table
  const generateUniqueTrialDataId = async (): Promise<string> => {
    let unique = false;
    let trialDataId = "";
    while (!unique) {
      trialDataId = generate6DigitUUID();
      const { data, error } = await supabase
        .from("trial_data")
        .select("id")
        .eq("id", trialDataId);
      if (error) {
        console.error("Error checking trial_data id uniqueness:", error);
        unique = true;
      } else if (data && data.length === 0) {
        unique = true;
      }
    }
    return trialDataId;
  };

  const startTrial = async (trialId: string) => {
    if (!trialId || isProcessing) return;
    setIsProcessing(true);
    try {
      const authResponse = await fetch("/api/check-auth", {
        method: "GET",
        credentials: "include",
      });
      if (!authResponse.ok) {
        console.error("Authentication failed");
        setIsProcessing(false);
        return;
      }
      const userData = await authResponse.json();
      const userId = userData.id;
      const trialDataId = await generateUniqueTrialDataId();
      const now = new Date();
      const offsetMs = 8 * 60 * 60 * 1000;
      const startTimeDate = new Date(now.getTime() + offsetMs);
      const startTime = startTimeDate.toISOString();

      let trialTime = selectedTrial?.time;
      if (!trialTime) {
        const { data: trialData, error: trialError } = await supabase
          .from("trials")
          .select("time")
          .eq("id", trialId)
          .single();
        if (trialError) {
          console.error("Error fetching trial time:", trialError);
          setIsProcessing(false);
          return;
        }
        trialTime = trialData?.time ?? 0;
      }

      if (!trialTime || isNaN(Number(trialTime))) {
        console.error("Trial time is missing or invalid.");
        setIsProcessing(false);
        return;
      }

      const trialDurationSec = Number(trialTime);
      const endTimeDate = new Date(startTimeDate.getTime() + trialDurationSec * 1000);
      const endTime = endTimeDate.toISOString();

      const { error } = await supabase.from("trial_data").insert([
        {
          id: trialDataId,
          user_id: userId,
          trial_id: trialId,
          start_time: startTime,
          end_time: endTime,
          status: "Ongoing",
        },
      ]);
      if (error) {
        console.error("Error inserting trial data:", error);
        setIsProcessing(false);
        return;
      }
      // Navigation; no need to reset processing flag as user leaves page.
      router.push(`/home/subject/${subid}/trial/${trialId}/${trialDataId}`);
    } catch (error) {
      console.error("Error starting trial:", error);
      setIsProcessing(false);
    }
  };

  // Function to resume an ongoing trial
  const resumeTrial = () => {
    if (isProcessing || !ongoingTrial || !selectedTrial) return;
    setIsProcessing(true);
    router.push(`/home/subject/${subid}/trial/${selectedTrial.id}/${ongoingTrial.id}`);
  };

  const handleLessonRedirect = () => {
    if (isProcessing || !selectedLesson) return;
    setIsProcessing(true);
    router.push(`/home/subject/${subid}/lessons/${selectedLesson.id}`);
  };

  const handleLessonClick = (lesson: any) => {
    setSelectedLesson(lesson);
    const trial = trials.find((trial) => trial.lesson_id === lesson.id);
    setSelectedTrial(trial || null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedLesson(null);
    setSelectedTrial(null);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  // Group lessons into main lessons and sub-lessons
  const groupedLessons: Record<string, { main: any | null; sub: any[] }> =
    lessons.reduce((acc, lesson) => {
      const lessonNoParts = lesson.lesson_no.toString().split(".");
      const mainLessonNo = lessonNoParts[0];
      if (!acc[mainLessonNo]) {
        acc[mainLessonNo] = { main: null, sub: [] };
      }
      if (lessonNoParts.length === 1) {
        acc[mainLessonNo].main = lesson;
      } else {
        acc[mainLessonNo].sub.push(lesson);
      }
      return acc;
    }, {} as Record<string, { main: any; sub: any[] }>);

  // Check locally if a finished record exists for the selected trial
  const finishedTrialExists =
    selectedTrial &&
    finishedTrials.some((ft: any) => ft.trial_id === selectedTrial.id);

  return (
    <Container maxWidth="lg">
      <Box marginTop="1rem">
        <Paper elevation={3} sx={{ padding: "1rem" }}>
          <Typography variant="h4" gutterBottom>
            {subjectName}
          </Typography>
          {Object.keys(groupedLessons).length > 0 ? (
            <Box
              sx={{
                overflowY: "auto",
                maxHeight: "67vh",
                padding: "1rem",
                "&::-webkit-scrollbar": { width: "8px" },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: "primary.main",
                  borderRadius: "4px",
                  border: "2px solid #fff",
                },
                "&::-webkit-scrollbar-track": {
                  backgroundColor: "grey.500",
                  borderRadius: "4px",
                },
              }}
            >
              {Object.values(groupedLessons).map(({ main, sub }, index) => (
                <Box key={index}>
                  <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                    {main && (
                      <Button
                        disabled={isProcessing}
                        sx={{
                          p: 1.5,
                          backgroundColor: "primary.main",
                          color: "primary.contrastText",
                          textTransform: "none",
                          transition: "transform 0.3s",
                          "&:hover": {
                            transform: "scale(1.01)",
                            backgroundColor: "primary.dark",
                          },
                        }}
                        onClick={() => handleLessonClick(main)}
                      >
                        <AssignmentIcon sx={{ marginRight: 1 }} />
                        <Typography variant="h6">
                          Lesson {main.lesson_no}
                        </Typography>
                      </Button>
                    )}
                    {sub.map((subLesson) => (
                      <Button
                        key={subLesson.id}
                        disabled={isProcessing}
                        sx={{
                          p: 1,
                          backgroundColor: "#0D47A1",
                          color: "white",
                          textTransform: "none",
                          fontSize: "0.9rem",
                          "&:hover": { backgroundColor: "#08306b" },
                        }}
                        onClick={() => handleLessonClick(subLesson)}
                      >
                        Lesson {subLesson.lesson_no}
                      </Button>
                    ))}
                  </Box>
                  <hr style={{ margin: "12px 0", borderColor: "#B0BEC5" }} />
                </Box>
              ))}
            </Box>
          ) : (
            <Typography>No lessons found for this subject.</Typography>
          )}
        </Paper>
      </Box>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            backgroundColor: "primary.main",
            color: "primary.contrastText",
            textAlign: "center",
          }}
        >
          {selectedLesson?.lesson_title}
        </DialogTitle>
        <DialogContent dividers sx={{ padding: "1.5rem" }}>
          <Typography
            variant="body1"
            sx={{ marginBottom: "1rem", color: "text.secondary" }}
          >
            {selectedLesson?.description || "No description available."}
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            justifyContent: "space-between",
            paddingBottom: "1rem",
            paddingX: "1.5rem",
          }}
        >
          <Button onClick={closeDialog} sx={{ color: "error.main" }} disabled={isProcessing}>
            Close
          </Button>
          <Box display="flex" flexDirection="column" gap={1}>
            <Button
              disabled={isProcessing}
              sx={{
                p: 1,
                backgroundColor: "primary.main",
                color: "primary.contrastText",
                textTransform: "none",
                "&:hover": { backgroundColor: "primary.dark" },
              }}
              onClick={handleLessonRedirect}
            >
              Go to Lesson
            </Button>
            {selectedTrial && (
              <>
                {ongoingTrial ? (
                  ongoingTrial.trial_id === selectedTrial.id ? (
                    <Button
                      disabled={isProcessing}
                      sx={{
                        p: 1,
                        backgroundColor: "orange",
                        color: "#fff",
                        textTransform: "none",
                        "&:hover": { backgroundColor: "#cc7000" },
                      }}
                      onClick={resumeTrial}
                    >
                      <PlayArrowIcon sx={{ marginRight: 1 }} />
                      Resume
                    </Button>
                  ) : (
                    <Button
                      disabled
                      sx={{
                        p: 1,
                        backgroundColor: "grey",
                        color: "#fff",
                        textTransform: "none",
                      }}
                    >
                      <PlayArrowIcon sx={{ marginRight: 1 }} />
                      Another trial is in progress
                    </Button>
                  )
                ) : finishedTrialExists ? (
                  // Immediately show the retry button (in red) if a finished record exists.
                  <Button
                    disabled={isProcessing}
                    sx={{
                      p: 1,
                      backgroundColor: "error.main",
                      color: "error.contrastText",
                      textTransform: "none",
                      "&:hover": { backgroundColor: "error.dark" },
                    }}
                    onClick={() => startTrial(selectedTrial.id)}
                  >
                    <PlayArrowIcon sx={{ marginRight: 1 }} />
                    Retry
                  </Button>
                ) : (
                  <Button
                    disabled={isProcessing}
                    sx={{
                      p: 1,
                      backgroundColor: "success.main",
                      color: "success.contrastText",
                      textTransform: "none",
                      "&:hover": { backgroundColor: "success.dark" },
                    }}
                    onClick={() => startTrial(selectedTrial.id)}
                  >
                    <PlayArrowIcon sx={{ marginRight: 1 }} />
                    {selectedTrial.trial_title}
                  </Button>
                )}
              </>
            )}
          </Box>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default LessonsPage;
