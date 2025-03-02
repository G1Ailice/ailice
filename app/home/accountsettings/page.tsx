'use client';

import { Container, Box, Typography, Button, Avatar, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Alert, IconButton,
  CircularProgress, TextField, FormControl, InputLabel, Select, MenuItem,} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const metadata = {
  title: 'Account Settings',
  description: 'Account Settings Page for Ailice',
};

export default function AccountSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [renderUI, setRenderUI] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error'; }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Username editing.
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  // Visibility state.
  // We assume the DB returns either "Public" or "Private"
  const [visibility, setVisibility] = useState<'Public' | 'Private' | ''>('');
  const [pendingVisibility, setPendingVisibility] = useState<'Public' | 'Private' | null>(null);
  const [openVisibilityDialog, setOpenVisibilityDialog] = useState(false);

  // Achievements.
  const [achievements, setAchievements] = useState<any[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);

  // Change Password dialog.
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Fetch user data from API.
  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/check-auth');
      if (!response.ok) {
        router.push('/');
        return;
      }
      const data = await response.json();
      console.log('Fetched user data:', data);
      if (data.profile_pic) {
        data.profile_pic_url = `${process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL}/${data.profile_pic}`;
      }
      setUserData({ ...data });
      setNewUsername(data.username);
      setVisibility(data.visibility);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch user data after an update.
  const refetchUserData = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userData.id)
        .maybeSingle();
      if (error) {
        console.error(error);
        return;
      }
      if (data) {
        setUserData({ ...data });
        setNewUsername(data.username);
        setVisibility(data.visibility);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [router]);

  // Delay rendering the UI until after loading is complete.
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setRenderUI(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Fetch achievements.
  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const { data: userAchvs, error } = await supabase
          .from('user_acv')
          .select('achv_id, time_date')
          .eq('user_id', userData?.id);
        if (error) {
          console.error(error);
          return;
        }
        if (userAchvs && userAchvs.length > 0) {
          const achvs = await Promise.all(
            userAchvs.map(async (achv: any) => {
              const { data: achvDetails, error: err } = await supabase
                .from('achievements')
                .select('name, image, description')
                .eq('id', achv.achv_id)
                .single();
              if (err) {
                console.error(err);
                return null;
              }
              return { ...achv, ...achvDetails };
            })
          );
          setAchievements(achvs.filter((a) => a !== null));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setAchievementsLoading(false);
      }
    };
    if (userData) {
      fetchAchievements();
    }
  }, [userData]);

  const handleAvatarClick = () => setOpenDialog(true);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size <= 3 * 1024 * 1024) {
      setSelectedImage(file);
      setPreviewImage(URL.createObjectURL(file));
    } else {
      setSnackbar({ open: true, message: 'File size exceeds 3MB', severity: 'error' });
    }
  };

  const uploadImage = async () => {
    if (!selectedImage || !userData) return;
    const filePath = `${userData.id}/${selectedImage.name}`;
    try {
      if (userData.profile_pic) {
        await supabase.storage.from('profiles').remove([userData.profile_pic]);
      }
      const { error: uploadError } = await supabase.storage.from('profiles').upload(filePath, selectedImage, { upsert: true });
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from('users').update({ profile_pic: filePath }).eq('id', userData.id);
      if (dbError) throw dbError;
      const newProfilePicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL}/${filePath}`;
      setUserData((prev: any) => ({ ...prev, profile_pic: filePath, profile_pic_url: newProfilePicUrl }));
      setSnackbar({ open: true, message: 'Profile picture updated successfully!', severity: 'success' });
      setOpenDialog(false);
    } catch (error) {
      setSnackbar({ open: true, message: 'Error updating profile picture', severity: 'error' });
    }
    triggerAction();
  };

  const handleSaveUsername = async () => {
    if (!newUsername.trim() || !userData) return;
    if (newUsername === userData.username) {
      setIsEditingUsername(false);
      return;
    }
    const { data: existingUser, error } = await supabase
      .from('users')
      .select('id')
      .eq('username', newUsername)
      .neq('id', userData.id)
      .maybeSingle();
    if (existingUser) {
      setSnackbar({ open: true, message: 'This username is taken', severity: 'error' });
      return;
    }
    if (error) {
      console.error(error);
      setSnackbar({ open: true, message: 'Server error. Please try again later.', severity: 'error' });
      return;
    }
    const { error: updateError } = await supabase.from('users').update({ username: newUsername }).eq('id', userData.id);
    if (updateError) {
      console.error(updateError);
      setSnackbar({ open: true, message: 'Error updating username', severity: 'error' });
      return;
    }
    setUserData((prev: any) => ({ ...prev, username: newUsername }));
    setIsEditingUsername(false);
    setSnackbar({ open: true, message: 'Username updated successfully!', severity: 'success' });
    triggerAction();
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setSnackbar({ open: true, message: 'Please fill in both password fields', severity: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSnackbar({ open: true, message: 'New passwords do not match', severity: 'error' });
      return;
    }
    if (
      newPassword.length < 8 ||
      !/[a-z]/.test(newPassword) ||
      !/[A-Z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      setSnackbar({ open: true, message: 'Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, and one number.', severity: 'error' });
      return;
    }
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const { error } = await supabase.from('users').update({ password: hashedPassword }).eq('id', userData.id);
      if (error) {
        setSnackbar({ open: true, message: 'Error updating password', severity: 'error' });
      } else {
        setSnackbar({ open: true, message: 'Password updated successfully!', severity: 'success' });
        setOpenPasswordDialog(false);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Error updating password', severity: 'error' });
    }
    triggerAction();
  };

  // Handler for the Select-based visibility control.
  const handleSelectVisibility = (e: any) => {
    const newVis = e.target.value as 'Public' | 'Private';
    if (newVis !== visibility) {
      setPendingVisibility(newVis);
      setOpenVisibilityDialog(true);
    }
  };

  const confirmVisibilityChange = async () => {
    if (!pendingVisibility) return;
    const { error } = await supabase.from('users').update({ visibility: pendingVisibility }).eq('id', userData.id);
    if (error) {
      setSnackbar({ open: true, message: 'Error updating visibility', severity: 'error' });
    } else {
      await refetchUserData();
      setSnackbar({ open: true, message: 'Visibility updated successfully!', severity: 'success' });
    }
    setOpenVisibilityDialog(false);
    setPendingVisibility(null);
    triggerAction();
  };

  const cancelVisibilityChange = () => {
    setPendingVisibility(null);
    setOpenVisibilityDialog(false);
  }; 

const triggerAction = () => {
  const event = new Event("childAction");
  document.dispatchEvent(event);
};

  if (loading || visibility === '') {
    return (
      <Container
        maxWidth="lg"
        sx={{
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
        }}
      >
        <CircularProgress />
      </Container>
    );
  }

  if (!renderUI) {
    // Show a spinner during the render delay.
    return (
      <Container
        maxWidth="lg"
        sx={{
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
        }}
      >
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container
      maxWidth="lg"
      sx={{
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        p: 4,
        backgroundColor: 'background.default',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          p: 4,
          borderRadius: '8px',
          boxShadow: 3,
          width: '100%',
          maxWidth: 400,
          position: 'relative',
        }}
      >
        <>
          <Box sx={{ position: 'relative', textAlign: 'center' }}>
            <Avatar
              src={
                userData.profile_pic
                  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${userData.profile_pic}`
                  : undefined
              }
              onClick={handleAvatarClick}
              sx={{
                width: 80,
                height: 80,
                mb: 2,
                cursor: 'pointer',
              }}
            >
              {!userData.profile_pic && userData.username?.[0]?.toUpperCase()}
            </Avatar>
            <IconButton
              sx={{
                position: 'absolute',
                top: '40%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                opacity: 0,
                transition: 'opacity 0.5s ease, transform 0.5s ease',
                zIndex: 1,
                '&:hover': { opacity: 50 },
              }}
              onClick={handleAvatarClick}
            >
              <EditIcon sx={{ fontSize: '1.5rem', color: 'black' }} />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isEditingUsername ? (
              <>
                <TextField
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  variant="outlined"
                  size="small"
                />
                <Button onClick={handleSaveUsername} variant="contained" color="primary" size="small">
                  Save
                </Button>
                <Button onClick={() => { setIsEditingUsername(false); setNewUsername(userData.username); }} variant="text" size="small">
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Typography variant="h4" sx={{ m: 0 }}>
                  {userData.username}
                </Typography>
                <IconButton onClick={() => setIsEditingUsername(true)} sx={{ p: 0 }}>
                  <EditIcon sx={{ fontSize: '1.5rem' }} />
                </IconButton>
              </>
            )}
          </Box>
          <Typography variant="body1" sx={{ mb: 2, textAlign: 'center' }}>
            {userData.email}
          </Typography>

          {/* Visibility Select with current visibility text */}
          <Box sx={{ mb: 2, width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="visibility-label">Visibility</InputLabel>
              <Select labelId="visibility-label" value={visibility} label="Visibility" onChange={handleSelectVisibility}>
                <MenuItem value="Public">Public</MenuItem>
                <MenuItem value="Private">Private</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Button variant="outlined" onClick={() => setOpenPasswordDialog(true)}>
            Change Password
          </Button>

          <Box
            sx={{
              mt: 3,
              width: '100%',
              maxHeight: 200,
              overflowY: 'auto',
              p: 1,
              border: '1px solid #ccc',
              borderRadius: '8px',
              backgroundColor: 'grey.50',
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', textAlign: 'center', mb: 1 }}>
              Achievement Gained
            </Typography>
            {achievementsLoading ? (
              <CircularProgress size={24} sx={{ display: 'block', mx: 'auto' }} />
            ) : achievements.length > 0 ? (
              achievements.map((achv) => (
                <Box key={achv.achv_id} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Avatar
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/achivements/${achv.image}`}
                    alt={achv.name}
                    sx={{ width: 80, height: 80 }}
                  />
                  <Box>
                    <Typography variant="subtitle2">{achv.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Condition: {achv.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      T/D Gained: {new Date(achv.time_date).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" align="center">
                No achievements gained yet.
              </Typography>
            )}
          </Box>
        </>
      </Box>

      {/* Profile Picture Upload Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Upload Profile Picture</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              border: '2px dashed #ccc',
              borderRadius: '8px',
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file && file.size <= 3 * 1024 * 1024) {
                setSelectedImage(file);
                setPreviewImage(URL.createObjectURL(file));
              } else {
                setSnackbar({ open: true, message: 'File size exceeds 3MB', severity: 'error' });
              }
            }}
          >
            <Typography variant="body1">Drag & Drop an image here</Typography>
            <Typography variant="body2">or</Typography>
            <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} id="file-upload" />
            <label htmlFor="file-upload">
              <Button variant="contained" component="span">Choose Image</Button>
            </label>
            {previewImage && <Avatar src={previewImage} sx={{ width: 120, height: 120, mt: 2 }} />}
            <Typography variant="body2">Image size must not exceed 3MB</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={uploadImage} variant="contained" color="primary" disabled={!selectedImage}>
            Upload
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={openPasswordDialog} onClose={() => setOpenPasswordDialog(false)}>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} fullWidth />
            <TextField label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPasswordDialog(false)}>Cancel</Button>
          <Button onClick={handleChangePassword} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Visibility Change Confirmation Dialog */}
      <Dialog open={openVisibilityDialog} onClose={cancelVisibilityChange}>
        <DialogTitle>Confirm Visibility Change</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to change your profile visibility to <strong>{pendingVisibility}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelVisibilityChange}>Cancel</Button>
          <Button onClick={confirmVisibilityChange} variant="contained" color="primary">Confirm</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
        <Alert onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
