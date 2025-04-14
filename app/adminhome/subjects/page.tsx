'use client';

import { useEffect, useState } from 'react';
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
  TableContainer
} from '@mui/material';

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

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, sub, description, group');
    if (!error && Array.isArray(data)) {
      setSubjects(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleViewSubject = (id: string) => {
    router.push(`/adminhome/subjects/${id}`);
  };

  const handleAddSubject = async () => {
    if (!newSub.trim() || !newDescription.trim() || !newGroup.trim()) return;
    await supabase.from('subjects').insert([{ sub: newSub, description: newDescription, group: newGroup }]);
    fetchSubjects();
    setNewSub('');
    setNewDescription('');
    setNewGroup('');
    setAddDialogOpen(false);
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
    await supabase
      .from('subjects')
      .update({ sub: editSub, description: editDescription, group: editGroup })
      .eq('id', subjectToEdit.id);
    fetchSubjects();
    setEditDialogOpen(false);
    setSubjectToEdit(null);
  };

  if (loading) {
    return (
      <Box height="100vh" display="flex" justifyContent="center" alignItems="center">
        <Typography>Loading...</Typography>
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
          Available Subjects
        </Typography>
        <Button variant="contained" onClick={() => setAddDialogOpen(true)}>
          Add Subject
        </Button>
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

      {/* Add Subject Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add New Subject</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Subject Name"
            fullWidth
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Group"
            fullWidth
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddSubject} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Subject Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Subject</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Subject Name"
            fullWidth
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
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateSubject} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}