import { CircularProgress, Box, Typography } from '@mui/material';

const Loading = () => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white', // Match your theme
        zIndex: 9999, // Ensure it overlays on top of other content
      }}
    >
      <CircularProgress color="primary" /> {/* Change color to green */}
    </Box>
  );
};

export default Loading;
