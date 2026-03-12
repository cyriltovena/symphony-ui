import { issueArtifactsFixture, issueFixture, overviewFixture } from '../fixtures'
import { parseIssueArtifactsResponse, parseIssueResponse, parseStateResponse } from './parsers'

describe('parseStateResponse', () => {
  it('parses the live overview shape', () => {
    expect(parseStateResponse(overviewFixture)).toEqual(overviewFixture)
  })

  it('throws on malformed payloads', () => {
    expect(() => parseStateResponse({ running: [] })).toThrow(/counts or codex_totals/)
  })
})

describe('parseIssueResponse', () => {
  it('parses the live issue shape', () => {
    expect(parseIssueResponse(issueFixture)).toEqual(issueFixture)
  })

  it('throws when workspace is missing', () => {
    expect(() => parseIssueResponse({ issue_identifier: 'GRA-6' })).toThrow(/issue response/)
  })
})

describe('parseIssueArtifactsResponse', () => {
  it('parses the local artifact shape', () => {
    expect(parseIssueArtifactsResponse(issueArtifactsFixture)).toEqual(issueArtifactsFixture)
  })

  it('throws when transcript is missing', () => {
    expect(() =>
      parseIssueArtifactsResponse({
        workspace: {
          path: '/tmp/workspace',
          repo_root: '/tmp/workspace',
          branch: 'main',
          base_ref: 'main',
          main_ref: 'abc',
          head_ref: 'def',
          ahead_count: 0,
          behind_count: 0,
        },
        diff_buckets: [],
      }),
    ).toThrow(/transcript/)
  })
})
