import { parseIssueArtifactsResponse, parseIssueResponse, parseLocalWorkspacesResponse, parseStateResponse } from './parsers'
import type { IssueArtifactsResponse, IssueResponse, LocalWorkspacesResponse, StateResponse } from './types'

const API_BASE_URL = import.meta.env.VITE_SYMPHONY_API_BASE_URL ?? ''
export const MANUAL_REFRESH_EVENT = 'symphony:refresh-requested'

async function fetchJson<T>(path: string, parser: (value: unknown) => T, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }

  const payload = (await response.json()) as unknown
  return parser(payload)
}

export function getStateSnapshot(): Promise<StateResponse> {
  return fetchJson('/api/v1/state', parseStateResponse)
}

export function getIssueSnapshot(issueIdentifier: string): Promise<IssueResponse> {
  return fetchJson(`/api/v1/${issueIdentifier}`, parseIssueResponse)
}

export function getIssueArtifacts(
  issueIdentifier: string,
  workspacePath: string,
  sessionId: string | null,
): Promise<IssueArtifactsResponse> {
  const query = new URLSearchParams({ workspacePath })
  if (sessionId) {
    query.set('sessionId', sessionId)
  }

  return fetchJson(
    `/api/local/issues/${issueIdentifier}/artifacts?${query.toString()}`,
    parseIssueArtifactsResponse,
  )
}

export function getLocalWorkspaces(root?: string): Promise<LocalWorkspacesResponse> {
  const query = root ? `?root=${encodeURIComponent(root)}` : ''
  return fetchJson(`/api/local/workspaces${query}`, parseLocalWorkspacesResponse)
}

export async function requestOrchestratorRefresh() {
  const response = await fetch(`${API_BASE_URL}/api/v1/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Refresh failed (${response.status})`)
  }

  window.dispatchEvent(new Event(MANUAL_REFRESH_EVENT))
}
