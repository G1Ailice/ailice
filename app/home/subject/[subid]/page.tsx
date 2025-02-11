"use client";

import React, { useEffect, useState } from "react";
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
  IconButton,
  Avatar,
  Slide,
  Tooltip,
  Divider,
} from "@mui/material";
import { TransitionProps } from "@mui/material/transitions";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StarIcon from "@mui/icons-material/Star";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import HelpTwoToneIcon from "@mui/icons-material/HelpTwoTone";
import { useTheme } from "@mui/material/styles";

// Create a Transition component using Slide
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper: Format seconds to HH:MM:SS.
const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const LessonsPage = () => {
  const { subid } = useParams();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Global state for the current authenticated user (fetched once)
  const [currentUser, setCurrentUser] = useState<any>(null);

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
  // New state to hold the star rating (max 3)
  const [starRating, setStarRating] = useState<number>(0);
  // New states for best trial score and time concluded (in seconds)
  const [trialScore, setTrialScore] = useState<number>(0);
  const [timeConcluded, setTimeConcluded] = useState<number>(0);
  // New state to track if a trial attempt exists
  const [attempted, setAttempted] = useState<boolean>(false);

  // New state for ranking dialog and its data
  const [openRankingDialog, setOpenRankingDialog] = useState<boolean>(false);
  const [rankingData, setRankingData] = useState<any[]>([]);

  const [unlockedLessons, setUnlockedLessons] = useState<Record<string, boolean>>({});

  // New states for hidden achievement details and unlocked status.
  const [hiddenAchvDetails, setHiddenAchvDetails] = useState<{
    id: string;
    name: string;
    image: string;
  } | null>(null);
  const [hiddenAchvUnlocked, setHiddenAchvUnlocked] = useState<boolean>(false);

  // 1. Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch("/api/check-auth", {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) {
          router.push("/");
          return;
        }
        const user = await response.json();
        setCurrentUser(user);
      } catch (error) {
        console.error("Error fetching current user:", error);
        router.push("/");
      }
    };
    fetchCurrentUser();
  }, [router]);

  // 2. Check unlocked lessons (for Locked and Final lessons)
  useEffect(() => {
    if (!currentUser || lessons.length === 0) return;

    const checkUnlockedLessons = async () => {
      const newUnlockedLessons: Record<string, boolean> = {};

      // Utility function: calculate level from exp.
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

      for (const lesson of lessons) {
        // Treat both "Locked" and "Final" lessons the same for unlocking logic
        if (lesson.status === "Locked" || lesson.content_type === "Final") {
          const trialIdToCheck = lesson.unlocked_by;
          if (!trialIdToCheck) {
            newUnlockedLessons[lesson.id] = false;
            continue;
          }
          // Query trial_data for the best record for this trial and user.
          const { data: trialDataRecords, error } = await supabase
            .from("trial_data")
            .select("eval_score, star")
            .eq("user_id", currentUser.id)
            .eq("trial_id", trialIdToCheck)
            .order("eval_score", { ascending: false })
            .limit(1);

          if (error || !trialDataRecords || trialDataRecords.length === 0) {
            newUnlockedLessons[lesson.id] = false;
            continue;
          }

          const bestRecord = trialDataRecords[0];
          if (bestRecord.star >= 2) {
            if (!lesson.level_req) {
              newUnlockedLessons[lesson.id] = true;
            } else {
              const requiredLevel = Number(lesson.level_req);
              const userExp = Number(currentUser.exp);
              const userLevelData = calculateLevel(userExp);
              newUnlockedLessons[lesson.id] = userLevelData.level >= requiredLevel;
            }
          } else {
            newUnlockedLessons[lesson.id] = false;
          }
        } else {
          newUnlockedLessons[lesson.id] = true;
        }
      }
      setUnlockedLessons(newUnlockedLessons);
    };

    checkUnlockedLessons();
  }, [currentUser, lessons]);

  // 3. Remove expired trials
  useEffect(() => {
    if (!currentUser) return;

    const removeExpiredTrials = async () => {
      try {
        const now = new Date();
        const offsetMs = 8 * 60 * 60 * 1000;
        const currentTime = new Date(now.getTime() + offsetMs);
        const currentTimeISO = currentTime.toISOString();

        const { data: expiredTrials, error } = await supabase
          .from("trial_data")
          .select("*")
          .eq("user_id", currentUser.id)
          .eq("status", "Ongoing")
          .lte("end_time", currentTimeISO);

        if (error) {
          console.error("Error fetching expired trials:", error);
          return;
        }

        if (expiredTrials && expiredTrials.length > 0) {
          for (const trial of expiredTrials) {
            const { error: deleteError } = await supabase
              .from("trial_data")
              .delete()
              .eq("id", trial.id);
            if (deleteError) {
              console.error("Error deleting expired trial:", deleteError);
            } else {
              console.log(`Expired trial with id ${trial.id} removed.`);
            }
          }
        }
      } catch (err) {
        console.error("Error in removeExpiredTrials effect:", err);
      }
    };

    removeExpiredTrials();
  }, [currentUser]);

  // 4. Fetch data: subjects, lessons, trials, finished trials.
  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
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
        // You might want to sort or process your lessons here as needed.
        setLessons(lessonData || []);

        const { data: trialData } = await supabase.from("trials").select("*");
        setTrials(trialData || []);

        const { data: finishedData, error: finishedError } = await supabase
          .from("trial_data")
          .select("*")
          .eq("user_id", currentUser.id)
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
  }, [subid, router, currentUser]);

  // 5. Check ongoing trial data.
  useEffect(() => {
    if (!currentUser) return;

    const checkOngoingTrial = async () => {
      try {
        const { data, error } = await supabase
          .from("trial_data")
          .select("*")
          .eq("user_id", currentUser.id)
          .eq("status", "Ongoing");
        if (error) {
          console.error("Error fetching ongoing trial:", error);
          return;
        }
        const now = new Date();
        const offsetMs = 8 * 60 * 60 * 1000;
        const currentTime = new Date(now.getTime() + offsetMs);
        let ongoing = null;
        if (data && data.length > 0) {
          for (const trial of data) {
            const trialEndTime = new Date(trial.end_time);
            if (trialEndTime <= currentTime) {
              const { error: updateError } = await supabase
                .from("trial_data")
                .update({ status: "Finished" })
                .eq("id", trial.id);
              if (updateError) {
                console.error("Error updating trial status:", updateError);
              }
            } else {
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
  }, [currentUser]);

  // 6. Utility: Generate a 6-digit UUID and ensure uniqueness.
  const generate6DigitUUID = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

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

  // 7. Functions to start/resume a trial.
  const startTrial = async (trialId: string) => {
    if (!trialId || isProcessing || !currentUser) return;
    setIsProcessing(true);
    try {
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
          user_id: currentUser.id,
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
      router.push(`/home/subject/${subid}/trial/${trialId}/${trialDataId}`);
    } catch (error) {
      console.error("Error starting trial:", error);
      setIsProcessing(false);
    }

    triggerAction();
  };

  const resumeTrial = () => {
    if (isProcessing || !ongoingTrial || !selectedTrial) return;
    setIsProcessing(true);
    router.push(`/home/subject/${subid}/trial/${selectedTrial.id}/${ongoingTrial.id}`);
    triggerAction();
  };

  const handleLessonRedirect = () => {
    if (isProcessing || !selectedLesson) return;
    setIsProcessing(true);
    router.push(`/home/subject/${subid}/lessons/${selectedLesson.id}`);
  };

  // --- IMPORTANT: Reset the attempted state when opening a new lesson dialog ---
  const handleLessonClick = (lesson: any) => {
    setAttempted(false); // Reset attempted status for the new lesson
    setStarRating(0);
    setSelectedLesson(lesson);
    const trial = trials.find((trial) => trial.lesson_id === lesson.id);
    setSelectedTrial(trial || null);
    setDialogOpen(true);
  };

  const triggerAction = () => {
    const event = new Event("childAction");
    document.dispatchEvent(event);
  };

  // --- Also reset attempted state when closing the dialog ---
  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedLesson(null);
    setSelectedTrial(null);
    setStarRating(0);
    setAttempted(false);
  };

  // --- Fetch hidden achievement details as soon as selectedTrial and currentUser are available ---
  useEffect(() => {
    const fetchHiddenAchievementDetails = async () => {
      if (selectedTrial && currentUser && selectedTrial.hd_achv_id) {
        // Fetch achievement details from the achievements table.
        const { data: achvData, error: achvError } = await supabase
          .from("achievements")
          .select("id, name, image")
          .eq("id", selectedTrial.hd_achv_id)
          .single();
        if (achvError) {
          console.error("Error fetching hidden achievement details:", achvError);
          return;
        }
        setHiddenAchvDetails(achvData);

        // Check if the current user has unlocked this achievement in users_acv.
        const { data: userAcvData, error: userAcvError } = await supabase
          .from("user_acv")
          .select("id")
          .eq("user_id", currentUser.id)
          .eq("achv_id", selectedTrial.hd_achv_id)
          .maybeSingle();
        if (userAcvError) {
          console.error("Error checking user achievement:", userAcvError);
        }
        setHiddenAchvUnlocked(!!userAcvData);
      }
    };
    fetchHiddenAchievementDetails();
  }, [selectedTrial, currentUser]);

  // 8. Instantly compute and display star rating, trial score, and time concluded
  //     using the already fetched finishedTrials state.
  useEffect(() => {
    if (dialogOpen && selectedTrial) {
      const trialRecords = finishedTrials.filter(
        (ft: any) => ft.trial_id === selectedTrial.id
      );
      if (trialRecords.length > 0) {
        trialRecords.sort((a, b) => b.score - a.score);
        const bestRecord = trialRecords[0];
        setAttempted(true);
        setStarRating(bestRecord.star || 0);
        setTrialScore(bestRecord.score || 0);
        setTimeConcluded(bestRecord.time_concluded || 0);
      } else {
        setAttempted(false);
        setStarRating(0);
        setTrialScore(0);
        setTimeConcluded(0);
      }
    }
  }, [dialogOpen, selectedTrial, finishedTrials]);

  // --- Ranking dialog logic ---
  const fetchRankingData = async () => {
    if (!selectedTrial) return;
    try {
      // Fetch trial_data records for the current trial that are finished
      const { data: trialRecords, error: trialError } = await supabase
        .from("trial_data")
        .select("user_id, eval_score")
        .eq("trial_id", selectedTrial.id)
        .eq("status", "Finished")
        .order("eval_score", { ascending: false })
        .limit(10);
  
      if (trialError) {
        console.error("Error fetching ranking data:", trialError);
        return;
      }
  
      if (!trialRecords || trialRecords.length === 0) {
        setRankingData([]);
        setOpenRankingDialog(true);
        return;
      }
  
      // Extract unique user_ids from trialRecords
      const userIds = trialRecords.map((rec: any) => rec.user_id);
  
      // Fetch user details in one query
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, username, profile_pic")
        .in("id", userIds);
  
      if (usersError) {
        console.error("Error fetching user details for ranking:", usersError);
        return;
      }
  
      // Merge trialRecords with user details
      const mergedRanking = trialRecords.map((record: any) => {
        const user = usersData?.find((u: any) => u.id === record.user_id);
        return { ...record, username: user?.username, profile_pic: user?.profile_pic };
      });
  
      setRankingData(mergedRanking);
      setOpenRankingDialog(true);
    } catch (error) {
      console.error("Error in fetchRankingData:", error);
    }
  };
  

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  // ────────────── NEW GROUPING BY QUARTER ──────────────
  // Group lessons by their "quarter" attribute.
  const groupedLessonsByQuarter: Record<string, any[]> = lessons.reduce((acc, lesson) => {
    const quarter = lesson.quarter || "Unknown";
    if (!acc[quarter]) {
      acc[quarter] = [];
    }
    acc[quarter].push(lesson);
    return acc;
  }, {} as Record<string, any[]>);

  // If a lesson has been selected, check if a finished trial exists for it.
  const finishedTrialExists =
    selectedTrial &&
    finishedTrials.some((ft: any) => ft.trial_id === selectedTrial.id);

  return (
    <Container maxWidth="lg">
      <Box marginTop={{ xs: 2, sm: 4 }}>
        <Paper
          elevation={6}
          sx={{
            p: { xs: 2, sm: 4 },
            borderRadius: "16px",
            background: "linear-gradient(135deg, #f5f7fa, #c3cfe2)",
            boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.1)"
          }}
        >
          <Typography
            variant="h4"
            align="center"
            sx={{ fontWeight: 700, mb: { xs: 2, sm: 4 }, color: "#333" }}
          >
            {subjectName}
          </Typography>
          {Object.entries(groupedLessonsByQuarter).length > 0 ? (
            Object.entries(groupedLessonsByQuarter).map(([quarter, lessonsInQuarter]) => {
              // Sort lessons by lesson_no (converted to a number for correct order)
              const sortedLessons = lessonsInQuarter.sort(
                (a, b) => parseFloat(a.lesson_no) - parseFloat(b.lesson_no)
              );
              // Determine if the quarter is locked by checking the first lesson's unlock status
              const firstLesson = sortedLessons[0];
              const quarterLocked = !unlockedLessons[firstLesson.id];
              return (
                <Box
                  key={quarter}
                  sx={{
                    mb: { xs: 3, sm: 4 },
                    p: 2,
                    backgroundColor: "rgba(255,255,255,0.8)",
                    borderRadius: 2,
                  }}
                >
                  <Typography
                    variant="h5"
                    sx={{
                      mb: 2,
                      color: "#555",
                      fontWeight: 600,
                      fontSize: { xs: "1.1rem", sm: "1.25rem" }
                    }}
                  >
                    Quarter {quarter}
                  </Typography>
                  {quarterLocked && (
                    <Typography variant="subtitle1" color="error" sx={{ mb: 2 }}>
                      This quarter is locked. Finish the previous quarter.
                    </Typography>
                  )}
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={{ xs: 1, sm: 2 }}
                    flexWrap="wrap"
                  >
                    {sortedLessons.map((lesson) => {
                      // Check if the lesson is final based on its status.
                      const isFinal = lesson.status === "Final";
                      const unlocked = unlockedLessons[lesson.id];
                      // Check if the lesson number is decimal.
                      const isDecimal = !Number.isInteger(Number(lesson.lesson_no));
                      // For final lessons, display only the whole-number part and append "Final"
                      const displayLessonNo = isFinal
                        ? Math.floor(Number(lesson.lesson_no))
                        : lesson.lesson_no;
                      const buttonLabel = isFinal
                        ? `Lesson ${displayLessonNo} Final`
                        : `Lesson ${lesson.lesson_no}`;
                      return (
                        <Button
                          key={lesson.id}
                          disabled={
                            isProcessing || ((lesson.status === "Locked" || isFinal) && !unlocked)
                          }
                          sx={{
                            p: isDecimal ? { xs: 0.5, sm: 1 } : { xs: 1, sm: 1.5 },
                            backgroundColor:
                              (lesson.status === "Locked" || isFinal) && !unlocked
                                ? "#ccc"
                                : isFinal
                                ? "#d32f2f"
                                : "#1976d2",
                            color: "#fff",
                            textTransform: "none",
                            borderRadius: "8px",
                            boxShadow: "0px 2px 4px rgba(0,0,0,0.2)",
                            transition: "transform 0.3s, box-shadow 0.3s",
                            "&:hover": {
                              transform: "scale(1.03)",
                              boxShadow: "0px 4px 8px rgba(0,0,0,0.3)",
                              backgroundColor:
                                ((lesson.status === "Locked" || isFinal) && !unlocked)
                                  ? "#ccc"
                                  : isFinal
                                  ? "#c62828"
                                  : "#1565c0",
                            },
                          }}
                          onClick={() => handleLessonClick(lesson)}
                        >
                          <AssignmentIcon
                            sx={{ mr: isDecimal ? { xs: 0.5, sm: 0.5 } : { xs: 0.5, sm: 1 } }}
                          />
                          <Typography
                            variant={isDecimal ? "subtitle2" : "h6"}
                            sx={{
                              fontSize: {
                                xs: isDecimal ? "0.7rem" : "0.9rem",
                                sm: isDecimal ? "0.85rem" : "1rem",
                              },
                            }}
                          >
                            {buttonLabel}
                          </Typography>
                        </Button>
                      );
                    })}
                  </Box>
                  <Divider sx={{ mt: 3, borderColor: "rgba(0,0,0,0.1)" }} />
                </Box>
              );
            })
          ) : (
            <Typography
              align="center"
              sx={{ color: "#777", mt: { xs: 2, sm: 4 } }}
            >
              No lessons found for this subject.
            </Typography>
          )}
        </Paper>
      </Box>
      {/* Lesson Dialog with Transition */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Transition}
        PaperProps={{
          sx: {
            borderRadius: "16px",
            boxShadow: "0px 4px 20px rgba(0,0,0,0.2)",
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle
          sx={{
            backgroundColor: selectedLesson?.status === "Final" ? "#d32f2f" : "primary.main",
            color: "white",
            p: 2,
            textAlign: "center",
            fontWeight: "bold",
            position: "relative",
          }}
        >
          {selectedLesson?.status === "Final"
            ? Math.floor(Number(selectedLesson.lesson_no))
            : selectedLesson?.lesson_title}
          {/* Ranking Icon Button positioned absolutely in the top-right */}
          {selectedTrial && (
            <IconButton
              onClick={fetchRankingData}
              sx={{
                color: "white",
                position: "absolute",
                right: 8,
                top: 8,
              }}
            >
              <EmojiEventsRoundedIcon />
            </IconButton>
          )}
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3 }}>
          {/* Lesson Description */}
          <Typography variant="body1" sx={{ mb: 2, color: "text.secondary" }}>
            {selectedLesson?.description || "No description available."}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "red", fontWeight: "bold", mb: 2, textAlign: "center" }}
          >
            Warning: Do not switch tabs during trial to avoid penalties!
          </Typography>

          {/* Combined Hidden Achievement & Trial Rating */}
          <Box
            sx={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              justifyContent: "space-around",
              alignItems: "center",
              my: 2,
            }}
          >
            {/* Hidden Achievement Section */}
            {selectedTrial && selectedTrial.hd_achv_id && hiddenAchvDetails && (
              <Box sx={{ textAlign: "center", mb: isMobile ? 2 : 0 }}>
                {hiddenAchvUnlocked ? (
                  <>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Hidden Achievement Unlocked
                    </Typography>
                    <Tooltip title={hiddenAchvDetails.name}>
                      <Box
                        component="img"
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/achivements/${hiddenAchvDetails.image}`}
                        alt={hiddenAchvDetails.name}
                        sx={{ width: 80, height: 80, borderRadius: 2, mx: "auto" }}
                      />
                    </Tooltip>
                  </>
                ) : (
                  <Tooltip title="Hidden Achievement Locked">
                    <HelpTwoToneIcon color="disabled" sx={{ fontSize: 80 }} />
                  </Tooltip>
                )}
              </Box>
            )}
            {/* Trial Attempt Rating Section */}
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="caption" sx={{ mb: 0.5 }}>
                Trial Attempt Rating:
              </Typography>
              {attempted ? (
                <Box display="flex" justifyContent="center">
                  {[0, 1, 2].map((i) => (
                    <StarIcon
                      key={i}
                      sx={{ color: i < starRating ? "gold" : "gray", mx: 1 }}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="caption" sx={{ mb: 0.5 }}>
                  Not Yet Attempted
                </Typography>
              )}
              {selectedTrial && attempted && (
                <Box mt={0.5} textAlign="center">
                  <Typography sx={{ fontSize: isMobile ? "0.6rem" : "0.75rem" }}>
                    Score: {trialScore}/{selectedTrial.allscore}
                  </Typography>
                  <Typography sx={{ fontSize: isMobile ? "0.6rem" : "0.75rem" }}>
                    Remaining Time: {formatTime(timeConcluded)}/{formatTime(selectedTrial.time)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
            p: 2,
          }}
        >
          {/* Left: Close button */}
          <Button onClick={closeDialog} sx={{ color: "error.main" }} disabled={isProcessing}>
            Close
          </Button>

          {/* Right: Action buttons */}
          <Box display="flex" flexDirection="row" gap={2}>
            {/* Hide "Go to Lesson" button when the lesson is final */}
            {selectedLesson?.status !== "Final" && (
              <Button
                disabled={isProcessing}
                sx={{
                  p: 1,
                  backgroundColor: "primary.main",
                  color: "primary.contrastText",
                  textTransform: "none",
                  borderRadius: "8px",
                  "&:hover": { backgroundColor: "primary.dark" },
                }}
                onClick={handleLessonRedirect}
              >
                Go to Lesson
              </Button>
            )}
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
                        borderRadius: "8px",
                        "&:hover": { backgroundColor: "#cc7000" },
                      }}
                      onClick={resumeTrial}
                    >
                      <PlayArrowIcon sx={{ mr: 1 }} />
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
                        borderRadius: "8px",
                      }}
                    >
                      <PlayArrowIcon sx={{ mr: 1 }} />
                      Another trial is in progress
                    </Button>
                  )
                ) : finishedTrialExists ? (
                  <Button
                    disabled={isProcessing}
                    sx={{
                      p: 1,
                      backgroundColor: "error.main",
                      color: "error.contrastText",
                      textTransform: "none",
                      borderRadius: "8px",
                      "&:hover": { backgroundColor: "error.dark" },
                    }}
                    onClick={() => startTrial(selectedTrial.id)}
                  >
                    <PlayArrowIcon sx={{ mr: 1 }} />
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
                      borderRadius: "8px",
                      "&:hover": { backgroundColor: "success.dark" },
                    }}
                    onClick={() => startTrial(selectedTrial.id)}
                  >
                    <PlayArrowIcon sx={{ mr: 1 }} />
                    {selectedTrial.trial_title}
                  </Button>
                )}
              </>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* Ranking Dialog with Transition */}
      <Dialog
        open={openRankingDialog}
        onClose={() => setOpenRankingDialog(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Transition}
        PaperProps={{
          sx: {
            borderRadius: "16px",
            boxShadow: "0px 4px 20px rgba(0,0,0,0.2)",
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle
          sx={{
            backgroundColor: selectedLesson?.status === "Final" ? "#d32f2f" : "primary.main",
            color: "white",
            p: 2,
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          Trial Ranking
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {rankingData && rankingData.length > 0 ? (
            rankingData.map((record, index) => {
              const rank = index + 1;
              const rankColor =
                rank === 1
                  ? "gold"
                  : rank === 2
                  ? "silver"
                  : rank === 3
                  ? "#cd7f32"
                  : "blue";
              return (
                <Box key={record.user_id} display="flex" alignItems="center" gap={2} mb={1}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: `2px solid ${rankColor}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: rankColor,
                      fontWeight: "bold",
                    }}
                  >
                    {rank}
                  </Box>
                  <Avatar
                    onClick={() => router.push(`/home/user/${record.user_id}`)}
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${record.profile_pic}`}
                    alt={record.username}
                    sx={{ cursor: "pointer" }}
                  />
                  <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                    {record.username}
                  </Typography>
                  <Typography variant="subtitle1">
                    Rank Score: {record.eval_score}
                  </Typography>
                </Box>
              );
            })
          ) : (
            <Typography variant="body1" align="center">
              There's nothing here at the moment.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", p: 2 }}>
          <Button onClick={() => setOpenRankingDialog(false)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>

  );
};

export default LessonsPage;
