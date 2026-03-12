import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { issueErrorFixture, issueFixture } from '../fixtures'
import { IssuePage } from './IssuePage'

const getIssueSnapshot = vi.fn()

vi.mock('../api/client', () => ({
  getIssueSnapshot: (issueIdentifier: string) => getIssueSnapshot(issueIdentifier),
  MANUAL_REFRESH_EVENT: 'symphony:refresh-requested',
}))

describe('IssuePage', () => {
  beforeEach(() => {
    getIssueSnapshot.mockResolvedValue(issueFixture)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders issue runtime details', async () => {
    render(
      <MemoryRouter initialEntries={['/issues/GRA-6']}>
        <Routes>
          <Route element={<IssuePage />} path="/issues/:issueIdentifier" />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('GRA-6')).toBeInTheDocument()
    expect(screen.getByText(/Workspace \+ attempts/)).toBeInTheDocument()
    expect(screen.getByText(/Open JSON payload/)).toBeInTheDocument()
  })

  it('renders retry and error state', async () => {
    getIssueSnapshot.mockResolvedValue(issueErrorFixture)

    render(
      <MemoryRouter initialEntries={['/issues/GRA-6']}>
        <Routes>
          <Route element={<IssuePage />} path="/issues/:issueIdentifier" />
        </Routes>
      </MemoryRouter>,
    )

    expect((await screen.findAllByText(/Rate limit reached while requesting refresh/)).length).toBeGreaterThan(0)
    expect(screen.getByText(/Attempt 2 due/)).toBeInTheDocument()
  })
})
