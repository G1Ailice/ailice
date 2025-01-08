'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TextField, Button, Container, Box, Typography, Paper, CircularProgress, createTheme, ThemeProvider, CssBaseline, Snackbar, Alert, AlertColor } from '@mui/material';
import {grey, blue } from '@mui/material/colors';
import Loading from './loading';
import 'typeface-varela-round';
import { SpeedInsights } from "@vercel/speed-insights/next"

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


export default function LoginPage() {
  const [loginUsernameOrEmail, setLoginUsernameOrEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [inputtedCode, setInputtedCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isCodeValid, setIsCodeValid] = useState(false);


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
            setIsLoggedIn(true);  // Update logged-in state
            router.push('/home');
          }
        }
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        setTimeout(() => {
          setCheckingSession(false); // Set loading to false after checking
        }, 1000); // 1-second delay
      }
    };
    checkSession();
  }, [router]);
  
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  if (checkingSession) {
    return <Loading />; // Render the Loading component while checking session
  }

  if (isLoggedIn) {
    return null; // or you can redirect or render a different component
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: loginUsernameOrEmail, password: loginPassword }),
      });
  
      const data = await res.json();
  
      if (res.ok) {
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
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: registerEmail,
          username: registerUsername,
          password: registerPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        console.log('Registered:', data.message);
        setSnackbar({ open: true, message: 'Registration successful', severity: 'success' });
        setIsLogin(true);
      } else {
        setSnackbar({ open: true, message: data.message || 'Registration failed', severity: 'error' });
        console.error('Registration failed:', data.message);
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Registration error', severity: 'error' });
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendConfirmationCode = async () => {
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    setConfirmationCode(generatedCode);
  
    try {
      const res = await fetch('/api/send-confirmation-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: registerEmail, confirmationCode: generatedCode }),
      });
  
      if (res.ok) {
        setIsCodeSent(true);
        setSnackbar({ open: true, message: 'Confirmation code sent successfully', severity: 'success' }); // Add snackbar notification
      } else {
        throw new Error('Failed to send code');
      }
    } catch (error) {
      console.error(error);
      setSnackbar({ open: true, message: 'Failed to send code', severity: 'error' });
    }
  };
  

  const checkConfirmationCode = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value;
    setInputtedCode(code);
    if (code === confirmationCode) {
      setIsCodeValid(true);
    } else {
      setIsCodeValid(false);
    }
  };
  

  return (
    <ThemeProvider theme={theme}>
      <SpeedInsights/>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box display="flex" flexDirection="column" height="100vh" >
        <Typography
          variant="h4"
          component="div"
          color="primary"
          sx={{ fontSize:'2rem', marginLeft: "1rem", marginTop: "1rem"}}
          >
          <img src="/icons/ailicemascot.png" alt="AILICEMASCOT" style={{ maxHeight: '30px' }} />
          <img src="/icons/ailiceword.png" alt="AILICE" style={{ maxHeight: '30px' }} />
        </Typography> 
          <Box display="flex" justifyContent="center" alignItems="center" flexGrow={1} gap="1rem" >
            <Box display="flex" flexDirection="row" alignItems="stretch" width="100%" maxWidth="500px" bgcolor={grey[200]} borderRadius="8px" overflow="hidden">
              {isLogin ? (
                <>
                  <Paper elevation={3} style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }} >
                    <Typography variant="h4" component="h1" gutterBottom align="center">
                      Login
                    </Typography>
                    <form onSubmit={handleLoginSubmit}>
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
                      <Button type="submit" variant="contained" color="primary" fullWidth style={{ marginTop: '1rem' }} disabled={loading}>
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
                      </Button>
                      <Button variant="outlined" color="primary" fullWidth onClick={() => setIsLogin(false)} style={{ marginTop: '1rem' }} disabled={loading}>
                        Switch to Register
                      </Button>
                    </form>
                  </Paper>
                  <Box sx={{ width: '2px', backgroundColor: grey[700] }} style={{ height: '100%' }} />
                </>
              ) : (
                <>
                  <Paper elevation={3} style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Typography variant="h4" component="h1" gutterBottom align="center">
                      Register
                    </Typography>
                    <form onSubmit={handleRegisterSubmit}>
                    <TextField
                      label="Email"
                      variant="outlined"
                      fullWidth
                      margin="normal"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      required
                    />
                    <Button onClick={sendConfirmationCode} variant="contained" color="primary" fullWidth disabled={!registerEmail}>
                      Send Code
                    </Button>
                    {isCodeSent && (
                      <TextField
                        label="Confirmation Code"
                        variant="outlined"
                        fullWidth
                        margin="normal"
                        value={inputtedCode}
                        onChange={checkConfirmationCode}
                        required
                        sx={{ borderColor: isCodeValid ? 'green' : 'inherit' }}
                      />
                    )}
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
                        registerPassword.length > 0 && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(registerPassword)
                      }
                      helperText={
                        registerPassword.length > 0 && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(registerPassword)
                          ? 'Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, and one number.'
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
                      style={{ marginTop: '1rem' }}
                      disabled={loading || !isCodeValid || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(registerPassword) || registerPassword !== registerConfirmPassword}
                    >
                      {loading ? <CircularProgress size={24} color="inherit" /> : 'Register'}
                    </Button>
                    <Button variant="outlined" color="primary" fullWidth onClick={() => setIsLogin(true)} style={{ marginTop: '1rem' }} disabled={loading}>
                      Switch to Login
                    </Button>
                  </form>

                  </Paper>
                  <Box sx={{ width: '2px', backgroundColor: grey[700] }} style={{ height: '100%' }} />
                </>
              )}
            </Box>
          </Box>
        </Box>

        <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose}>
          <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </ThemeProvider>
  );
}
