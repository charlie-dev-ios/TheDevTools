import React from 'react'
import { createRoot } from 'react-dom/client'
import Launcher from './Launcher'
import MainApp from './MainApp'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

// The main process opens two windows that share this bundle; the URL hash
// decides which UI to render.
const isMainWindow = window.location.hash === '#main'

createRoot(container).render(
  <React.StrictMode>{isMainWindow ? <MainApp /> : <Launcher />}</React.StrictMode>
)
