import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { IssuePage } from '../features/observability/pages/IssuePage'
import { OverviewPage } from '../features/observability/pages/OverviewPage'
import { ThemeProvider } from './ThemeProvider'
import './app.css'

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />} path="/">
            <Route element={<OverviewPage />} index />
            <Route element={<IssuePage />} path="issues/:issueIdentifier" />
            <Route element={<Navigate replace to="/" />} path="*" />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
