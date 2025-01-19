"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Container, Box, Paper, Typography, Skeleton, Button } from "@mui/material";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const LessonsPage = () => {
  const { subid } = useParams(); // Get subject_id from the URL
  const router = useRouter();
  const [subjectName, setSubjectName] = useState(""); // State to hold subject name
  const [lessons, setLessons] = useState<any[]>([]); // State to hold lessons
  const [loading, setLoading] = useState(true);

  // Fetch subject name and lessons
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch subject name
      const { data: subjectData, error: subjectError } = await supabase
        .from("subjects")
        .select("sub")
        .eq("id", subid)
        .single();

      if (subjectError) {
        console.error("Error fetching subject:", subjectError.message);
      } else {
        setSubjectName(subjectData?.sub || "Unknown Subject");
      }

      // Fetch lessons
      const { data: lessonData, error: lessonError } = await supabase
        .from("lessons")
        .select("*")
        .eq("subject_id", subid);

      if (lessonError) {
        console.error("Error fetching lessons:", lessonError.message);
      } else {
        setLessons(lessonData || []);
      }

      setLoading(false);
    };

    fetchData();
  }, [subid]);

  // Handle lesson click
  const handleLessonClick = (lessonId: string) => {
    router.push(`/home/subject/${subid}/lessons/${lessonId}`);
  };

  return (
    <Container maxWidth="lg">
      <Box marginTop="1rem">
        <Paper elevation={3} style={{ padding: "1rem" }}>
          <Typography variant="h4" gutterBottom>
            {subjectName}
          </Typography>
          {loading ? (
            <Skeleton animation="wave" variant="rectangular" width="80%" height="100%" />
          ) : lessons.length > 0 ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 3,
                marginTop: "1rem",
              }}
            >
              {lessons.map((lesson) => (
                <Button
                  key={lesson.id}
                  sx={{
                    p: 1,
                    backgroundColor: "primary.main",
                    color: "primary.contrastText",
                    textTransform: "none",
                    transition: "transform 0.3s",
                    "&:hover": {
                      transform: "scale(1.01)",
                      backgroundColor: "primary.dark",
                    },
                  }}
                  onClick={() => handleLessonClick(lesson.id)}
                >
                  <Typography variant="h6" textAlign="center">
                    {lesson.lesson_title}
                  </Typography>
                </Button>
              ))}
            </Box>
          ) : (
            <Typography>No lessons found for this subject.</Typography>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default LessonsPage;
