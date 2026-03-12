import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { overviewFixture, retryingOverviewFixture } from '../fixtures'
import { OverviewPage } from './OverviewPage'

const getStateSnapshot = vi.fn()

vi.mock('../api/client', () => ({
  getStateSnapshot: () => getStateSnapshot(),
  MANUAL_REFRESH_EVENT: 'symphony:refresh-requested',
}))

describe('OverviewPage', () => {
  beforeEach(() => {
    getStateSnapshot.mockResolvedValue(overviewFixture)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders overview metrics and running sessions', async () => {
    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Operations dashboard')).toBeInTheDocument()
    expect(screen.getByText('GRA-9')).toBeInTheDocument()
    expect(screen.getByText('Rate limits')).toBeInTheDocument()
  })

  it('renders retry entries when backoff exists', async () => {
    getStateSnapshot.mockResolvedValue(retryingOverviewFixture)

    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('GRA-22')).toBeInTheDocument()
    expect(screen.getByText(/Rate limit reached while requesting refresh/)).toBeInTheDocument()
  })
})
