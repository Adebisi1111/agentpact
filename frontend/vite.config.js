
const path = require('path');
module.exports = {
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    require('@vitejs/plugin-react')(),
  ],
  server: {
    host: true,
    port: 3000,
  },
  build: {
    outDir: 'dist',
  },
};
