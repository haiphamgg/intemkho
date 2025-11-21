import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Only define the specific key needed to avoid breaking libraries checking "typeof process"
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY),
      // Fallback for other process.env access if strictly needed, but prefer specific keys
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
  };
});