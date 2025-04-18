"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  Box, Container, Paper, Typography, TableContainer, Table, TableBody, TableCell, TableHead,
  TableRow, Button, CircularProgress, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem, useTheme, useMediaQuery, SelectChangeEvent, Snackbar, Alert, IconButton
} from "@mui/material";
import { grey, blue } from "@mui/material/colors";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AddIcon from "@mui/icons-material/Add"; 
import InfoIcon from "@mui/icons-material/Info";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Lesson {
  id: string;
  lesson_no: string;
  lesson_title: string;
  description: string;
  quarter: string;
  status: string;
  level_req?: number | null;
  unlocked_by?: string | null;
}

interface Trial {
  id: string;
  lesson_id: string;
  trial_title: string;
  time: number | null;
  allscore?: number | null;
  exp_gain?: number | null;
  first_exp?: number | null;
  hd_condition?: string | null;
  hd_achv_id?: number | null;
  qcount?: number | null;
}

interface Achievement {
  id: number;
  name: string;
  image: string;
  subject_id: string; 
}

// Define a separate type for trial edit/create form data with all fields as strings.
interface TrialFormData {
  trial_title: string;
  allscore: string;
  time: string;
  exp_gain: string;
  first_exp: string;
  hd_condition: string;
  hd_achv_id: string;
  qcount: string;
}

