'use client'

import { CircularProgress, Box, createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import {grey, blue } from '@mui/material/colors';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: blue[600],
    },
    background: {
      default: grey[100],
      paper: grey[100],
    },
  },
});

export default function LoadingFallback() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
        bgcolor="background.default"
      >
        <CircularProgress color="primary" />
      </Box>
    </ThemeProvider>
  );
}
