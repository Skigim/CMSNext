// import React from 'react' // Temporarily not needed when StrictMode is disabled
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'
import ErrorBoundary from './components/ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode> // Temporarily disabled to test service recreation
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  // </React.StrictMode>,
)