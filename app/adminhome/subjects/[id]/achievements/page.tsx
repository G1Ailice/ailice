"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useParams } from "next/navigation";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useTheme,
  Snackbar,
  Alert
} from "@mui/material";
import Cropper from "react-easy-crop";
import { Area } from "react-easy-crop";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Achievement {
  id: number;
  name: string;
  description: string;
  image: string;
  subject_id: string;
}

interface AchievementFormData {
  name: string;
  description: string;
  imageFile: File | null;
}

export default function AchievementsPage() {
  const { id: subid } = useParams();
  const subjectId = Array.isArray(subid) ? subid[0] : subid;
  const theme = useTheme();

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<
    "success" | "error" | "info" | "warning"
  >("success");

  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [editFormData, setEditFormData] = useState<AchievementFormData>({
    name: "",
    description: "",
    imageFile: null,
  });

  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [createFormData, setCreateFormData] = useState<AchievementFormData>({
    name: "",
    description: "",
    imageFile: null,
  });

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [achievementToDelete, setAchievementToDelete] = useState<Achievement | null>(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [onCropCompleteCallback, setOnCropCompleteCallback] = useState<
    ((croppedImage: Blob) => void) | null
  >(null);

  const [linkedAchievementIds, setLinkedAchievementIds] = useState<number[]>([]);

  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = 10;

  const paginatedAchievements = achievements.slice(
    currentPage * rowsPerPage,
    currentPage * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (_: unknown, newPage: number) => {
    setCurrentPage(newPage);
  };

  const renderPagination = () => {
    const totalPages = Math.ceil(achievements.length / rowsPerPage);
    const startPage = Math.max(0, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 3);
    const pageNumbers = Array.from({ length: endPage - startPage }, (_, i) => startPage + i + 1);

    return (
      <Box display="flex" justifyContent="center" mt={2}>
        <Button onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}>
          {"<"}
        </Button>
        {pageNumbers.map((page) => (
          <Button
            key={page}
            onClick={() => setCurrentPage(page - 1)}
            variant={page - 1 === currentPage ? "contained" : "outlined"}
            sx={{ mx: 0.5, minWidth: 32 }}
          >
            {page}
          </Button>
        ))}
        <Button
          onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
          disabled={currentPage === totalPages - 1}
        >
          {">"}
        </Button>
      </Box>
    );
  };

  useEffect(() => {
    const fetchLinked = async () => {
      const { data, error } = await supabase.from("trials").select("hd_achv_id");
      if (!error && data) {
        setLinkedAchievementIds(data.map((t) => t.hd_achv_id));
      }
    };
    fetchLinked();
  }, [achievements]);

  useEffect(() => {
    if (!subjectId) return;
    const fetchAchievements = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("subject_id", subjectId);
      if (data) setAchievements(data);
      setLoading(false);
    };
    fetchAchievements();
  }, [subjectId]);

  const uploadImage = async (file: File) => {
    const fileName = file.name;
    const { error } = await supabase.storage.from("achivements").upload(fileName, file);
    if (error) throw error;
    return fileName;
  };

  const deleteImage = async (fileName: string) => {
    await supabase.storage.from("achivements").remove([fileName]);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEditFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentAchievement) return;
    try {
      let newImage = currentAchievement.image;
      const payload = {
        name: editFormData.name,
        description: editFormData.description,
        image: editFormData.imageFile ? editFormData.imageFile.name : currentAchievement.image,
      };
      await supabase.from("achievements").update(payload).eq("id", currentAchievement.id);
      if (editFormData.imageFile) {
        if (currentAchievement.image) await deleteImage(currentAchievement.image);
        newImage = await uploadImage(editFormData.imageFile);
      }
      setAchievements((prev) =>
        prev.map((a) =>
          a.id === currentAchievement.id ? { ...a, ...payload, image: newImage } : a
        )
      );
      setOpenEditDialog(false);
      setCurrentAchievement(null);

      setSnackbarMessage("Achievement updated successfully");
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
    } catch (err) {
      console.error(err);
      setSnackbarMessage("Failed to update achievement");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  const handleEditClick = (achv: Achievement) => {
    setCurrentAchievement(achv);
    setEditFormData({ name: achv.name, description: achv.description, imageFile: null });
    setOpenEditDialog(true);
  };

  const handleCreateInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCreateFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!subjectId || !createFormData.imageFile) {
      alert("Image is required.");
      return;
    }
    try {
      const fileName = createFormData.imageFile.name;
      const payload = {
        name: createFormData.name,
        description: createFormData.description,
        image: fileName,
        subject_id: subjectId,
      };
      const { data, error } = await supabase.from("achievements").insert(payload).select();
      if (error) throw error;
      await uploadImage(createFormData.imageFile);
      if (Array.isArray(data) && data[0]) {
        setAchievements((prev) => [...prev, data[0]]);
      }
      setOpenCreateDialog(false);

      setSnackbarMessage("Achievement added successfully");
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
    } catch (err) {
      console.error(err);
      setSnackbarMessage("Failed to add achievement");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  const handleDeleteClick = (achv: Achievement) => {
    setAchievementToDelete(achv);
    setOpenDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!achievementToDelete) return;
    try {
      await supabase.from("achievements").delete().eq("id", achievementToDelete.id);
      if (achievementToDelete.image) await deleteImage(achievementToDelete.image);
      setAchievements((prev) => prev.filter((a) => a.id !== achievementToDelete.id));
      setOpenDeleteDialog(false);
      setAchievementToDelete(null);

      setSnackbarMessage("Achievement deleted successfully");
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
    } catch (err) {
      console.error(err);
      setSnackbarMessage("Failed to delete achievement");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  const handleCropComplete = async () => {
    if (!croppedAreaPixels || !croppingImage) return;
    const blob = await getCroppedImage(croppingImage, croppedAreaPixels);
    if (onCropCompleteCallback) onCropCompleteCallback(blob);
    setIsCropping(false);
    setCroppingImage(null);
  };

  const getCroppedImage = async (src: string, crop: Area): Promise<Blob> => {
    const img = await createImage(src);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    ctx.drawImage(
      img,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );
    return new Promise((res) => canvas.toBlob((b) => b && res(b), "image/jpeg"));
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = url;
    });

  const handleFileSelection = (file: File, callback: (blob: Blob) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCroppingImage(reader.result as string);
      setIsCropping(true);
      setOnCropCompleteCallback(() => callback);
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
          p: 2,
          bgcolor: "#e3f2fd",
          borderRadius: 2,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Achievements
        </Typography>
        <Button variant="contained" onClick={() => setOpenCreateDialog(true)}>
          Add Achievement
        </Button>
      </Box>

      <Paper>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table sx={{ minWidth: 650 }} size="small" aria-label="achievements table">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Image</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedAchievements.map((achv) => (
                <TableRow
                  key={achv.id}
                  hover
                  sx={{ "&:nth-of-type(odd)": { backgroundColor: theme.palette.action.hover } }}
                >
                  <TableCell>{achv.name}</TableCell>
                  <TableCell>{achv.description}</TableCell>
                  <TableCell>
                    {achv.image && (
                      <Box
                        component="img"
                        src={`${supabaseUrl}/storage/v1/object/public/achivements/${achv.image}`}
                        alt={achv.name}
                        sx={{ width: 50, height: "auto", borderRadius: 1 }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      variant="outlined"
                      onClick={() => handleEditClick(achv)}
                      sx={{ mr: 1, mb: { xs: 1, sm: 0 } }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => handleDeleteClick(achv)}
                      disabled={linkedAchievementIds.includes(achv.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {renderPagination()}

      {/* Cropping Dialog */}
      {isCropping && (
        <Dialog open onClose={() => setIsCropping(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ bgcolor: "#e3f2fd" }}>Crop Image</DialogTitle>
          <DialogContent>
            <Box sx={{ position: "relative", width: "100%", height: 300, bgcolor: "#000" }}>
              <Cropper
                image={croppingImage!}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ bgcolor: "#e3f2fd" }}>
            <Button onClick={() => setIsCropping(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCropComplete}>
              Crop
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Edit Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
        <DialogTitle sx={{ bgcolor: "#e3f2fd" }}>Edit Achievement</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleEditSubmit} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              name="name"
              value={editFormData.name}
              onChange={handleEditInputChange}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Description"
              name="description"
              value={editFormData.description}
              onChange={handleEditInputChange}
              margin="normal"
              multiline
              rows={3}
              required
            />
            <Box sx={{ mt: 2 }}>
              <Typography>Current Image</Typography>
              {currentAchievement?.image && (
                <Box
                  component="img"
                  src={`${supabaseUrl}/storage/v1/object/public/achivements/${currentAchievement.image}`}
                  alt={currentAchievement.name}
                  sx={{ width: 50, height: "auto", mb: 1 }}
                />
              )}
              <Typography>Upload New Image</Typography>
              <Button variant="outlined" component="label" sx={{ mt: 1 }}>
                Choose File
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileSelection(e.target.files[0], (blob) => {
                        setEditFormData((prev) => ({
                          ...prev,
                          imageFile: new File([blob], e.target.files![0].name, {
                            type: "image/jpeg",
                          }),
                        }));
                      });
                    }
                  }}
                  hidden
                />
              </Button>
              {editFormData.imageFile && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2">Selected: {editFormData.imageFile.name}</Typography>
                  <Box
                    component="img"
                    src={URL.createObjectURL(editFormData.imageFile)}
                    alt="Preview"
                    sx={{ width: 50, height: "auto", mt: 1 }}
                  />
                </Box>
              )}
            </Box>
            <DialogActions sx={{ mt: 2, p: 0, bgcolor: "#e3f2fd" }}>
              <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
              <Button type="submit" variant="contained">
                Save Changes
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)}>
        <DialogTitle sx={{ bgcolor: "#e3f2fd" }}>Add Achievement</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleCreateSubmit} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              name="name"
              value={createFormData.name}
              onChange={handleCreateInputChange}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Description"
              name="description"
              value={createFormData.description}
              onChange={handleCreateInputChange}
              margin="normal"
              multiline
              rows={3}
              required
            />
            <Box sx={{ mt: 2 }}>
              <Typography>Image Upload</Typography>
              <Button variant="outlined" component="label" sx={{ mt: 1 }}>
                Choose File
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileSelection(e.target.files[0], (blob) => {
                        setCreateFormData((prev) => ({
                          ...prev,
                          imageFile: new File([blob], e.target.files![0].name, {
                            type: "image/jpeg",
                          }),
                        }));
                      });
                    }
                  }}
                  hidden
                />
              </Button>
              {createFormData.imageFile && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2">Selected: {createFormData.imageFile.name}</Typography>
                  <Box
                    component="img"
                    src={URL.createObjectURL(createFormData.imageFile)}
                    alt="Preview"
                    sx={{ width: 50, height: "auto", mt: 1 }}
                  />
                </Box>
              )}
            </Box>
            <DialogActions sx={{ mt: 2, p: 0, bgcolor: "#e3f2fd" }}>
              <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
              <Button type="submit" variant="contained">
                Add Achievement
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle sx={{ bgcolor: "#e3f2fd" }}>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {achievementToDelete?.name}?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ bgcolor: "#e3f2fd" }}>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button color="error" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: "100%" }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
}