export default function AdminStudentLessonsPage() {
  const { id: subid } = useParams();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [subjectName, setSubjectName] = useState<string>("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // Add state to track submission
  const [isDeleting, setIsDeleting] = useState(false); // Add state to track deletion
  const [hasQuestions, setHasQuestions] = useState(false); // Track if the trial has associated questions

  // States for Lesson Edit Dialog
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [formData, setFormData] = useState<Partial<Lesson>>({});

  // States for Trial Edit Dialog using TrialFormData type
  const [openTrialEditDialog, setOpenTrialEditDialog] = useState(false);
  const [currentTrial, setCurrentTrial] = useState<Trial | null>(null);
  const [trialFormData, setTrialFormData] = useState<TrialFormData>({
    trial_title: "",
    allscore: "",
    time: "",
    exp_gain: "",
    first_exp: "",
    hd_condition: "",
    hd_achv_id: "",
    qcount: ""
  });

  // States for Trial Create Dialog
  const [openTrialCreateDialog, setOpenTrialCreateDialog] = useState(false);
  const [currentLessonForTrialCreate, setCurrentLessonForTrialCreate] = useState<Lesson | null>(null);
  const [trialCreateFormData, setTrialCreateFormData] = useState<TrialFormData>({
    trial_title: "",
    allscore: "",
    time: "",
    exp_gain: "",
    first_exp: "",
    hd_condition: "",
    hd_achv_id: "",
    qcount: ""
  });

  // State to track validation errors for "Add Quiz"
  const [addQuizErrors, setAddQuizErrors] = useState<Partial<TrialFormData>>({});

  // States for Create Lesson Dialog
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [createFormData, setCreateFormData] = useState<Partial<Lesson>>({
    lesson_title: "",
    description: "",
    lesson_no: "",
    level_req: 0,
    quarter: "",
    status: "Locked",
    unlocked_by: ""
  });

  // Pagination state: mapping each quarter to its current page number.
  const [pagination, setPagination] = useState<{ [key: string]: number }>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false); // State for delete confirmation dialog

  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
  };

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const [deleteLessonDialogOpen, setDeleteLessonDialogOpen] = useState(false); // State for delete confirmation dialog
  const [lessonToDelete, setLessonToDelete] = useState<Lesson | null>(null);
  const [isLessonDeletable, setIsLessonDeletable] = useState<{ [key: string]: boolean }>({}); // Track deletable state for lessons

  const handleOpenDeleteLessonDialog = (lesson: Lesson) => {
    setLessonToDelete(lesson);
    setDeleteLessonDialogOpen(true);
  };

  const handleCloseDeleteLessonDialog = () => {
    setDeleteLessonDialogOpen(false);
    setLessonToDelete(null);
  };

  const checkLessonDeletable = async (lessonId: string) => {
    try {
      const [lessonContentCheck, discussionCheck, replyCheck, trialCheck] = await Promise.all([
        supabase.from("lesson_content").select("id").eq("lessons_id", lessonId),
        supabase.from("discussion").select("id").eq("lesson_id", lessonId),
        supabase.from("discus_reply").select("id").eq("lesson_id", lessonId),
        supabase.from("trials").select("id").eq("lesson_id", lessonId),
      ]);

      const isDeletable =
        (lessonContentCheck.data?.length ?? 0) === 0 &&
        (discussionCheck.data?.length ?? 0) === 0 &&
        (replyCheck.data?.length ?? 0) === 0 &&
        (trialCheck.data?.length ?? 0) === 0;

      setIsLessonDeletable((prev) => ({ ...prev, [lessonId]: isDeletable }));
    } catch (err) {
      console.error("Error checking if lesson is deletable:", err);
      setIsLessonDeletable((prev) => ({ ...prev, [lessonId]: false }));
    }
  };

  const handleDeleteLesson = async () => {
    if (!lessonToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("lessons")
        .delete()
        .eq("id", lessonToDelete.id);

      if (error) throw error;

      setLessons((prevLessons) =>
        prevLessons.filter((lesson) => lesson.id !== lessonToDelete.id)
      );
      setSnackbar({ open: true, message: "Lesson deleted successfully!", severity: "success" });
    } catch (err) {
      console.error("Error deleting lesson:", err);
      setSnackbar({ open: true, message: "Error deleting lesson.", severity: "error" });
    } finally {
      setIsDeleting(false);
      handleCloseDeleteLessonDialog();
    }
  };

  useEffect(() => {
    lessons.forEach((lesson) => {
      if (!(lesson.id in isLessonDeletable)) {
        checkLessonDeletable(lesson.id);
      }
    });
  }, [lessons]);

  useEffect(() => {
    if (!subid) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1) Fetch subject name
        const { data: subjectData, error: subjectError } = await supabase
          .from("subjects")
          .select("sub")
          .eq("id", subid)
          .single();
        if (subjectError) throw subjectError;
        setSubjectName(subjectData?.sub ?? "Unknown Subject");

        // 2) Fetch lessons for this subject
        const { data: lessonData, error: lessonError } = await supabase
          .from("lessons")
          .select("*")
          .eq("subject_id", subid);
        if (lessonError) throw lessonError;
        setLessons(lessonData ?? []);

        // 3) Fetch all trials
        const { data: trialData, error: trialError } = await supabase
          .from("trials")
          .select("*");
        if (trialError) throw trialError;
        setTrials(trialData ?? []);

        // 4) Fetch achievements (for HD Achv Id select) with filter on subject_id
        const { data: achievementData, error: achievementError } = await supabase
          .from("achievements")
          .select("*")
          .eq("subject_id", subid);
        if (achievementError) throw achievementError;
        setAchievements(achievementData ?? []);
      } catch (err) {
        console.error("Error loading page data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [subid]);

  const groupedByQuarter: Record<string, Lesson[]> = {};
  lessons.forEach((lesson) => {
    const q = lesson.quarter || "Unknown";
    if (!groupedByQuarter[q]) groupedByQuarter[q] = [];
    groupedByQuarter[q].push(lesson);
  });
  const quarters = Object.keys(groupedByQuarter).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  const handleAddLessonClick = () => {
    setCreateFormData({
      lesson_title: "",
      description: "",
      lesson_no: "",
      level_req: 0,
      quarter: "",
      status: "Locked",
      unlocked_by: ""
    });
    setOpenCreateDialog(true);
  };

  const handleCreateFormChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setCreateFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCreateSelectChange = (e: SelectChangeEvent<string>) => {
    const name = e.target.name as string;
    setCreateFormData(prev => ({ ...prev, [name]: e.target.value }));
  };

  const handleCreateFormSubmit = async () => {
    if (isSubmitting) return; // Prevent double submission
    setIsSubmitting(true);
    try {
      const payload = {
        subject_id: subid,
        lesson_title: createFormData.lesson_title!,
        description: createFormData.description!,
        lesson_no: createFormData.lesson_no!,
        level_req: Number(createFormData.level_req),
        quarter: createFormData.quarter!,
        status: createFormData.status!,
        unlocked_by: createFormData.unlocked_by || null
      };

      const { data, error } = await supabase
        .from("lessons")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      // Append the newly created lesson into state
      setLessons(prev => [...prev, data as Lesson]);
      setOpenCreateDialog(false);
      setSnackbar({ open: true, message: "Lesson created successfully!", severity: "success" });
    } catch (err) {
      console.error("Error creating lesson:", err);
      setSnackbar({ open: true, message: "Error creating lesson.", severity: "error" });
    } finally {
      setIsSubmitting(false); // Reset submission state
    }
  };

  // Lesson Edit Handlers
  const handleEditClick = (lesson: Lesson) => {
    setCurrentLesson(lesson);
    // Pre-populate formData with current lesson values.
    setFormData({
      lesson_title: lesson.lesson_title,
      description: lesson.description,
      status: lesson.status,
      level_req: lesson.level_req || 0,
      lesson_no: lesson.lesson_no,
      unlocked_by: lesson.unlocked_by || "",
      quarter: lesson.quarter
    });
    setOpenEditDialog(true);
  };

  const handleFormChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const name = e.target.name as string;
    setFormData((prev) => ({
      ...prev,
      [name]: e.target.value
    }));
  };

  // Submit updated lesson data
  const handleFormSubmit = async () => {
    if (!currentLesson) return;
    try {
      const payload = {
        lesson_title: formData.lesson_title ?? "",
        description: formData.description ?? "",
        status: formData.status ?? "",
        level_req: Number(formData.level_req),
        lesson_no: formData.lesson_no ?? "",
        quarter: formData.quarter ?? "",
        unlocked_by: formData.unlocked_by || null
      };

      const { error } = await supabase
        .from("lessons")
        .update(payload)
        .eq("id", currentLesson.id);

      if (error) throw error;

      setLessons((prevLessons) =>
        prevLessons.map((lesson) =>
          lesson.id === currentLesson.id ? { ...lesson, ...payload } : lesson
        )
      );
      setOpenEditDialog(false);
      setCurrentLesson(null);
      setSnackbar({ open: true, message: "Lesson updated successfully!", severity: "success" });
    } catch (err) {
      console.error("Error updating lesson:", err);
      setSnackbar({ open: true, message: "Error updating lesson.", severity: "error" });
    }
  };

  // Trial Edit Handlers
  const handleTrialEditClick = async (trial: Trial) => {
    setCurrentTrial(trial);
    setIsDeleting(false); // Reset deleting state
    setHasQuestions(false); // Reset hasQuestions state
  
    // Pre-check if the trial has associated questions
    try {
      const { count, error } = await supabase
        .from("questions")
        .select("id", { count: "exact" })
        .eq("trial_id", trial.id);
  
      if (error) throw error;
      setHasQuestions((count ?? 0) > 0);
    } catch (err) {
      console.error("Error pre-checking questions for trial:", err);
    }
  
    // Pre-populate trialFormData, converting numeric values to strings.
    setTrialFormData({
      trial_title: trial.trial_title,
      allscore:
        trial.allscore !== null && trial.allscore !== undefined
          ? trial.allscore.toString()
          : "",
      time:
        trial.time !== null && trial.time !== undefined
          ? trial.time.toString()
          : "",
      exp_gain:
        trial.exp_gain !== null && trial.exp_gain !== undefined
          ? trial.exp_gain.toString()
          : "",
      first_exp:
        trial.first_exp !== null && trial.first_exp !== undefined
          ? trial.first_exp.toString()
          : "",
      hd_condition: trial.hd_condition ?? "",
      hd_achv_id:
        trial.hd_achv_id !== null && trial.hd_achv_id !== undefined
          ? trial.hd_achv_id.toString()
          : "",
      qcount:
        trial.qcount !== null && trial.qcount !== undefined
          ? trial.qcount.toString()
          : ""
    });
    setOpenTrialEditDialog(true);
  };

  const handleTrialFormChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setTrialFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleTrialSelectChange = (e: SelectChangeEvent<string>) => {
    const name = e.target.name as string;
    setTrialFormData((prev) => ({
      ...prev,
      [name]: e.target.value
    }));
  };

  // Submit updated trial data
  const handleTrialFormSubmit = async () => {
    if (!currentTrial) return;
    setIsSubmitting(true);
    try {
      const payload = {
        trial_title: trialFormData.trial_title,
        allscore: Number(trialFormData.allscore),
        time: Number(trialFormData.time),
        exp_gain: Number(trialFormData.exp_gain),
        first_exp: Number(trialFormData.first_exp),
        hd_condition: trialFormData.hd_condition,
        hd_achv_id: trialFormData.hd_achv_id ? Number(trialFormData.hd_achv_id) : null,
        qcount: Number(trialFormData.qcount),
      };

      const { error } = await supabase
        .from("trials")
        .update(payload)
        .eq("id", currentTrial.id);

      if (error) throw error;

      setTrials((prevTrials) =>
        prevTrials.map((trial) =>
          trial.id === currentTrial.id ? { ...trial, ...payload } : trial
        )
      );
      setOpenTrialEditDialog(false);
      setCurrentTrial(null);
      setSnackbar({ open: true, message: "Trial updated successfully!", severity: "success" });
    } catch (err) {
      console.error("Error updating trial:", err);
      setSnackbar({ open: true, message: "Error updating trial.", severity: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTrialClick = (lesson: Lesson) => {
    setCurrentLessonForTrialCreate(lesson);
    setTrialCreateFormData({
      trial_title: "",
      allscore: "",
      time: "",
      exp_gain: "",
      first_exp: "",
      hd_condition: "",
      hd_achv_id: "",
      qcount: ""
    });
    setOpenTrialCreateDialog(true);
  };

  const handleTrialCreateFormChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setTrialCreateFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleTrialCreateSelectChange = (e: SelectChangeEvent<string>) => {
    const name = e.target.name as string;
    setTrialCreateFormData((prev) => ({
      ...prev,
      [name]: e.target.value
    }));
  };

  // Submit new trial data.
  const handleTrialCreateSubmit = async () => {
    if (isSubmitting) return; // Prevent double submission
    setIsSubmitting(true);
    if (!currentLessonForTrialCreate) return;

    // Validate inputs
    const errors: Partial<TrialFormData> = {};
    if (!trialCreateFormData.trial_title.trim()) errors.trial_title = "Quiz Title is required.";
    if (!trialCreateFormData.allscore.trim()) errors.allscore = "Allscore is required.";
    if (!trialCreateFormData.time.trim()) errors.time = "Time is required.";
    if (!trialCreateFormData.exp_gain.trim()) errors.exp_gain = "Exp Gain is required.";
    if (!trialCreateFormData.first_exp.trim()) errors.first_exp = "First Exp is required.";
    if (!trialCreateFormData.qcount.trim()) errors.qcount = "Qcount is required.";

    setAddQuizErrors(errors);

    if (Object.keys(errors).length > 0) return; // Stop submission if there are errors

    try {
      // Compute new id based on the current trials.
      const currentIds = trials.map((t) => Number(t.id)).filter((num) => !isNaN(num));
      const newId = currentIds.length > 0 ? Math.max(...currentIds) + 1 : 1;

      const payload = {
        id: newId.toString(),
        lesson_id: currentLessonForTrialCreate.id,
        trial_title: trialCreateFormData.trial_title,
        allscore: Number(trialCreateFormData.allscore),
        time: Number(trialCreateFormData.time),
        exp_gain: Number(trialCreateFormData.exp_gain),
        first_exp: Number(trialCreateFormData.first_exp),
        hd_condition: trialCreateFormData.hd_condition,
        hd_achv_id: trialCreateFormData.hd_achv_id ? Number(trialCreateFormData.hd_achv_id) : null,
        qcount: Number(trialCreateFormData.qcount)
      };

      const { data, error } = await supabase
        .from("trials")
        .insert(payload)
        .select(); // Returning the inserted record

      if (error) throw error;
      // Append the new trial to the trials state
      setTrials((prevTrials) => [...prevTrials, ...(data as Trial[])]);
      setOpenTrialCreateDialog(false);
      setCurrentLessonForTrialCreate(null);
      setAddQuizErrors({}); // Clear errors on successful submission
    } catch (err) {
      console.error("Error creating trial:", err);
    } finally {
      setIsSubmitting(false); // Reset submission state
    }
  };

  // Filter trials for the lesson row's Unlocked By select.
  const unlockedByOptions = trials.filter((trial) => {
    const isAssociatedWithSubject = lessons.some(lesson => lesson.id === trial.lesson_id);
    const isNotCurrentLesson = !currentLesson || trial.lesson_id !== currentLesson.id;
    return isAssociatedWithSubject && isNotCurrentLesson;
  });
  const sortedUnlockedByOptions = [...unlockedByOptions].sort((a, b) => {
    return parseInt(a.id) - parseInt(b.id);
  });

  // Filter achievements for "Add Quiz" to exclude those already associated with a quiz
  const availableAchievementsForAdd = achievements.filter(
    (achv) => !trials.some((trial) => trial.hd_achv_id === achv.id)
  );

  const availableAchievementsForEdit = (currentTrial: Trial | null) =>
    achievements.filter(
      (achv) =>
        achv.id === currentTrial?.hd_achv_id || // Include the current achievement
        !trials.some((trial) => trial.hd_achv_id === achv.id) // Or achievements not associated with any quiz
    );

  const handleQuarterPageChange = (quarter: string, newPage: number) => {
    setPagination(prev => ({ ...prev, [quarter]: newPage }));
  };

  useEffect(() => {
    const checkQuestions = async () => {
      if (!currentTrial) {
        setHasQuestions(false); // Reset state if no trial is selected
        return;
      }
      try {
        const { count, error } = await supabase
          .from("questions")
          .select("id", { count: "exact" })
          .eq("trial_id", currentTrial.id);

        if (error) throw error;
        setHasQuestions((count ?? 0) > 0);
      } catch (err) {
        console.error("Error checking questions:", err);
        setHasQuestions(false); // Reset state on error
      }
    };

    checkQuestions();
  }, [currentTrial]);

  const handleDeleteTrial = async () => {
    if (!currentTrial) return;

    setIsDeleting(true);
    try {
      // Delete associated data in trial_data
      const { error: trialDataError } = await supabase
        .from("trial_data")
        .delete()
        .eq("trial_id", currentTrial.id);

      if (trialDataError) throw trialDataError;

      // Delete the trial itself
      const { error: trialError } = await supabase
        .from("trials")
        .delete()
        .eq("id", currentTrial.id);

      if (trialError) throw trialError;

      setTrials((prevTrials) => prevTrials.filter((trial) => trial.id !== currentTrial.id));
      setOpenTrialEditDialog(false);
      setCurrentTrial(null);
      setSnackbar({ open: true, message: "Trial and associated data deleted successfully!", severity: "success" });
    } catch (err) {
      console.error("Error deleting trial or associated data:", err);
      setSnackbar({ open: true, message: "Error deleting trial or associated data.", severity: "error" });
    } finally {
      setIsDeleting(false);
      handleCloseDeleteDialog();
    }
  };

  const [hdConditionInfoOpen, setHdConditionInfoOpen] = useState(false);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        mb: 4,
        p: 2,
        bgcolor: blue[50],
        borderRadius: 2
      }}
    >
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {subjectName}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Lessons &amp; Quizzes
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddLessonClick}
          sx={{ textTransform: "none" }}
        >
          Add Lesson
        </Button>
        <Button
          variant="contained"
          onClick={() => router.push(`/adminhome/subjects/${subid}/achievements`)}
          sx={{ textTransform: "none" }}
        >
          Achievements
        </Button>
      </Box>
    </Box>

      {/* For each quarter, render a table with pagination */}
      {quarters.map((quarter) => {
        // Get lessons for this quarter and sort them
        const lessonsInQuarter = groupedByQuarter[quarter].sort(
          (a, b) => parseFloat(a.lesson_no) - parseFloat(b.lesson_no)
        );
        // Pagination: default current page is 1.
        const currentPage = pagination[quarter] || 1;
        const rowsPerPage = 10;
        const totalPages = Math.ceil(lessonsInQuarter.length / rowsPerPage);

        // Compute sliding window of 5 pages.
        // If (currentPage + 4) exceeds totalPages, shift the window backward.
        const startPage =
          currentPage + 4 > totalPages ? Math.max(1, totalPages - 4) : currentPage;
        const endPage = Math.min(totalPages, startPage + 4);

        const displayedLessons = lessonsInQuarter.slice(
          (currentPage - 1) * rowsPerPage,
          currentPage * rowsPerPage
        );

        return (
          <Box key={quarter} sx={{ mb: 6 }}>
            <Typography variant="h5" sx={{ mb: 2, color: theme.palette.primary.dark }}>
              Quarter {quarter}
            </Typography>
            <TableContainer component={Paper} elevation={3}>
              <Table
                stickyHeader
                sx={{
                  minWidth: 650,
                  "& .MuiTableRow-root:nth-of-type(odd)": {
                    backgroundColor: grey[100],
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: grey[200], fontWeight: "bold" }}>No.</TableCell>
                    <TableCell><strong>Title</strong></TableCell>
                    {!isMobile && <TableCell><strong>Description</strong></TableCell>}
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Quiz</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedLessons.map((lesson) => {
                    const lessonTrial = trials.find((t) => t.lesson_id === lesson.id);
                    return (
                        <TableRow key={lesson.id} hover>
                        <TableCell sx={{ bgcolor: grey[100], fontWeight: "bold" }}>{lesson.lesson_no}</TableCell>
                        <TableCell>
                          <Typography noWrap>{lesson.lesson_title}</Typography>
                        </TableCell>
                        {!isMobile && (
                          <TableCell>
                          <Tooltip title={lesson.description}>
                            <Typography noWrap sx={{ maxWidth: 200, cursor: "help" }}>
                            {lesson.description}
                            </Typography>
                          </Tooltip>
                          </TableCell>
                        )}
                        <TableCell>{lesson.status}</TableCell>
                        <TableCell>
                          {lessonTrial
                          ? `${lessonTrial.trial_title} (${lessonTrial.id})`
                          : "—"}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                          size="small"
                          startIcon={<OpenInNewIcon />}
                          onClick={() =>
                            router.push(`/adminhome/subjects/${subid}/lescontent/${lesson.id}`)
                          }
                          sx={{ textTransform: "none", mr: 1 }}
                          >
                          Lesson Content
                          </Button>
                          {lessonTrial ? (
                          <>
                            <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleTrialEditClick(lessonTrial)}
                            sx={{ textTransform: "none", mr: 1 }}
                            >
                            Edit Quiz
                            </Button>
                          </>
                          ) : (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleAddTrialClick(lesson)}
                            sx={{ textTransform: "none", mr: 1 }}
                          >
                            Add Quiz
                          </Button>
                          )}
                          <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleEditClick(lesson)}
                          sx={{ textTransform: "none", mr: 1 }}
                          >
                          Edit Lesson
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleOpenDeleteLessonDialog(lesson)}
                            disabled={!isLessonDeletable[lesson.id]} // Disable if not deletable
                            sx={{ textTransform: "none" }}
                          >
                            Delete
                          </Button>
                        </TableCell>
                        </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {/* Pagination Controls */}
            <Box display="flex" justifyContent="center" alignItems="center" mt={2} gap={1}>
              <Button
                disabled={currentPage === 1}
                onClick={() => handleQuarterPageChange(quarter, currentPage - 1)}
              >
                {"<"}
              </Button>
              {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((p) => (
                <Button
                  key={p}
                  variant={p === currentPage ? "contained" : "outlined"}
                  onClick={() => handleQuarterPageChange(quarter, p)}
                >
                  {p}
                </Button>
              ))}
              <Button
                disabled={currentPage === totalPages}
                onClick={() => handleQuarterPageChange(quarter, currentPage + 1)}
              >
                {">"}
              </Button>
            </Box>
          </Box>
        );
      })}

      {/* Lesson Edit Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: blue[50] }}>Edit Lesson</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Lesson No"
            name="lesson_no"
            type="number"
            value={formData.lesson_no || ""}
            onChange={handleFormChange}
            fullWidth
            inputProps={{ min: 1 }}
            sx={{ mt: 2 }}  // added margin top
          />
          <TextField
            label="Lesson Title"
            name="lesson_title"
            value={formData.lesson_title || ""}
            onChange={handleFormChange}
            fullWidth
          />
          <TextField
            label="Description"
            name="description"
            value={formData.description || ""}
            onChange={handleFormChange}
            fullWidth
            multiline
            rows={3}
          />
          <TextField
            label="Level Req"
            name="level_req"
            type="number"
            value={formData.level_req || 0}
            onChange={handleFormChange}
            fullWidth
          />
          <TextField
            label="Quarter"
            name="quarter"
            type="number"
            value={formData.quarter || ""}
            onChange={handleFormChange}
            fullWidth
            inputProps={{ min: 1 }}
          />
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              name="status"
              value={formData.status || ""}
              label="Status"
              onChange={handleSelectChange}
            >
              <MenuItem value="Locked">Locked</MenuItem>
              <MenuItem value="Opened">Opened</MenuItem>
              <MenuItem value="Final">Final</MenuItem>
            </Select>
          </FormControl>
          {formData.status !== "Opened" && ( // Hide "Unlocked By" when status is "Opened"
            <FormControl fullWidth>
              <InputLabel>Unlocked By</InputLabel>
              <Select
                name="unlocked_by"
                value={formData.unlocked_by || ""}
                label="Unlocked By"
                onChange={handleSelectChange}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {sortedUnlockedByOptions.map((trial) => (
                  <MenuItem key={trial.id} value={trial.id}>
                    {trial.trial_title} ({trial.id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: blue[50] }}>
          <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleFormSubmit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Trial Edit Dialog */}
      <Dialog open={openTrialEditDialog} onClose={() => setOpenTrialEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: blue[50] }}>
          Edit Quiz
          <Button
            variant="contained"
            color="secondary"
            onClick={() =>
              router.push(`/adminhome/subjects/${subid}/${currentTrial?.id}`)
            }
            sx={{ textTransform: "none" }}
          >
            Quiz Questions
          </Button>
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Quiz Title"
            name="trial_title"
            value={trialFormData.trial_title}
            onChange={handleTrialFormChange}
            fullWidth
            sx={{ mt: 2 }}  // added margin top
          />
          <TextField
            label="Quiz Overall Score"
            name="allscore"
            type="number"
            value={trialFormData.allscore}
            onChange={handleTrialFormChange}
            fullWidth
          />
          <TextField
            label="Time"
            name="time"
            type="number"
            value={trialFormData.time}
            onChange={handleTrialFormChange}
            fullWidth
            helperText="Input is in seconds (number only)"
          />
          <TextField
            label="Normal Attempt Exp Gain"
            name="exp_gain"
            type="number"
            value={trialFormData.exp_gain}
            onChange={handleTrialFormChange}
            fullWidth
          />
          <TextField
            label="First Attempt Exp Gain"
            name="first_exp"
            type="number"
            value={trialFormData.first_exp}
            onChange={handleTrialFormChange}
            fullWidth
          />
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
            <TextField
              label="Hidden Achievement Condition"
              name="hd_condition"
              value={trialFormData.hd_condition}
              onChange={handleTrialFormChange}
              fullWidth
              multiline
              rows={3}
              helperText={`Example:
(() => {
  return (score === allScoreVal) && (attemptCount === 1);
})()`}
            />
            <IconButton onClick={() => setHdConditionInfoOpen(true)} sx={{ mt: 1 }}>
              <InfoIcon />
            </IconButton>
          </Box>
          <FormControl fullWidth>
            <InputLabel>Hidden Achievement</InputLabel>
            <Select
              name="hd_achv_id"
              value={trialFormData.hd_achv_id}
              label="Hidden Achievement"
              onChange={handleTrialSelectChange}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {availableAchievementsForEdit(currentTrial).map((achv) => (
                <MenuItem key={achv.id} value={achv.id.toString()}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <img
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/achivements/${achv.image}`}
                      alt={achv.name}
                      style={{ width: 24, height: 24 }}
                    />
                    {achv.name} ({achv.id})
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Amount of Questions"
            name="qcount"
            type="number"
            value={trialFormData.qcount}
            onChange={handleTrialFormChange}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ bgcolor: blue[50] }}>
          <Button onClick={() => setOpenTrialEditDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleOpenDeleteDialog}
            disabled={hasQuestions || isDeleting} // Ensure correct disabled state
          >
            Delete
          </Button>
          <Button variant="contained" onClick={handleTrialFormSubmit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle sx={{ bgcolor: blue[50] }}>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this trial? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ bgcolor: blue[50] }}>
          <Button onClick={handleCloseDeleteDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteTrial} color="error" disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Trial Create Dialog */}
      <Dialog open={openTrialCreateDialog} onClose={() => setOpenTrialCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: blue[50] }}>Add Quiz</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Quiz Title"
            name="trial_title"
            value={trialCreateFormData.trial_title}
            onChange={handleTrialCreateFormChange}
            fullWidth
            error={!!addQuizErrors.trial_title}
            helperText={addQuizErrors.trial_title}
            sx={{ mt: 2 }}  // added margin top
          />
          <TextField
            label="Quiz Overall Score"
            name="allscore"
            type="number"
            value={trialCreateFormData.allscore}
            onChange={handleTrialCreateFormChange}
            fullWidth
            error={!!addQuizErrors.allscore}
            helperText={addQuizErrors.allscore}
          />
          <TextField
            label="Time"
            name="time"
            type="number"
            value={trialCreateFormData.time}
            onChange={handleTrialCreateFormChange}
            fullWidth
            helperText={addQuizErrors.time || "Input is in seconds (number only)"}
            error={!!addQuizErrors.time}
          />
          <TextField
            label="Normal Attempt Exp Gain"
            name="exp_gain"
            type="number"
            value={trialCreateFormData.exp_gain}
            onChange={handleTrialCreateFormChange}
            fullWidth
            error={!!addQuizErrors.exp_gain}
            helperText={addQuizErrors.exp_gain}
          />
          <TextField
            label="First Attempt Exp Gain"
            name="first_exp"
            type="number"
            value={trialCreateFormData.first_exp}
            onChange={handleTrialCreateFormChange}
            fullWidth
            error={!!addQuizErrors.first_exp}
            helperText={addQuizErrors.first_exp}
          />
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
            <TextField
              label="Hidden Achievement Condition"
              name="hd_condition"
              value={trialCreateFormData.hd_condition}
              onChange={handleTrialCreateFormChange}
              fullWidth
              multiline
              rows={3}
              helperText={`Example:
(() => {
  return (score === allScoreVal) && (attemptCount === 1);
})()`}
            />
            <IconButton onClick={() => setHdConditionInfoOpen(true)} sx={{ mt: 1 }}>
              <InfoIcon />
            </IconButton>
          </Box>
          <FormControl fullWidth error={!!addQuizErrors.hd_achv_id}>
            <InputLabel>Hidden Achievement</InputLabel>
            <Select
              name="hd_achv_id"
              value={trialCreateFormData.hd_achv_id}
              label="Hidden Achievement"
              onChange={handleTrialCreateSelectChange}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {availableAchievementsForAdd.map((achv) => (
                <MenuItem key={achv.id} value={achv.id.toString()}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <img
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/achivements/${achv.image}`}
                      alt={achv.name}
                      style={{ width: 24, height: 24 }}
                    />
                    {achv.name} ({achv.id})
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {addQuizErrors.hd_achv_id && <Typography color="error">{addQuizErrors.hd_achv_id}</Typography>}
          </FormControl>
          <TextField
            label="Amount of Questions"
            name="qcount"
            type="number"
            value={trialCreateFormData.qcount}
            onChange={handleTrialCreateFormChange}
            fullWidth
            error={!!addQuizErrors.qcount}
            helperText={addQuizErrors.qcount}
          />
        </DialogContent>
        <DialogActions sx={{ bgcolor: blue[50] }}>
          <Button onClick={() => setOpenTrialCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleTrialCreateSubmit} disabled={isSubmitting}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

 {/* ── Create Lesson Dialog ───────────────────────────────────────────────────── */}
      <Dialog
        open={openCreateDialog}
        onClose={() => setOpenCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: blue[50] }}>Add Lesson</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Lesson No"
            name="lesson_no"
            type="number"
            value={createFormData.lesson_no}
            onChange={handleCreateFormChange}
            fullWidth
            inputProps={{ min: 1 }}
            sx={{ mt: 2 }}  // added margin top
          />
          <TextField
            label="Lesson Title"
            name="lesson_title"
            value={createFormData.lesson_title}
            onChange={handleCreateFormChange}
            fullWidth
          />
          <TextField
            label="Description"
            name="description"
            value={createFormData.description}
            onChange={handleCreateFormChange}
            fullWidth
            multiline
            rows={3}
          />
          <TextField
            label="Level Req"
            name="level_req"
            type="number"
            value={createFormData.level_req}
            onChange={handleCreateFormChange}
            fullWidth
          />
          <TextField
            label="Quarter"
            name="quarter"
            type="number"
            value={createFormData.quarter}
            onChange={handleCreateFormChange}
            fullWidth
            inputProps={{ min: 1 }}
          />
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              name="status"
              value={createFormData.status}
              label="Status"
              onChange={handleCreateSelectChange}
            >
              <MenuItem value="Locked">Locked</MenuItem>
              <MenuItem value="Opened">Opened</MenuItem>
              <MenuItem value="Final">Final</MenuItem>
            </Select>
          </FormControl>
          {createFormData.status !== "Opened" && ( // Hide "Unlocked By" when status is "Opened"
            <FormControl fullWidth>
              <InputLabel>Unlocked By</InputLabel>
              <Select
                name="unlocked_by"
                value={createFormData.unlocked_by || ""}
                label="Unlocked By"
                onChange={handleCreateSelectChange}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {sortedUnlockedByOptions.map((trial) => (
                  <MenuItem key={trial.id} value={trial.id}>
                    {trial.trial_title} ({trial.id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: blue[50] }}>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateFormSubmit} disabled={isSubmitting}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Delete Lesson Confirmation Dialog */}
      <Dialog open={deleteLessonDialogOpen} onClose={handleCloseDeleteLessonDialog}>
        <DialogTitle sx={{ bgcolor: blue[50] }}>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this lesson? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ bgcolor: blue[50] }}>
          <Button onClick={handleCloseDeleteLessonDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteLesson} color="error" disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* HD Condition Info Dialog */}
      <Dialog open={hdConditionInfoOpen} onClose={() => setHdConditionInfoOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: blue[50] }}>HD Condition Info</DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography>
            Use this function to determine eligibility for a hidden achievement in your quiz.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Available variables in your function:
            <br/><br/>
            "score" = Student's achieved score
            <br/>
            "timeRemaining" = Time left when the quiz finishes
            <br/>
            "timeAllocated" = Total time allocated for the quiz
            <br/>
            "allScoreVal" = Maximum possible score for the quiz
            <br/>
            "attemptCount" = Number of attempts made by the student
            <br/><br/>
            Ensure that your function returns a boolean value. This condition is written in JavaScript.
            <br/>
            Example:
            <br/>
            <code>
              {`(() => {
                return (score === allScoreVal) && (attemptCount === 1);
              })()`}
            </code>
          </Typography>
        </DialogContent>
        <DialogActions sx={{ bgcolor: blue[50] }}>
          <Button onClick={() => setHdConditionInfoOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
