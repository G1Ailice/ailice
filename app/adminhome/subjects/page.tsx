'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Snackbar,
  Alert
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Subject {
  id: string;
  sub: string;
  description: string;
  group: string;
}

export default function HomePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lessonsSet, setLessonsSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newSub, setNewSub] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newGroup, setNewGroup] = useState('');

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null);
  const [editSub, setEditSub] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGroup, setEditGroup] = useState('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const fetchSubjects = async () => {
    setLoading(true);
    // fetch subjects
    const { data: subjectsData, error: subjectsError } = await supabase
      .from('subjects')
      .select('id, sub, description, group');
    // fetch lessons to know which subjects have lessons
    const { data: lessonsData, error: lessonsError } = await supabase
      .from('lessons')
      .select('subject_id');

    if (!subjectsError && Array.isArray(subjectsData)) {
      setSubjects(subjectsData);
    }
    if (!lessonsError && Array.isArray(lessonsData)) {
      setLessonsSet(new Set(lessonsData.map((l) => l.subject_id)));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleViewSubject = (id: string) => {
    router.push(`/adminhome/subjects/${id}`);
  };

  const handleEditSubject = (id: string) => {
    const subject = subjects.find((s) => s.id === id);
    if (subject) {
      setSubjectToEdit(subject);
      setEditSub(subject.sub);
      setEditDescription(subject.description);
      setEditGroup(subject.group);
      setEditDialogOpen(true);
    }
  };

  const handleUpdateSubject = async () => {
    if (!subjectToEdit) return;
    const { error } = await supabase
      .from('subjects')
      .update({ sub: editSub, description: editDescription, group: editGroup })
      .eq('id', subjectToEdit.id);
    if (!error) {
      setSnackbar({ open: true, message: 'Subject updated successfully', severity: 'success' });
      fetchSubjects();
      setEditDialogOpen(false);
      setSubjectToEdit(null);
    } else {
      setSnackbar({ open: true, message: 'Failed to update subject', severity: 'error' });
    }
  };

  const confirmDeleteSubject = (id: string) => {
    setSubjectToDelete(id);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <Box height="100vh" display="flex" justifyContent="center" alignItems="center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          p: 2,
          bgcolor: '#e3f2fd',
          borderRadius: 2
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Subjects
        </Typography>
      </Box>

      {/* Subjects Table */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Subject</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Group</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {subjects.map((subject) => (
                <TableRow key={subject.id} hover>
                  <TableCell>{subject.sub}</TableCell>
                  <TableCell>{subject.description}</TableCell>
                  <TableCell>{subject.group}</TableCell>
                  <TableCell align="center">
                    <Button
                      variant="contained"
                      size="small"
                      sx={{ mr: 1 }}
                      onClick={() => handleViewSubject(subject.id)}
                    >
                      View
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      sx={{ mr: 1 }}
                      onClick={() => handleEditSubject(subject.id)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Edit Subject Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ bgcolor: "#e3f2fd" }}>Edit Subject</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Subject Name"
            fullWidth
            sx={{ mt: 2 }}  // added margin top
            value={editSub}
            onChange={(e) => setEditSub(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Group"
            fullWidth
            value={editGroup}
            onChange={(e) => setEditGroup(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ bgcolor: "#e3f2fd" }}>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateSubject} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ bgcolor: "#e3f2fd" }}>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this subject?</Typography>
        </DialogContent>
        <DialogActions sx={{ bgcolor: "#e3f2fd" }}>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for confirmations */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
