"use client"

import LoadingFallback from './loading';
import { Suspense, useEffect, useState } from 'react';
import { Button, Slide, Box, Typography } from '@mui/material';
import './style.css'; 

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export default function Layout1({
  children,
}: {
  children: React.ReactNode;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false); 
  
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      const promptEvent = deferredPrompt as BeforeInstallPromptEvent;
      promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the A2HS prompt');
      } else {
        console.log('User dismissed the A2HS prompt');
      }
      setDeferredPrompt(null);
      setShowInstallButton(false);
    }
  };

  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Varela+Round&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <title>Ailice</title>
        <link rel="icon" href="/icons/ailice_192x192.png" type="image/png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <link rel="apple-touch-icon" href="/icons/ailice_192x192.png" />
      </head>
      <body>
        {isMaintenance ? (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'white',
              zIndex: 3000,
            }}
          >
            <Typography variant="h3" component="div" sx={{ marginBottom: 2 }}>
              Website on Maintenance
            </Typography>
            <img 
              src="/gif/coding-scaler.gif" 
              alt="Coding Scaler Animation" 
              style={{ maxWidth: '80%', height: '40%' }} 
            />
          </Box>
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            <main>{children}</main>
          </Suspense>
        )}
        {showInstallButton && (
          <Slide direction="up" in={showInstallButton} mountOnEnter unmountOnExit>
            <Button
              className="breathing-button"
              variant="contained"
              color="success"
              onClick={handleInstallClick}
              style={{
                width: "30px",
                height: "35px",
                position: 'fixed',
                top: '0.5rem',
                left: '10.5rem',
                padding: '10px 20px',
                backgroundColor: '#bbdefb',
                color: 'black',
                zIndex: 2000
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Install
            </Button>
          </Slide>
        )}
      </body>
    </html>
  );
}
