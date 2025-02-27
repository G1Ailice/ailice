'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TextField,
  Button,
  Container,
  Box,
  Typography,
  Paper,
  CircularProgress,
  createTheme,
  ThemeProvider,
  CssBaseline,
  Snackbar,
  Alert,
  AlertColor,
} from '@mui/material';
import { grey, blue } from '@mui/material/colors';
import Loading from './loading';
import 'typeface-varela-round';
import { SpeedInsights } from '@vercel/speed-insights/next';
// Import Supabase client for client-side cleanup
import { createClient } from '@supabase/supabase-js';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: blue[600],
    },
    background: {
      default: grey[300],
      paper: grey[100],
    },
  },
  typography: {
    fontFamily: 'Varela Round, sans-serif',
  },
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function LoginPage() {
  // Login form state
  const [loginUsernameOrEmail, setLoginUsernameOrEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  // Register form state
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  // Global states
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: AlertColor }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/check-auth');
        if (res.ok) {
          const data = await res.json();
          if (data.username) {
            setIsLoggedIn(true);
            router.push('/home');
          }
        }
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        // Delay a bit for a smooth transition
        setTimeout(() => setCheckingSession(false), 1000);
      }
    };
    checkSession();
  }, [router]);

  // Cleanup expired confirmation records every minute
  useEffect(() => {
    const interval = setInterval(async () => {
      // Get current Manila time
      const now = new Date();
      const manilaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      // Query account_confirmation records with tdate less than or equal to current time
      const { data: expiredRecords } = await supabase
        .from('account_confirmation')
        .select('*')
        .lte('tdate', manilaTime.toISOString());
      if (expiredRecords && expiredRecords.length > 0) {
        for (const record of expiredRecords) {
          const { error } = await supabase
            .from('account_confirmation')
            .delete()
            .eq('id', record.id);
          if (!error) {
            setSnackbar({ open: true, message: `Expired confirmation for ${record.email} removed.`, severity: 'info' });
          }
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  if (checkingSession) {
    return <Loading />;
  }

  if (isLoggedIn) {
    return null;
  }

  // Login Submission Handler (restored)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginUsernameOrEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        // Redirect using window.location.href for simplicity
        window.location.href = data.redirectTo;
      } else {
        setSnackbar({
          open: true,
          message: data.message || 'Login failed',
          severity: data.status === 403 ? 'warning' : 'error',
        });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Login error', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Updated Registration Submission Handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerEmail || !registerUsername || !registerPassword || !registerConfirmPassword) {
      setSnackbar({ open: true, message: 'Please fill in all fields', severity: 'error' });
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setSnackbar({ open: true, message: 'Passwords do not match', severity: 'error' });
      return;
    }
    setLoading(true);
    try {
      // Call the new account-confirmation endpoint
      const res = await fetch('/api/account-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerEmail,
          username: registerUsername,
          password: registerPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSnackbar({ open: true, message: data.message, severity: data.severity });
        // Optionally, switch to login tab and instruct the user to check their email
        setIsLogin(true);
      } else {
        setSnackbar({ open: true, message: data.message || 'Registration failed', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Registration error', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <SpeedInsights />
      <CssBaseline />
      <Container maxWidth="sm" sx={{ py: 6 }}>
        {/* Logo / Header */}
        <Box display="flex" flexDirection="column" alignItems="center" mb={4}>
          <Box display="flex" alignItems="center" gap={1}>
            <img src="/icons/ailicemascot.png" alt="AILICEMASCOT" style={{ maxHeight: '40px' }} />
            <img src="/icons/ailiceword.png" alt="AILICE" style={{ maxHeight: '40px' }} />
          </Box>
          <Typography variant="h5" color="primary" sx={{ mt: 1 }}>
            Welcome to AILice
          </Typography>
        </Box>

        {/* Form Card */}
        <Paper
          elevation={6}
          sx={{
            p: 4,
            borderRadius: 2,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          {/* Tab Switcher */}
          <Box display="flex" justifyContent="center" mb={3}>
            <Button
              variant={isLogin ? 'contained' : 'text'}
              onClick={() => setIsLogin(true)}
              sx={{ flex: 1, borderRadius: 0, py: 1 }}
            >
              Login
            </Button>
            <Button
              variant={!isLogin ? 'contained' : 'text'}
              onClick={() => setIsLogin(false)}
              sx={{ flex: 1, borderRadius: 0, py: 1 }}
            >
              Register
            </Button>
          </Box>

          {/* Login Form */}
          {isLogin ? (
            <Box component="form" onSubmit={handleLoginSubmit} noValidate>
              <TextField
                label="Email"
                variant="outlined"
                fullWidth
                margin="normal"
                value={loginUsernameOrEmail}
                onChange={(e) => setLoginUsernameOrEmail(e.target.value)}
                required
              />
              <TextField
                label="Password"
                variant="outlined"
                type="password"
                fullWidth
                margin="normal"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                sx={{ mt: 2 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
              </Button>
            </Box>
          ) : (
            // Updated Register Form (without confirmation code input)
            <Box component="form" onSubmit={handleRegisterSubmit} noValidate>
              <TextField
                label="Email"
                variant="outlined"
                fullWidth
                margin="normal"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                required
              />
              <TextField
                label="Username"
                variant="outlined"
                fullWidth
                margin="normal"
                value={registerUsername}
                onChange={(e) => setRegisterUsername(e.target.value)}
                required
              />
              <TextField
                label="Password"
                variant="outlined"
                type="password"
                fullWidth
                margin="normal"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                required
                error={
                  registerPassword.length > 0 &&
                  !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(registerPassword)
                }
                helperText={
                  registerPassword.length > 0 &&
                  !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(registerPassword)
                    ? 'Password must be at least 8 characters and include uppercase, lowercase, and a number.'
                    : ''
                }
              />
              <TextField
                label="Confirm Password"
                variant="outlined"
                type="password"
                fullWidth
                margin="normal"
                value={registerConfirmPassword}
                onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                required
                error={registerPassword !== registerConfirmPassword}
                helperText={registerPassword !== registerConfirmPassword ? 'Passwords do not match.' : ''}
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                sx={{ mt: 2 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Register'}
              </Button>
            </Box>
          )}
        </Paper>
      </Container>

      {/* Snackbar for notifications */}
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
