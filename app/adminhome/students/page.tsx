'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Avatar,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  useMediaQuery,
  Stack
} from '@mui/material';
import { grey, blue } from '@mui/material/colors';
import { useRouter } from 'next/navigation';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface User {
  id: string;
  username: string;
  email: string;
  profile_pic?: string | null;
  exp: number;
  role: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  image: string;
}

interface UserAcv {
  user_id: string;
  achv_id: string;
  time_date: string;
}

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

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function PaginationNavigation({ currentPage, totalPages, onPageChange }: PaginationProps) {
  let startPage = currentPage > 3 ? currentPage - 2 : 1;
  let endPage = Math.min(startPage + 4, totalPages);
  if (endPage - startPage < 4 && startPage > 1) {
    startPage = Math.max(1, endPage - 4);
  }
  const pageNumbers = [];
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <Box display="flex" alignItems="center" justifyContent="center" mt={2}>
      <IconButton
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        size="small"
        sx={{ color: blue[700] }}
      >
        <ArrowBackIosNewIcon fontSize="inherit" />
      </IconButton>
      {pageNumbers.map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? 'contained' : 'outlined'}
          onClick={() => onPageChange(page)}
          sx={{ mx: 0.5, minWidth: 36, borderRadius: 2 }}
        >
          {page}
        </Button>
      ))}
      <IconButton
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        size="small"
        sx={{ color: blue[700] }}
      >
        <ArrowForwardIosIcon fontSize="inherit" />
      </IconButton>
    </Box>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width:600px)');

  // Pagination state for Admin and Student tables
  const [adminPage, setAdminPage] = useState(1);
  const [studentPage, setStudentPage] = useState(1);
  const rowsPerPage = 10;

  // Edit dialog state for student users
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Error states for update fields
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [newEmailError, setNewEmailError] = useState('');

  // Confirmation dialog state for update
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Achievements dialog state for a user
  const [achievementsDialogOpen, setAchievementsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [achievementsData, setAchievementsData] = useState<(UserAcv & Partial<Achievement>)[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);

  // Insert new state hooks for "Add Admin" above other dialog state definitions
  const [addAdminDialogOpen, setAddAdminDialogOpen] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminPasswordError, setNewAdminPasswordError] = useState('');
  const [newAdminUsernameError, setNewAdminUsernameError] = useState('');
  const [newAdminEmailError, setNewAdminEmailError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, username, profile_pic, exp, role');
      if (error) {
        console.error('Error fetching users:', error);
      } else if (data) {
        setUsers(data as User[]);
      }
      setLoading(false);
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch('/api/check-auth');
        if (res.ok) {
          const data = await res.json();
          setCurrentUserId(data.id);
        }
      } catch (err) {
        console.error('Error fetching current user:', err);
      }
    };
    fetchCurrentUser();
  }, []);

  // Handle showing the edit dialog for a student user
  const handleEdit = (id: string) => {
    const userToEdit = users.find(user => user.id === id && user.role === 'Student');
    if (userToEdit) {
      setEditingUser(userToEdit);
      setNewUsername(userToEdit.username);
      setNewEmail(userToEdit.email);
      setNewPassword('');
      setConfirmPassword('');
      // Reset error messages
      setNewPasswordError('');
      setConfirmPasswordError('');
      setNewEmailError('');
      setEditDialogOpen(true);
    }
  };

  // Validate fields using MUI error messages instead of alert windows
  const validateUpdateFields = () => {
    let valid = true;
    if (!newEmail.trim()) {
      setNewEmailError('Email cannot be empty');
      valid = false;
    } else {
      // Check valid email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        setNewEmailError('Invalid email address');
        valid = false;
      } else if (users.some(u => u.email.toLowerCase() === newEmail.toLowerCase() && u.id !== editingUser?.id)) {
        setNewEmailError('Email already exists');
        valid = false;
      } else {
        setNewEmailError('');
      }
    }
    if (newPassword.trim() === '') {
      setNewPasswordError('Password cannot be empty');
      valid = false;
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) {
      setNewPasswordError(
        'Password must be at least 8 characters and include uppercase, lowercase, and a number.'
      );
      valid = false;
    } else {
      setNewPasswordError('');
    }
    if (confirmPassword.trim() === '') {
      setConfirmPasswordError('Please confirm the password');
      valid = false;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      valid = false;
    } else {
      setConfirmPasswordError('');
    }
    return valid;
  };

  // Open confirmation dialog after validating update fields
  const handleOpenConfirmDialog = () => {
    if (validateUpdateFields()) {
      setConfirmDialogOpen(true);
    }
  };

  // Update the student user's username and password after confirmation
  const handleConfirmUpdate = async () => {
    if (!editingUser) return;
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const { error } = await supabase
        .from('users')
        .update({
          username: newUsername,
          email: newEmail,
          password: hashedPassword
        })
        .eq('id', editingUser.id);
      if (error) {
        console.error('Error updating user:', error);
      } else {
        setUsers(prevUsers =>
          prevUsers.map(user =>
            user.id === editingUser.id ? { ...user, username: newUsername, email: newEmail } : user
          )
        );
        setEditDialogOpen(false);
        setEditingUser(null);
        setNewPassword('');
        setConfirmPassword('');
        setSnackbarMessage('User updated successfully.');
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('Hashing or update error:', err);
    }
    setConfirmDialogOpen(false);
  };

  // Handle deletion dialog open
  const handleDelete = (id: string) => {
    const userToDelete = users.find(user => user.id === id);
    if (userToDelete) {
      setDeleteUser(userToDelete);
      setDeleteConfirmInput('');
      setDeleteDialogOpen(true);
    }
  };

  // Delete the user's data across multiple tables based on the hidden id
  const handleConfirmDelete = async () => {
    if (!deleteUser) return;
    try {
      const { data: trialData, error: trialError } = await supabase
        .from('trial_data')
        .select('id')
        .eq('user_id', deleteUser.id);
      if (trialError) {
        console.error('Error fetching trial data:', trialError);
        return;
      }
      if (trialData && trialData.length > 0) {
        for (const trial of trialData) {
          const { error: qError } = await supabase
            .from('q_data')
            .delete()
            .eq('t_dataid', trial.id);
          if (qError) {
            console.error('Error deleting q_data for trial:', trial.id, qError);
            return;
          }
        }
        const { error: deleteTrialError } = await supabase
          .from('trial_data')
          .delete()
          .eq('user_id', deleteUser.id);
        if (deleteTrialError) {
          console.error('Error deleting trial data:', deleteTrialError);
          return;
        }
      }
      const { error: acvError } = await supabase
        .from('user_acv')
        .delete()
        .eq('user_id', deleteUser.id);
      if (acvError) {
        console.error('Error deleting user achievements:', acvError);
        return;
      }
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', deleteUser.id);
      if (userError) {
        console.error('Error deleting user:', userError);
        return;
      }
      setUsers(prevUsers => prevUsers.filter(user => user.id !== deleteUser.id));
      setDeleteDialogOpen(false);
      setDeleteUser(null);
      setSnackbarMessage('User deleted successfully.');
      setSnackbarOpen(true);
    } catch (err) {
      console.error('Deletion error:', err);
    }
  };

  // Handle achievements button click for a user
  const handleAchievements = (id: string) => {
    setSelectedUserId(id);
    setAchievementsDialogOpen(true);
  };

  // Fetch achievements for the selected user when the achievements dialog opens
  useEffect(() => {
    if (!selectedUserId || !achievementsDialogOpen) return;
    const fetchUserAchievements = async () => {
      setAchievementsLoading(true);
      try {
        const { data: userAcvs, error: userAcvError } = await supabase
          .from('user_acv')
          .select('user_id, achv_id, time_date')
          .eq('user_id', selectedUserId);
        if (userAcvError) {
          console.error('Error fetching user achievements:', userAcvError);
          setAchievementsLoading(false);
          return;
        }
        if (!userAcvs || userAcvs.length === 0) {
          setAchievementsData([]);
          setAchievementsLoading(false);
          return;
        }
        const achievementIds = userAcvs.map((item) => item.achv_id);
        const { data: achvDetails, error: achvError } = await supabase
          .from('achievements')
          .select('id, name, description, image')
          .in('id', achievementIds);
        if (achvError) {
          console.error('Error fetching achievement details:', achvError);
          setAchievementsLoading(false);
          return;
        }
        const achvMap = new Map<string, Achievement>();
        achvDetails?.forEach((achv) => {
          achvMap.set(achv.id, achv);
        });
        const combined = userAcvs.map((item) => ({
          ...item,
          ...achvMap.get(item.achv_id)
        }));
        combined.sort(
          (a, b) => new Date(b.time_date).getTime() - new Date(a.time_date).getTime()
        );
        setAchievementsData(combined);
      } catch (error) {
        console.error('Failed to fetch achievements:', error);
      } finally {
        setAchievementsLoading(false);
      }
    };
    fetchUserAchievements();
  }, [selectedUserId, achievementsDialogOpen]);

  // Add function to validate and add new Admin user
  const handleAddAdmin = async () => {
    // Simple validation for demonstration
    let valid = true;
    if (!newAdminPassword.trim()) {
      setNewAdminPasswordError('Password cannot be empty');
      valid = false;
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newAdminPassword)) {
      setNewAdminPasswordError('Password must be at least 8 characters and include uppercase, lowercase, and a number.');
      valid = false;
    } else {
      setNewAdminPasswordError('');
    }
    // Validate username
    if (!newAdminUsername.trim()) {
      setNewAdminUsernameError('Username cannot be empty');
      valid = false;
    } else {
      setNewAdminUsernameError('');
    }
    // Validate email with regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newAdminEmail.trim()) {
      setNewAdminEmailError('Email cannot be empty');
      valid = false;
    } else if (!emailRegex.test(newAdminEmail)) {
      setNewAdminEmailError('Invalid email address');
      valid = false;
    } else if (users.some(u => u.email.toLowerCase() === newAdminEmail.toLowerCase())) {
      setNewAdminEmailError('Email already exists');
      valid = false;
    } else {
      setNewAdminEmailError('');
    }
    if (!valid) return;
    try {
      const hashedPassword = await bcrypt.hash(newAdminPassword, 10);
      const { data, error } = await supabase
        .from('users')
        .insert({
          username: newAdminUsername,
          email: newAdminEmail,
          password: hashedPassword,
          role: 'Admin'
        });
      if (error) {
        console.error('Error creating admin:', error);
      } else if (data) {
        setUsers(prevUsers => [...prevUsers, data[0] as User]);
        setSnackbarMessage('Admin user added successfully.');
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('Error adding admin:', err);
    }
    handleCloseAddAdminDialog();
  };

  // Add helper function to reset Add Admin dialog inputs
  const handleCloseAddAdminDialog = () => {
    setAddAdminDialogOpen(false);
    setNewAdminUsername('');
    setNewAdminEmail('');
    setNewAdminPassword('');
    setNewAdminPasswordError('');
  };

  const adminUsers = users.filter(user => user.role === 'Admin');
  const studentUsers = users.filter(user => user.role === 'Student');

  const totalAdminPages = Math.ceil(adminUsers.length / rowsPerPage);
  const totalStudentPages = Math.ceil(studentUsers.length / rowsPerPage);

  const currentAdminUsers = adminUsers.slice((adminPage - 1) * rowsPerPage, adminPage * rowsPerPage);
  const currentStudentUsers = studentUsers.slice((studentPage - 1) * rowsPerPage, studentPage * rowsPerPage);

  if (loading) {
    return (
      <Box height="100vh" display="flex" justifyContent="center" alignItems="center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4, backgroundColor: grey[50], minHeight: '100vh' }}>
      <Box textAlign="center" mb={4}>
        <Typography variant={isMobile ? 'h5' : 'h4'} sx={{ fontWeight: 700, color: blue[800] }}>
          Users Management Dashboard
        </Typography>
        <Divider sx={{ my: 2, borderColor: blue[200] }} />
      </Box>

      <Stack spacing={4}>
        {/* Admin Users Table */}
        <Paper elevation={4} sx={{ p: 3, borderRadius: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" sx={{ color: blue[700], fontWeight: 600 }}>
              Admin Users
            </Typography>
            <Button variant="contained" onClick={() => setAddAdminDialogOpen(true)} sx={{ borderRadius: 2 }}>
              Add Admin
            </Button>
          </Box>
          {adminUsers.length === 0 ? (
            <Typography>No Admin users found.</Typography>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
              <Table sx={{ minWidth: 300 }} aria-label="admin users table">
                <TableHead>
                  <TableRow sx={{ backgroundColor: blue[50] }}>
                    <TableCell align="center" sx={{ fontWeight: 600, borderBottom: '2px solid ' + blue[200] }}>Profile Image</TableCell>
                    <TableCell sx={{ fontWeight: 600, borderBottom: '2px solid ' + blue[200] }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600, borderBottom: '2px solid ' + blue[200] }}>Username</TableCell>
                    <TableCell sx={{ fontWeight: 600, borderBottom: '2px solid ' + blue[200] }}>Role</TableCell>
                    {/* Added Actions column */}
                    <TableCell align="center" sx={{ fontWeight: 600, borderBottom: '2px solid ' + blue[200] }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentAdminUsers.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell align="center">
                        {user.profile_pic ? (
                          <Avatar
                            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${user.profile_pic}`}
                            alt={user.username}
                            sx={{ margin: '0 auto' }}
                          />
                        ) : (
                          <Avatar sx={{ bgcolor: blue[300] }}>
                            {user.username.charAt(0).toUpperCase()}
                          </Avatar>
                        )}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      {/* Added Actions cell */}
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Button
                            variant="contained"
                            color="error"
                            size="small"
                            sx={{ borderRadius: 2 }}
                            disabled
                          >
                            Delete
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {totalAdminPages > 1 && (
            <PaginationNavigation
              currentPage={adminPage}
              totalPages={totalAdminPages}
              onPageChange={(page) => setAdminPage(page)}
            />
          )}
        </Paper>

        {/* Student Users Table */}
        <Paper elevation={4} sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h5" sx={{ mb: 2, color: blue[700], fontWeight: 600 }}>
            Student Users
          </Typography>
          {studentUsers.length === 0 ? (
            <Typography>No Student users found.</Typography>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2 }}>
              <Table sx={{ minWidth: 300 }} aria-label="student users table">
                <TableHead>
                  <TableRow sx={{ backgroundColor: blue[50] }}>
                    <TableCell align="center" sx={{ fontWeight: 600, borderBottom: '2px solid ' + blue[200] }}>Profile Image</TableCell>
                    <TableCell sx={{ fontWeight: 600, borderBottom: '2px solid ' + blue[200] }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600, borderBottom: '2px solid ' + blue[200] }}>Username</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, borderBottom: '2px solid ' + blue[200] }}>Level</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, borderBottom: '2px solid ' + blue[200] }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentStudentUsers.map((user) => {
                    const { level } = calculateLevel(user.exp);
                    return (
                      <TableRow key={user.id} hover>
                        <TableCell align="center">
                          {user.profile_pic ? (
                            <Avatar
                              src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${user.profile_pic}`}
                              alt={user.username}
                              sx={{ margin: '0 auto' }}
                            />
                          ) : (
                            <Avatar sx={{ bgcolor: blue[300] }}>
                              {user.username.charAt(0).toUpperCase()}
                            </Avatar>
                          )}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell align="center">{level}</TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={1} justifyContent="center">
                            <Button
                              variant="contained"
                              size="small"
                              sx={{ borderRadius: 2 }}
                              onClick={() => handleEdit(user.id)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              sx={{ borderRadius: 2 }}
                              onClick={() => handleAchievements(user.id)}
                            >
                              Achievements
                            </Button>
                            <Button
                              variant="contained"
                              color="error"
                              size="small"
                              sx={{ borderRadius: 2 }}
                              onClick={() => handleDelete(user.id)}
                              disabled={user.id === currentUserId}
                            >
                              Delete
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {totalStudentPages > 1 && (
            <PaginationNavigation
              currentPage={studentPage}
              totalPages={totalStudentPages}
              onPageChange={(page) => setStudentPage(page)}
            />
          )}
        </Paper>
      </Stack>

      {/* ---------- Updated Dialogs with New Design ---------- */}

      {/* Edit Dialog for Student Users */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)} 
        fullWidth 
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 2,
            boxShadow: 3
          }
        }}
      >
        <DialogTitle sx={{ backgroundColor: blue[50], fontWeight: 600 }}>
          Edit Student User
        </DialogTitle>
        <DialogContent dividers sx={{ py: 3 }}>
          <Stack spacing={2}>
            <TextField
              autoFocus
              label="Username"
              fullWidth
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setNewEmailError(''); }}
              required
              error={Boolean(newEmailError)}
              helperText={newEmailError || "Enter a valid email address"}
            />
            <TextField
              label="New Password"
              fullWidth
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              error={Boolean(newPasswordError)}
              helperText={newPasswordError}
            />
            <TextField
              label="Confirm Password"
              fullWidth
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              error={Boolean(confirmPasswordError)}
              helperText={confirmPasswordError}
            />
            <input type="hidden" value={editingUser?.id || ''} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleOpenConfirmDialog} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog for Update */}
      <Dialog 
        open={confirmDialogOpen} 
        onClose={() => setConfirmDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 2,
            boxShadow: 3
          }
        }}
      >
        <DialogTitle sx={{ backgroundColor: blue[50], fontWeight: 600 }}>
          Confirm Update
        </DialogTitle>
        <DialogContent dividers sx={{ py: 3 }}>
          <Typography>Are you sure you want to update this user?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDialogOpen(false)} variant="outlined">
            No
          </Button>
          <Button onClick={handleConfirmUpdate} variant="contained">
            Yes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 2,
            boxShadow: 3
          }
        }}
      >
        <DialogTitle sx={{ backgroundColor: blue[50], fontWeight: 600 }}>
          Confirm Delete
        </DialogTitle>
        <DialogContent dividers sx={{ py: 3 }}>
          <Typography>
            To confirm deletion, please type the user's email exactly: <strong>{deleteUser?.email}</strong>
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Confirm Email"
            fullWidth
            value={deleteConfirmInput}
            onChange={(e) => setDeleteConfirmInput(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} variant="outlined">
            No
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            disabled={deleteConfirmInput !== deleteUser?.email}
          >
            Yes, Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Achievements Dialog */}
      <Dialog 
        open={achievementsDialogOpen} 
        onClose={() => setAchievementsDialogOpen(false)} 
        fullWidth 
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 2,
            boxShadow: 3
          }
        }}
      >
        <DialogTitle sx={{ backgroundColor: blue[50], fontWeight: 600 }}>
          User Achievements
        </DialogTitle>
        <DialogContent dividers sx={{ py: 3 }}>
          {achievementsLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={2}>
              <CircularProgress size={24} />
            </Box>
          ) : achievementsData.length > 0 ? (
            <Box
              display="grid"
              gap={2}
              gridTemplateColumns={{ xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }}
              justifyContent="center"
              mt={1}
            >
              {achievementsData.map((ach) => (
                <Paper
                  key={ach.achv_id}
                  elevation={2}
                  sx={{
                    p: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    backgroundColor: grey[50],
                    borderRadius: 2,
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'scale(1.05)' }
                  }}
                >
                  <Box
                    component="img"
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/achivements/${ach.image}`}
                    alt={ach.name}
                    sx={{ width: '100%', maxWidth: 80, borderRadius: 1 }}
                  />
                  <Typography variant="subtitle2" align="center" sx={{ fontWeight: 600 }}>
                    {ach.name}
                  </Typography>
                  <Typography variant="caption" align="center" color="textSecondary">
                    {new Date(ach.time_date).toLocaleString()}
                  </Typography>
                </Paper>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" align="center" color="textSecondary">
              No achievements found.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAchievementsDialogOpen(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Admin Dialog */}
      <Dialog
        open={addAdminDialogOpen}
        onClose={handleCloseAddAdminDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: { borderRadius: 3, p: 2, boxShadow: 3 }
        }}
      >
        <DialogTitle sx={{ backgroundColor: blue[50], fontWeight: 600 }}>
          Add Admin User
        </DialogTitle>
        <DialogContent dividers sx={{ py: 3 }}>
          <Stack spacing={2}>
            <TextField
              autoFocus
              label="Username"
              fullWidth
              value={newAdminUsername}
              onChange={(e) => { setNewAdminUsername(e.target.value); setNewAdminUsernameError(''); }}
              required
              error={Boolean(newAdminUsernameError)}
              helperText={newAdminUsernameError}
            />
            <TextField
              label="Email"
              type="email"
              placeholder="example@example.com"
              fullWidth
              value={newAdminEmail}
              onChange={(e) => { setNewAdminEmail(e.target.value); setNewAdminEmailError(''); }}
              required
              error={Boolean(newAdminEmailError)}
              helperText={newAdminEmailError || "Enter a valid email address"}
            />
            <TextField
              label="Password"
              fullWidth
              type="password"
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              required
              error={Boolean(newAdminPasswordError)}
              helperText={newAdminPasswordError}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseAddAdminDialog} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleAddAdmin} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for Notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
}
