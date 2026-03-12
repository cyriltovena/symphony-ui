import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { ThemeProvider } from '../app/ThemeProvider'

describe('AppShell', () => {
  it('toggles the document theme', async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<AppShell />} path="/">
              <Route element={<div>Body</div>} index />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /switch to dark/i }))

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark')
    })
  })
})
