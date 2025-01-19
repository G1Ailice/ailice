'use client';

import { Container, Box, Typography, Button, Avatar, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Alert } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import CircularProgress from '@mui/material/CircularProgress';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function AccountSettings() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    const fetchUserData = async () => {
      const response = await fetch('/api/check-auth');
      if (response.ok) {
        const data = await response.json();
        if (data.profile_pic) {
          data.profile_pic_url = `${process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL}/${data.profile_pic}`;
        }
        setUserData(data);
      } else {
        router.push('/');
      }
    };
    fetchUserData();
  }, [router]);
  
  const handleAvatarClick = () => setOpenDialog(true);
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size <= 3 * 1024 * 1024) { // 3MB limit
      setSelectedImage(file);
      setPreviewImage(URL.createObjectURL(file));
    } else {
      setSnackbar({ open: true, message: 'File size exceeds 3MB', severity: 'error' });
    }
  };
  
  const triggerAction = () => {
    const event = new Event('childAction');
    document.dispatchEvent(event);
  };
  
  const uploadImage = async () => {
    if (!selectedImage || !userData) return;
    const filePath = `${userData.id}/${selectedImage.name}`;
  
    try {
      if (userData.profile_pic) { // Delete old image
        await supabase.storage.from('profiles').remove([userData.profile_pic]);
      }
      // Upload new image
      const { error: uploadError } = await supabase.storage.from('profiles').upload(filePath, selectedImage, { upsert: true });
      if (uploadError) throw uploadError;
  
      // Update database link
      const { error: dbError } = await supabase.from('users').update({ profile_pic: filePath }).eq('id', userData.id);
      if (dbError) throw dbError;
  
      const newProfilePicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL}/${filePath}`;
      setUserData((prev: any) => ({ ...prev, profile_pic: filePath, profile_pic_url: newProfilePicUrl }));
      setSnackbar({ open: true, message: 'Profile picture updated successfully!', severity: 'success' });
      setOpenDialog(false);
  
      // Trigger the custom action event
      triggerAction();
    } catch (error) {
      setSnackbar({ open: true, message: 'Error updating profile picture', severity: 'error' });
    }
  };
  
  return (
    <Container
     maxWidth="sm"
        sx={{
            minHeight: 'calc(100vh - 64px)', // Account for AppBar height
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            overflow: 'hidden',
            padding: 4,
        }}
    >
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f5f5f5',
                padding: 4,
                borderRadius: '8px',
                boxShadow: 3,
                width: '100%',
                maxWidth: 400,
                position: 'relative',
            }}
        >
            {userData ? (
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
                                top: 0,
                                left: 0,
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                opacity: 0,
                                transition: 'opacity 0.5s ease, transform 0.5s ease',
                                zIndex: 1,
                                '&:hover': { opacity: 1, transform: 'scale(1)' },
                            }}
                            onClick={handleAvatarClick}
                        >
                            <EditIcon sx={{ fontSize: '2rem', color: 'black' }} />
                        </IconButton>
                    </Box>
                    <Typography variant="h4" sx={{ mb: 2, textAlign: 'center' }}>
                        {userData.username}
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2, textAlign: 'center' }}>
                        {userData.email}
                    </Typography>
                </>
            ) : (
                <CircularProgress />
            )}
        </Box>

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
                        padding: 3,
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
                            setSnackbar({
                                open: true,
                                message: 'File size exceeds 3MB',
                                severity: 'error',
                            });
                        }
                    }}
                >
                    <Typography variant="body1">
                        Drag & Drop an image here
                    </Typography>
                    <Typography variant="body2">or</Typography>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        style={{ display: 'none' }}
                        id="file-upload"
                    />
                    <label htmlFor="file-upload">
                        <Button variant="contained" component="span">
                            Choose Image
                        </Button>
                    </label>
                    {previewImage && (
                        <Avatar
                            src={previewImage}
                            sx={{ width: 120, height: 120, mt: 2 }}
                        />
                    )}
                    <Typography variant="body2">
                        Image size must not exceed 3MB
                    </Typography>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                <Button
                    onClick={uploadImage}
                    variant="contained"
                    color="primary"
                    disabled={!selectedImage}
                >
                    Upload
                </Button>
            </DialogActions>
        </Dialog>
        <Snackbar
            open={snackbar.open}
            autoHideDuration={4000}
            onClose={() =>
                setSnackbar((prev) => ({ ...prev, open: false }))
            }
        >
            <Alert
                onClose={() =>
                    setSnackbar((prev) => ({ ...prev, open: false }))
                }
                severity={snackbar.severity}
                sx={{ width: '100%' }}
            >
                {snackbar.message}
            </Alert>
        </Snackbar>
    </Container>
  );
}
