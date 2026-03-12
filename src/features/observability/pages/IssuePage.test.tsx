import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { issueArtifactsFixture, issueErrorFixture, issueFixture } from '../fixtures'
import { IssuePage } from './IssuePage'

const getIssueSnapshot = vi.fn()
const getIssueArtifacts = vi.fn()

vi.mock('../api/client', () => ({
  getIssueSnapshot: (issueIdentifier: string) => getIssueSnapshot(issueIdentifier),
  getIssueArtifacts: (issueIdentifier: string, workspacePath: string, sessionId: string | null) =>
    getIssueArtifacts(issueIdentifier, workspacePath, sessionId),
  MANUAL_REFRESH_EVENT: 'symphony:refresh-requested',
}))

describe('IssuePage', () => {
  beforeEach(() => {
    getIssueSnapshot.mockResolvedValue(issueFixture)
    getIssueArtifacts.mockResolvedValue(issueArtifactsFixture)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders issue header with identifier and status', async () => {
    render(
      <MemoryRouter initialEntries={['/issues/GRA-6']}>
        <Routes>
          <Route element={<IssuePage />} path="/issues/:issueIdentifier" />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('GRA-6')).toBeInTheDocument()
    expect(screen.getByText('running')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Transcript/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Changes/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Details/i })).toBeInTheDocument()
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

  it('renders transcript entries and groups agent work', async () => {
    render(
      <MemoryRouter initialEntries={['/issues/GRA-6']}>
        <Routes>
          <Route element={<IssuePage />} path="/issues/:issueIdentifier" />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Session opened/i)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Transcript/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Changes/i })).toBeInTheDocument()
    expect(screen.getByText(/AGENTS\.md instructions/)).toBeInTheDocument()
    expect(screen.getAllByText(/Implement core conformance suites/).length).toBeGreaterThan(0)
    expect(screen.getByText(/2 subagent result/)).toBeInTheDocument()
    expect(screen.getByText(/2 thoughts, 2 tool calls/)).toBeInTheDocument()
  })
})
