import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Gemini API Key
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY),
      // Google Drive API Key (New)
      'process.env.DRIVE_API_KEY': JSON.stringify(env.VITE_DRIVE_API_KEY || env.DRIVE_API_KEY),
      
      // Fallback for other process.env access if strictly needed
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
  };
});