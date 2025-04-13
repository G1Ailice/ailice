'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Box,
  Container,
  Paper,
  Typography,
  useMediaQuery,
  CircularProgress,
  Divider,
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
  TableBody
} from '@mui/material';
import { grey, blue } from '@mui/material/colors';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width:600px)');

  // Add subject dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newSub, setNewSub] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newGroup, setNewGroup] = useState('');

  // Edit subject dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null);
  const [editSub, setEditSub] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGroup, setEditGroup] = useState('');

  // Fetch subjects from database
  const fetchSubjects = async () => {
    try {
      const { data, error } = await supabase.from('subjects').select('id, sub, description, group');
      if (error) {
        console.error('Supabase error:', error);
        return;
      }
      const validData = Array.isArray(data)
        ? data.filter((item): item is Subject =>
            item &&
            typeof item === 'object' &&
            'id' in item &&
            'sub' in item &&
            'description' in item &&
            'group' in item &&
            typeof item.id === 'string' &&
            typeof item.sub === 'string'
          )
        : [];
      setSubjects(validData);
    } catch (error) {
      console.error('Failed to fetch subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  // Navigate to subject detail page when subject is clicked
  const handleViewSubject = async (id: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    await router.push(`/adminhome/subjects/${id}`);
    setIsProcessing(false);
  };

  // Handle adding a new subject
  const handleAddSubject = async () => {
    if (!newSub.trim() || !newDescription.trim() || !newGroup.trim()) return;
    try {
      const { error } = await supabase
        .from('subjects')
        .insert([{ sub: newSub, description: newDescription, group: newGroup }]);
      if (error) {
        console.error('Error adding subject:', error);
        return;
      }
      fetchSubjects();
      setNewSub('');
      setNewDescription('');
      setNewGroup('');
      setAddDialogOpen(false);
    } catch (error) {
      console.error('Failed to add subject:', error);
    }
  };

  // Handle editing a subject
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

  // Update subject in database
  const handleUpdateSubject = async () => {
    if (!subjectToEdit) return;
    try {
      const { error } = await supabase
        .from('subjects')
        .update({ sub: editSub, description: editDescription, group: editGroup })
        .eq('id', subjectToEdit.id);
      if (error) {
        console.error('Error updating subject:', error);
        return;
      }
      fetchSubjects();
      setEditDialogOpen(false);
      setSubjectToEdit(null);
    } catch (error) {
      console.error('Failed to update subject:', error);
    }
  };

  if (loading) {
    return (
      <Box height="100vh" display="flex" justifyContent="center" alignItems="center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" disableGutters sx={{ background: grey[50], p: isMobile ? 2 : 4 }}>
      {/* Header */}
      <Box
        component="header"
        sx={{
          py: 2,
          textAlign: 'center',
          background: blue[50],
          borderBottom: `1px solid ${grey[300]}`
        }}
      >
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ fontWeight: 600 }}>
          Dashboard
        </Typography>
      </Box>

      {/* Subjects Section */}
      <Paper elevation={3} sx={{ p: 2, borderRadius: 2, mt: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Available Subjects
          </Typography>
          <Button variant="contained" onClick={() => setAddDialogOpen(true)}>
            Add Subject
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {subjects.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Subject</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Group</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {subjects.map((subject) => (
                <TableRow key={subject.id} hover>
                  <TableCell>{subject.sub}</TableCell>
                  <TableCell>{subject.description}</TableCell>
                  <TableCell>{subject.group}</TableCell>
                  <TableCell>
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
        ) : (
          <Typography variant="body2" align="center" color="textSecondary">
            No subjects available
          </Typography>
        )}
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
