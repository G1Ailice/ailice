"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  Box,
  Container,
  Paper,
  Typography,
  TableContainer,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  useMediaQuery,
  SelectChangeEvent
} from "@mui/material";
import { grey, blue } from "@mui/material/colors";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

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
  subject_id: string; // Make sure your achievements table includes this attribute.
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

  // Group lessons by quarter only
  const groupedByQuarter: Record<string, Lesson[]> = {};
  lessons.forEach((lesson) => {
    const q = lesson.quarter || "Unknown";
    if (!groupedByQuarter[q]) groupedByQuarter[q] = [];
    groupedByQuarter[q].push(lesson);
  });
  const quarters = Object.keys(groupedByQuarter).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  // Handler for opening the Lesson Edit dialog
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
    } catch (err) {
      console.error("Error updating lesson:", err);
    }
  };

  // Handler for opening the Trial Edit dialog
  const handleTrialEditClick = (trial: Trial) => {
    setCurrentTrial(trial);
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

  // Submit updated trial data (convert string inputs to numbers where needed)
  const handleTrialFormSubmit = async () => {
    if (!currentTrial) return;
    try {
      const payload = {
        trial_title: trialFormData.trial_title,
        allscore: Number(trialFormData.allscore),
        time: Number(trialFormData.time),
        exp_gain: Number(trialFormData.exp_gain),
        first_exp: Number(trialFormData.first_exp),
        hd_condition: trialFormData.hd_condition,
        hd_achv_id: trialFormData.hd_achv_id ? Number(trialFormData.hd_achv_id) : null,
        qcount: Number(trialFormData.qcount)
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
    } catch (err) {
      console.error("Error updating trial:", err);
    }
  };

  // ----- Handlers for Creating a New Trial -----
  const handleAddTrialClick = (lesson: Lesson) => {
    setCurrentLessonForTrialCreate(lesson);
    // Reset/create the form data when adding a new trial
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
  // A new trial id is computed as one plus the maximum numeric id found in trials.
  const handleTrialCreateSubmit = async () => {
    if (!currentLessonForTrialCreate) return;
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
    } catch (err) {
      console.error("Error creating trial:", err);
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
      <Box sx={{ textAlign: "center", mb: 4, p: 2, bgcolor: blue[50], borderRadius: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {subjectName}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Lessons &amp; Trials
        </Typography>
      </Box>

      {/* For each quarter, render a table */}
      {quarters.map((quarter) => {
        const lessonsInQuarter = groupedByQuarter[quarter].sort(
          (a, b) => parseFloat(a.lesson_no) - parseFloat(b.lesson_no)
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
                    <TableCell><strong>No.</strong></TableCell>
                    <TableCell><strong>Title</strong></TableCell>
                    {!isMobile && <TableCell><strong>Description</strong></TableCell>}
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Trial</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lessonsInQuarter.map((lesson) => {
                    const lessonTrial = trials.find((t) => t.lesson_id === lesson.id);
                    return (
                      <TableRow key={lesson.id} hover>
                        <TableCell>{lesson.lesson_no}</TableCell>
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
                              router.push(`/adminhome/subjects/${subid}/lessons/${lesson.id}`)
                            }
                            sx={{ textTransform: "none", mr: 1 }}
                          >
                            Lesson
                          </Button>
                          {lessonTrial ? (
                            <>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleTrialEditClick(lessonTrial)}
                                sx={{ textTransform: "none", mr: 1 }}
                              >
                                Edit Trial
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                color="secondary"
                                onClick={() =>
                                  router.push(`/adminhome/subjects/${subid}/trialquestions/${lessonTrial.id}`)
                                }
                                sx={{ textTransform: "none", mr: 1 }}
                              >
                                Trial Questions
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleAddTrialClick(lesson)}
                              sx={{ textTransform: "none", mr: 1 }}
                            >
                              Add Trial
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleEditClick(lesson)}
                            sx={{ textTransform: "none" }}
                          >
                            Edit Lesson
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );
      })}

      {/* Lesson Edit Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Lesson</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
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
            label="Lesson No"
            name="lesson_no"
            type="number"
            value={formData.lesson_no || ""}
            onChange={handleFormChange}
            fullWidth
            inputProps={{ min: 1 }}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleFormSubmit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Trial Edit Dialog */}
      <Dialog open={openTrialEditDialog} onClose={() => setOpenTrialEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Trial</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Trial Title"
            name="trial_title"
            value={trialFormData.trial_title}
            onChange={handleTrialFormChange}
            fullWidth
          />
          <TextField
            label="Allscore"
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
            label="Exp Gain"
            name="exp_gain"
            type="number"
            value={trialFormData.exp_gain}
            onChange={handleTrialFormChange}
            fullWidth
          />
          <TextField
            label="First Exp"
            name="first_exp"
            type="number"
            value={trialFormData.first_exp}
            onChange={handleTrialFormChange}
            fullWidth
          />
          <TextField
            label="HD Condition"
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
          <FormControl fullWidth>
            <InputLabel>HD Achv Id</InputLabel>
            <Select
              name="hd_achv_id"
              value={trialFormData.hd_achv_id}
              label="HD Achv Id"
              onChange={handleTrialSelectChange}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {achievements.map((achv) => (
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
            label="Qcount"
            name="qcount"
            type="number"
            value={trialFormData.qcount}
            onChange={handleTrialFormChange}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTrialEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleTrialFormSubmit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Trial Create Dialog */}
      <Dialog open={openTrialCreateDialog} onClose={() => setOpenTrialCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Trial</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Trial Title"
            name="trial_title"
            value={trialCreateFormData.trial_title}
            onChange={handleTrialCreateFormChange}
            fullWidth
          />
          <TextField
            label="Allscore"
            name="allscore"
            type="number"
            value={trialCreateFormData.allscore}
            onChange={handleTrialCreateFormChange}
            fullWidth
          />
          <TextField
            label="Time"
            name="time"
            type="number"
            value={trialCreateFormData.time}
            onChange={handleTrialCreateFormChange}
            fullWidth
            helperText="Input is in seconds (number only)"
          />
          <TextField
            label="Exp Gain"
            name="exp_gain"
            type="number"
            value={trialCreateFormData.exp_gain}
            onChange={handleTrialCreateFormChange}
            fullWidth
          />
          <TextField
            label="First Exp"
            name="first_exp"
            type="number"
            value={trialCreateFormData.first_exp}
            onChange={handleTrialCreateFormChange}
            fullWidth
          />
          <TextField
            label="HD Condition"
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
          <FormControl fullWidth>
            <InputLabel>HD Achv Id</InputLabel>
            <Select
              name="hd_achv_id"
              value={trialCreateFormData.hd_achv_id}
              label="HD Achv Id"
              onChange={handleTrialCreateSelectChange}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {achievements.map((achv) => (
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
            label="Qcount"
            name="qcount"
            type="number"
            value={trialCreateFormData.qcount}
            onChange={handleTrialCreateFormChange}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTrialCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleTrialCreateSubmit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
