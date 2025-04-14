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
  TablePagination
} from "@mui/material";
import Cropper from "react-easy-crop";
import { Area } from "react-easy-crop";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Define interface for achievement data
interface Achievement {
  id: number;
  name: string;
  description: string;
  image: string;
  subject_id: string;
}

// Interface for form data that we will use in create and edit dialogs.
interface AchievementFormData {
  name: string;
  description: string;
  imageFile: File | null;
}

export default function AchievementsPage() {
  const { id: subid } = useParams();
  // Normalize subid to a single string.
  const subjectId = Array.isArray(subid) ? subid[0] : subid;

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // State for Edit Dialog
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [editFormData, setEditFormData] = useState<AchievementFormData>({
    name: "",
    description: "",
    imageFile: null
  });

  // State for Create Dialog
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [createFormData, setCreateFormData] = useState<AchievementFormData>({
    name: "",
    description: "",
    imageFile: null
  });

  // State for Delete Confirmation Dialog
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [achievementToDelete, setAchievementToDelete] = useState<Achievement | null>(null);

  // State for cropping
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [onCropCompleteCallback, setOnCropCompleteCallback] = useState<((croppedImage: Blob) => void) | null>(null);

  const [linkedAchievementIds, setLinkedAchievementIds] = useState<number[]>([]);

  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = 10;

  const handleChangePage = (event: unknown, newPage: number) => {
    setCurrentPage(newPage);
  };

  const paginatedAchievements = achievements.slice(
    currentPage * rowsPerPage,
    currentPage * rowsPerPage + rowsPerPage
  );

  const renderPagination = () => {
    const totalPages = Math.ceil(achievements.length / rowsPerPage);
    const startPage = Math.max(0, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 3);

    const pageNumbers = Array.from(
      { length: endPage - startPage },
      (_, i) => startPage + i + 1
    );

    return (
      <Box display="flex" justifyContent="center" mt={2}>
        <Button
          onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
        >
          {"<"}
        </Button>
        {pageNumbers.map((page) => (
          <Button
            key={page}
            onClick={() => setCurrentPage(page - 1)}
            variant={page - 1 === currentPage ? "contained" : "outlined"}
          >
            {page}
          </Button>
        ))}
        <Button
          onClick={() =>
            setCurrentPage(Math.min(totalPages - 1, currentPage + 1))
          }
          disabled={currentPage === totalPages - 1}
        >
          {">"}
        </Button>
      </Box>
    );
  };

  // Fetch linked achievement IDs from the trials table
  useEffect(() => {
    const fetchLinkedAchievements = async () => {
      const { data, error } = await supabase
        .from("trials")
        .select("hd_achv_id");

      if (error) {
        console.error("Error fetching linked achievements:", error);
      } else {
        setLinkedAchievementIds(data.map((trial) => trial.hd_achv_id));
      }
    };

    fetchLinkedAchievements();
  }, [achievements]);

  // Fetch achievements filtered by subject_id
  useEffect(() => {
    if (!subjectId) return;
    const fetchAchievements = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("subject_id", subjectId);
      if (error) {
        console.error("Error fetching achievements:", error);
      } else {
        setAchievements(data ?? []);
      }
      setLoading(false);
    };
    fetchAchievements();
  }, [subjectId]);

  // Helper function to upload an image to Supabase storage.
  // Returns the new filename if successful.
  const uploadImage = async (file: File) => {
    const fileName = file.name; // Use the original file name without a timestamp.
    const { error } = await supabase.storage
      .from("achivements")
      .upload(fileName, file);
    if (error) {
      throw error;
    }
    return fileName;
  };

  // Helper to delete an image from Supabase storage.
  const deleteImage = async (fileName: string) => {
    const { error } = await supabase.storage
      .from("achivements")
      .remove([fileName]);
    if (error) {
      console.error("Error deleting image:", error);
    }
  };

  // Handle change for text fields in the edit form.
  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEditFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // Handle change for file upload in edit form.
  const handleEditFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setEditFormData((prev) => ({
        ...prev,
        imageFile: files[0]
      }));
    }
  };

  // Submit update for an achievement.
  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentAchievement) return;

    try {
      let newImage = currentAchievement.image;

      // Prepare the payload without subject_id.
      const payload = {
        name: editFormData.name,
        description: editFormData.description,
        image: editFormData.imageFile ? String(editFormData.imageFile.name) : currentAchievement.image
      };

      // Update the achievement in the database first.
      const { error } = await supabase
        .from("achievements")
        .update(payload)
        .eq("id", currentAchievement.id);
      if (error) {
        throw error;
      }

      // If a new file is uploaded, delete the previous one and upload the new file.
      if (editFormData.imageFile) {
        if (currentAchievement.image) {
          await deleteImage(currentAchievement.image);
        }
        newImage = await uploadImage(editFormData.imageFile);
      }

      // Update the local state.
      setAchievements((prev) =>
        prev.map((achv) =>
          achv.id === currentAchievement.id ? { ...achv, ...payload, image: newImage } : achv
        )
      );
      setOpenEditDialog(false);
      setCurrentAchievement(null);
    } catch (err) {
      console.error("Error updating achievement:", err);
    }
  };

  // When clicking the Edit button, fill form with current achievement's data.
  const handleEditClick = (achievement: Achievement) => {
    setCurrentAchievement(achievement);
    setEditFormData({
      name: achievement.name,
      description: achievement.description,
      imageFile: null // No new file yet
    });
    setOpenEditDialog(true);
  };

  // Handle change for the create form.
  const handleCreateInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCreateFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // Handle file selection for create.
  const handleCreateFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setCreateFormData((prev) => ({
        ...prev,
        imageFile: files[0]
      }));
    }
  };

  // Submit new achievement data.
  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!subjectId) return;

    // Enforce that an image is selected.
    if (!createFormData.imageFile) {
      alert("Image is required.");
      return;
    }

    try {
      // Get the image file name.
      const imageFileName = String(createFormData.imageFile.name);

      // Prepare the payload with the image file name and subject_id from subid.
      const payload = {
        name: createFormData.name,
        description: createFormData.description,
        image: imageFileName,
        subject_id: subjectId
      };

      // Add the achievement to the database first.
      const { data, error } = await supabase
        .from("achievements")
        .insert(payload)
        .select();

      if (error) {
        console.error("Error inserting achievement into database:", error);
        throw error;
      }

      // Upload the image file after adding the achievement to the database.
      try {
        await uploadImage(createFormData.imageFile);
      } catch (uploadError) {
        console.error("Error uploading image:", uploadError);
        throw uploadError;
      }

      // Append the new achievement to the state.
      if (Array.isArray(data) && data.length > 0) {
        setAchievements((prev) => [...prev, data[0] as Achievement]);
      }
      setOpenCreateDialog(false);
    } catch (err) {
      console.error("Error creating achievement:", err);
    }
  };

  // Handler for deleting an achievement.
  const handleDeleteClick = (achievement: Achievement) => {
    setAchievementToDelete(achievement);
    setOpenDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!achievementToDelete) return;

    try {
      // Delete the achievement from the DB.
      const { error } = await supabase
        .from("achievements")
        .delete()
        .eq("id", achievementToDelete.id);
      if (error) {
        throw error;
      }

      // Delete image from storage if present.
      if (achievementToDelete.image) {
        await deleteImage(achievementToDelete.image);
      }

      // Update local state.
      setAchievements((prev) => prev.filter((a) => a.id !== achievementToDelete.id));
      setOpenDeleteDialog(false);
      setAchievementToDelete(null);
    } catch (err) {
      console.error("Error deleting achievement:", err);
    }
  };

  // Handle cropping completion
  const handleCropComplete = async () => {
    if (!croppedAreaPixels || !croppingImage) return;

    const croppedImage = await getCroppedImage(croppingImage, croppedAreaPixels);
    if (onCropCompleteCallback) {
      onCropCompleteCallback(croppedImage);
    }
    setIsCropping(false);
    setCroppingImage(null);
  };

  // Utility to crop the image
  const getCroppedImage = async (imageSrc: string, crop: Area): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) throw new Error("Failed to get canvas context");

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = crop.width;
    canvas.height = crop.height;

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, "image/jpeg");
    });
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (error) => reject(error);
      image.src = url;
    });

  // Handle file selection for cropping
  const handleFileSelection = (file: File, callback: (croppedImage: Blob) => void) => {
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
          borderRadius: 2
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Achievements
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setOpenCreateDialog(true)}>
          Add Achievement
        </Button>
      </Box>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {/* id column is hidden */}
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Image</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedAchievements.map((achv) => (
                <TableRow key={achv.id}>
                  <TableCell>{achv.name}</TableCell>
                  <TableCell>{achv.description}</TableCell>
                  <TableCell>
                    {achv.image && (
                      <img
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/achivements/${achv.image}`}
                        alt={achv.name}
                        style={{ width: 100, height: "auto" }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Button variant="outlined" onClick={() => handleEditClick(achv)} sx={{ mr: 1 }}>
                      Edit
                    </Button>
                    <Button variant="outlined" color="error" onClick={() => handleDeleteClick(achv)} disabled={linkedAchievementIds.includes(achv.id)}>
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
        <Dialog open={isCropping} onClose={() => setIsCropping(false)} fullWidth maxWidth="sm">
          <DialogTitle>Crop Image</DialogTitle>
          <DialogContent>
            <Box
              sx={{
                position: "relative",
                width: "100%",
                height: "300px", // Fixed height for consistent cropping area
                backgroundColor: "#000", // Optional: Add a background color for better visibility
              }}
            >
              <Cropper
                image={croppingImage!}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsCropping(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCropComplete}>
              Crop
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Edit Achievement Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
        <DialogTitle>Edit Achievement</DialogTitle>
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
              <Typography variant="body1">Current Image</Typography>
              {currentAchievement?.image && (
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/achivements/${currentAchievement.image}`}
                  alt={currentAchievement.name}
                  style={{ width: 100, height: "auto", marginBottom: "10px" }}
                />
              )}
              <Typography variant="body1">Upload New Image</Typography>
              <Button
                variant="outlined"
                component="label"
                sx={{ mt: 1 }}
              >
                Choose File
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelection(e.target.files[0], (croppedImage) => {
                        setEditFormData((prev) => ({
                          ...prev,
                          imageFile: new File([croppedImage], e.target.files![0].name, { type: "image/jpeg" }),
                        }));
                      });
                    }
                  }}
                  hidden
                />
              </Button>
              {editFormData.imageFile && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2">Selected File: {editFormData.imageFile.name}</Typography>
                  <img
                    src={URL.createObjectURL(editFormData.imageFile)}
                    alt="Preview"
                    style={{ width: 100, height: "auto", marginTop: "10px" }}
                  />
                </Box>
              )}
            </Box>
            <DialogActions sx={{ mt: 2, p: 0 }}>
              <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
              <Button type="submit" variant="contained">
                Save Changes
              </Button>
            </DialogActions>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Add Achievement Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)}>
        <DialogTitle>Add Achievement</DialogTitle>
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
              <Typography variant="body1">Image Upload</Typography>
              <Button
                variant="outlined"
                component="label"
                sx={{ mt: 1 }}
              >
                Choose File
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelection(e.target.files[0], (croppedImage) => {
                        setCreateFormData((prev) => ({
                          ...prev,
                          imageFile: new File([croppedImage], e.target.files![0].name, { type: "image/jpeg" }),
                        }));
                      });
                    }
                  }}
                  hidden
                />
              </Button>
              {createFormData.imageFile && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2">Selected File: {createFormData.imageFile.name}</Typography>
                  <img
                    src={URL.createObjectURL(createFormData.imageFile)}
                    alt="Preview"
                    style={{ width: 100, height: "auto", marginTop: "10px" }}
                  />
                </Box>
              )}
            </Box>
            <DialogActions sx={{ mt: 2, p: 0 }}>
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
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {achievementToDelete?.name}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button color="error" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
