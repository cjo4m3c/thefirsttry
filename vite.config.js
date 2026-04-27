import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` is overridable via VITE_BASE_PATH so a preview build can be hosted
// at a sub-path (e.g. /FlowSprite/preview-drawer/) without disturbing the
// main /FlowSprite/ deployment. main builds leave VITE_BASE_PATH unset.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/FlowSprite/',
})
