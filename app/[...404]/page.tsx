// app/[...404]/page.tsx (in the new Next.js App Directory structure)
'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Typography, Container, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { useRouter } from 'next/navigation';
import { blue, grey } from '@mui/material/colors'; // Changed green to blue
import 'typeface-varela-round';

// Define your theme here
const theme = createTheme({
  palette: {
    mode: 'light', // Changed mode to 'light'
    primary: {
      main: blue[700], // Changed from green to blue
    },
    background: {
      default: grey[100], // Changed from grey[900] to grey[100] for light mode
      paper: grey[200],  // Changed from grey[800] to grey[200] for light mode
    },
  },
  typography: {
    fontFamily: 'Varela Round, sans-serif',
  },
});

export default function Custom404() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5); // Initialize countdown state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication status
  const checkAuthStatus = async () => {
    const res = await fetch('/api/check-auth');
    if (res.ok) {
      const data = await res.json();
      if (data.username) {
        setIsAuthenticated(true); // User is authenticated
      } else {
        setIsAuthenticated(false); // User is not authenticated
      }
    } else {
      setIsAuthenticated(false); // User is not authenticated
    }
  };

  useEffect(() => {
    checkAuthStatus(); // Check auth status on component mount
  }, []);

  // Set up the countdown and auto-redirect after 5 seconds
  useEffect(() => {
    const redirectTo = isAuthenticated ? '/home' : '/'; // Redirect based on auth status
    if (countdown === 0) {
      router.push(redirectTo); // Automatically navigate when countdown reaches 0
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1); // Decrement countdown every second
    }, 1000);

    return () => clearInterval(timer); // Clean up timer on component unmount
  }, [countdown, isAuthenticated, router]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ textAlign: 'center', mt: 10 }}>
        <Typography variant="h2" component="h1" gutterBottom>
          Page Not Found
        </Typography>
        <Typography variant="h5" component="h2" gutterBottom>
          Oops! The page you're looking for doesn't exist.
        </Typography>
        <Typography variant="body1" gutterBottom>
          You might have mistyped the URL or you're trying to be SUS accessing. Nice try though.
        </Typography>

        <Typography variant="body1" sx={{ mt: 2 }}>
          Redirecting in {countdown} seconds...
        </Typography>

        <Box mt={4}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => router.push(isAuthenticated ? '/home' : '/')}
          >
            Go Back
          </Button>
        </Box>
      </Container>
    </ThemeProvider>
  );
}
