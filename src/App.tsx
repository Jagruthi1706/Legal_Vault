import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { CopilotProvider } from './contexts/CopilotContext';
import { CommandPaletteProvider } from './contexts/CommandPaletteContext';
import { GlobalCommandPalette } from './components/common/GlobalCommandPalette';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CopilotProvider>
          <CommandPaletteProvider>
            <BrowserRouter>
              <GlobalCommandPalette />
              <AppRoutes />
              <Toaster
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: '#18181A',
                    color: '#F3F3F2',
                    border: '1px solid #27272A',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontFamily: 'Inter, sans-serif'
                  },
                }}
              />
            </BrowserRouter>
          </CommandPaletteProvider>
        </CopilotProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
