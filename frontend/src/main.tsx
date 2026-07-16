// React 進入點：把 App 掛到 #root（StrictMode 會在開發模式重複執行 effect 以揪出副作用）
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
