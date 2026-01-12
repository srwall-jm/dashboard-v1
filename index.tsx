import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App' 

// ⚠️ IMPORTANTE: Si tenías líneas como "import './index.css'", 
// BORRALAS, porque ese archivo no existe en tu lista y rompe la web.

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("❌ FATAL: No encuentro el div 'root' en index.html");
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}