
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Gemini API Key - Default to empty string if missing to prevent crash
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY || ''),
      // Google Drive API Key
      'process.env.DRIVE_API_KEY': JSON.stringify(env.VITE_DRIVE_API_KEY || env.DRIVE_API_KEY || ''),
      // Google Apps Script URL
      'process.env.SCRIPT_URL': JSON.stringify(env.VITE_SCRIPT_URL || env.SCRIPT_URL || ''),
      
      // Fallback for other process.env access if strictly needed
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
  };
});
