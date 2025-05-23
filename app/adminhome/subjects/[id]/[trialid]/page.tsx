"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Grid from "@mui/material/Grid";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

interface Question {
  id: string;
  qcontent: string;
  qtype: "Single" | "Multiple" | "Input";
  qselection: string[];
  qcorrectanswer: string[];
  qpoints: number;
}

const AdminTrialQuestions = () => {
  const { subid, trialid } = useParams();

  // State for questions list
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Dialog state for Add, Edit, View, and Delete operations.
  const [openAddDialog, setOpenAddDialog] = useState<boolean>(false);
  const [openEditDialog, setOpenEditDialog] = useState<boolean>(false);
  const [openViewDialog, setOpenViewDialog] = useState<boolean>(false);
  // State for question deletion confirmation dialog
  const [deleteDialogQuestionOpen, setDeleteDialogQuestionOpen] = useState<boolean>(false);
  // For edit, we store the question being edited.
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  // For view, we store the content to render as HTML.
  const [viewContent, setViewContent] = useState<string>("");

  // For deletion, store the question that is about to be deleted.
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);

  // Form states (used both for adding and editing)
  const [qcontent, setQcontent] = useState<string>("");
  const [qtype, setQtype] = useState<"Single" | "Multiple" | "Input">("Single");
  const [qselection, setQselection] = useState<string[]>([]);
  const [qcorrectanswer, setQcorrectanswer] = useState<string[]>([]);
  const [qpoints, setQpoints] = useState<number>(0);
  const [formError, setFormError] = useState<string>("");

  // Add new state for trial question count
  const [trialQcount, setTrialQcount] = useState<number | null>(null);

  // Add new state for full trial data
  const [trialData, setTrialData] = useState<any>(null); // adjust type if needed

  // Fetch questions from Supabase based on trialid
  const fetchQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("questions")
      .select("id, qcontent, qtype, qselection, qcorrectanswer, qpoints")
      .eq("trial_id", trialid);
    if (error) {
      setError("Error fetching questions.");
    } else if (data) {
      setQuestions(data as Question[]);
      // Calculate the total qpoints from the fetched questions
      const totalPoints = (data as Question[]).reduce((acc, q) => acc + Number(q.qpoints), 0);
      // Update the trial's allscore with the calculated total
      await supabase.from("trials").update({ allscore: totalPoints }).eq("id", trialid);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, [trialid]);

  // Replace the former useEffect that fetched only qcount with one that fetches full trial details
  useEffect(() => {
    const fetchTrialData = async () => {
      const { data, error } = await supabase
        .from("trials")
        .select("*")
        .eq("id", trialid)
        .single();
      if (!error && data) {
        setTrialData(data);
        // Update trialQcount from the fetched trial data
        setTrialQcount(data.qcount);
      }
    };
    if(trialid){
      fetchTrialData();
    }
  }, [trialid]);

  // Reset dialog form state
  const resetForm = () => {
    setQcontent("");
    setQtype("Single");
    setQselection([]);
    setQcorrectanswer([]);
    setQpoints(0);
    setFormError("");
  };

  // Open Add Question Dialog
  const handleAddOpen = () => {
    resetForm();
    setOpenAddDialog(true);
  };

  // Open Edit Question Dialog and prefill form
  const handleEditOpen = (question: Question) => {
    setEditingQuestion(question);
    setQcontent(question.qcontent);
    setQtype(question.qtype);
    setQselection(question.qselection || []);
    setQcorrectanswer(question.qcorrectanswer || []);
    setQpoints(question.qpoints);
    setFormError("");
    setOpenEditDialog(true);
  };

  // Open View Dialog with dangerously rendered HTML
  const handleViewOpen = (question: Question) => {
    setViewContent(question.qcontent);
    setOpenViewDialog(true);
  };

  // Open Delete Confirmation for a question
  const handleDeleteOpen = (question: Question) => {
    setQuestionToDelete(question);
    setDeleteDialogQuestionOpen(true);
  };

  // Validate required fields before adding or editing a question
  const validateForm = (): boolean => {
    if (!qcontent.trim()) {
      setFormError("Question content is required.");
      return false;
    }
    if (qtype !== "Input" && (qselection.length === 0 || qselection.some(s => !s.trim()))) {
      setFormError("At least one valid selection is required for this type.");
      return false;
    }
    if (qcorrectanswer.length === 0 || qcorrectanswer.some(a => !a.trim())) {
      setFormError("At least one valid correct answer is required.");
      return false;
    }
    if (!qpoints || qpoints <= 0) {
      setFormError("Points must be greater than zero.");
      return false;
    }
    setFormError("");
    return true;
  };

  // Handle adding a new question to the database
  const handleAddQuestion = async () => {
    if (!validateForm()) return;

    const { error } = await supabase.from("questions").insert([
      {
        trial_id: trialid,
        qcontent,
        qtype,
        // For Input type, ignore selections
        qselection: qtype === "Input" ? [] : qselection,
        qcorrectanswer,
        qpoints,
      },
    ]);
    if (error) {
      setError("Error adding question.");
    } else {
      fetchQuestions();
      setOpenAddDialog(false);
    }
  };

  // Handle editing an existing question record
  const handleEditQuestion = async () => {
    if (!editingQuestion) return;
    if (!validateForm()) return;

    const { error } = await supabase
      .from("questions")
      .update({
        qcontent,
        qtype,
        qselection: qtype === "Input" ? [] : qselection,
        qcorrectanswer,
        qpoints,
      })
      .eq("id", editingQuestion.id);
    if (error) {
      setError("Error updating question.");
    } else {
      fetchQuestions();
      setOpenEditDialog(false);
      setEditingQuestion(null);
    }
  };

  // Confirm deletion of a question
  const confirmDeleteQuestion = async () => {
    if (!questionToDelete) return;
    const { error } = await supabase
      .from("questions")
      .delete()
      .eq("id", questionToDelete.id);
    if (error) {
      setError("Error deleting question.");
    } else {
      fetchQuestions();
    }
    setDeleteDialogQuestionOpen(false);
    setQuestionToDelete(null);
  };

  // Functions to add new input to qselection or qcorrectanswer arrays
  const addQSelection = () => {
    setQselection((prev) => [...prev, ""]);
  };

  const addQCorrectAnswer = () => {
    setQcorrectanswer((prev) => [...prev, ""]);
  };

  // Functions to update individual inputs in the arrays
  const handleQSelectionChange = (index: number, value: string) => {
    const newArr = [...qselection];
    newArr[index] = value;
    setQselection(newArr);
  };

  const handleQCorrectAnswerChange = (index: number, value: string) => {
    const newArr = [...qcorrectanswer];
    newArr[index] = value;
    setQcorrectanswer(newArr);
  };

  // Functions to remove inputs from the dynamic arrays
  const removeQSelection = (index: number) => {
    setQselection((prev) => prev.filter((_, i) => i !== index));
  };

  const removeQCorrectAnswer = (index: number) => {
    setQcorrectanswer((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading || trialQcount === null) {
    return (
      <Container
        maxWidth="sm"
        sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}
      >
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box mb={2}>
        {trialData && (
          <Box mb={2}>
            <Typography variant="h6">
              Trial: {trialData.trial_title}
            </Typography>
            <Typography variant="body2">
              Time: {trialData.time} seconds | Overall Score: {trialData.allscore} | Questions Allowed: {trialData.qcount}
            </Typography>
          </Box>
        )}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h4">Questions for Trial {trialid}</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddOpen}
            disabled={trialQcount !== null && questions.length >= trialQcount}
          >
            Add Question
          </Button>
        </Box>
        {trialQcount !== null && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            {questions.length} / {trialQcount} questions added
          </Typography>
        )}
      </Box>
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: "auto", maxWidth: "100%" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    maxWidth: 300,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  Question Content
                </TableCell>
                <TableCell>Question Type</TableCell>
                <TableCell
                  sx={{
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  Selections
                </TableCell>
                <TableCell
                  sx={{
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  Correct Answers
                </TableCell>
                <TableCell align="right">Points</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {questions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell
                    sx={{
                      maxWidth: 300,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {q.qcontent.replace(/<[^>]+>/g, "").slice(0, 60)}…
                  </TableCell>
                  <TableCell>{q.qtype}</TableCell>
                  <TableCell
                    sx={{
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(q.qselection || []).join(", ")}
                  </TableCell>
                  <TableCell
                    sx={{
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(q.qcorrectanswer || []).join(", ")}
                  </TableCell>
                  <TableCell align="right">{q.qpoints}</TableCell>
                  <TableCell align="center">
                    <IconButton color="primary" onClick={() => handleViewOpen(q)}>
                      <VisibilityIcon />
                    </IconButton>
                    <IconButton color="primary" onClick={() => handleEditOpen(q)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDeleteOpen(q)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Question Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add New Question</DialogTitle>
        <DialogContent dividers>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <TextField
            label="Question Content"
            fullWidth
            multiline
            margin="normal"
            value={qcontent}
            onChange={(e) => setQcontent(e.target.value)}
          />
          <TextField
            select
            label="Question Type"
            fullWidth
            margin="normal"
            value={qtype}
            onChange={(e) => setQtype(e.target.value as "Single" | "Multiple" | "Input")}
          >
            <MenuItem value="Single">Single</MenuItem>
            <MenuItem value="Multiple">Multiple</MenuItem>
            <MenuItem value="Input">Input</MenuItem>
          </TextField>
          {qtype !== "Input" && (
            <Box mt={2}>
              <Typography variant="subtitle1">Selections</Typography>
              {qselection.map((sel, index) => (
                <Grid container spacing={1} alignItems="center" key={index} sx={{ mt: 1 }}>
                  <Grid item xs={10}>
                    <TextField
                      label={`Selection ${index + 1}`}
                      fullWidth
                      value={sel}
                      onChange={(e) => handleQSelectionChange(index, e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <IconButton color="error" onClick={() => removeQSelection(index)}>
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
              <Button startIcon={<AddIcon />} onClick={addQSelection} sx={{ mt: 1 }}>
                Add Selection
              </Button>
            </Box>
          )}
          <Box mt={2}>
            <Typography variant="subtitle1">Correct Answers</Typography>
            {qcorrectanswer.map((ans, index) => (
              <Grid container spacing={1} alignItems="center" key={index} sx={{ mt: 1 }}>
                <Grid item xs={10}>
                  <TextField
                    label={`Correct Answer ${index + 1}`}
                    fullWidth
                    value={ans}
                    onChange={(e) => handleQCorrectAnswerChange(index, e.target.value)}
                  />
                </Grid>
                <Grid item xs={2}>
                  <IconButton color="error" onClick={() => removeQCorrectAnswer(index)}>
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Button startIcon={<AddIcon />} onClick={addQCorrectAnswer} sx={{ mt: 1 }}>
              Add Correct Answer
            </Button>
          </Box>
          <TextField
            label="Points"
            type="number"
            fullWidth
            margin="normal"
            value={qpoints}
            onChange={(e) => setQpoints(Number(e.target.value))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddQuestion}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Question</DialogTitle>
        <DialogContent dividers>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <TextField
            label="Question Content"
            fullWidth
            multiline
            margin="normal"
            value={qcontent}
            onChange={(e) => setQcontent(e.target.value)}
          />
          <TextField
            select
            label="Question Type"
            fullWidth
            margin="normal"
            value={qtype}
            onChange={(e) => setQtype(e.target.value as "Single" | "Multiple" | "Input")}
          >
            <MenuItem value="Single">Single</MenuItem>
            <MenuItem value="Multiple">Multiple</MenuItem>
            <MenuItem value="Input">Input</MenuItem>
          </TextField>
          {qtype !== "Input" && (
            <Box mt={2}>
              <Typography variant="subtitle1">Selections</Typography>
              {qselection.map((sel, index) => (
                <Grid container spacing={1} alignItems="center" key={index} sx={{ mt: 1 }}>
                  <Grid item xs={10}>
                    <TextField
                      label={`Selection ${index + 1}`}
                      fullWidth
                      value={sel}
                      onChange={(e) => handleQSelectionChange(index, e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <IconButton color="error" onClick={() => removeQSelection(index)}>
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
              <Button startIcon={<AddIcon />} onClick={addQSelection} sx={{ mt: 1 }}>
                Add Selection
              </Button>
            </Box>
          )}
          <Box mt={2}>
            <Typography variant="subtitle1">Correct Answers</Typography>
            {qcorrectanswer.map((ans, index) => (
              <Grid container spacing={1} alignItems="center" key={index} sx={{ mt: 1 }}>
                <Grid item xs={10}>
                  <TextField
                    label={`Correct Answer ${index + 1}`}
                    fullWidth
                    value={ans}
                    onChange={(e) => handleQCorrectAnswerChange(index, e.target.value)}
                  />
                </Grid>
                <Grid item xs={2}>
                  <IconButton color="error" onClick={() => removeQCorrectAnswer(index)}>
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Button startIcon={<AddIcon />} onClick={addQCorrectAnswer} sx={{ mt: 1 }}>
              Add Correct Answer
            </Button>
          </Box>
          <TextField
            label="Points"
            type="number"
            fullWidth
            margin="normal"
            value={qpoints}
            onChange={(e) => setQpoints(Number(e.target.value))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditQuestion}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Question Content Dialog */}
      <Dialog open={openViewDialog} onClose={() => setOpenViewDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>View Question Content</DialogTitle>
        <DialogContent dividers>
          <Box
            dangerouslySetInnerHTML={{ __html: viewContent }}
            sx={{
              "& img": { maxWidth: "100%", height: "auto" },
              wordBreak: "break-all",
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog for a Question */}
      <Dialog
        open={deleteDialogQuestionOpen}
        onClose={() => setDeleteDialogQuestionOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this question? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogQuestionOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={confirmDeleteQuestion} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminTrialQuestions;
