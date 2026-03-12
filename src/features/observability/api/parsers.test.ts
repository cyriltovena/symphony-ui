import { issueFixture, overviewFixture } from '../fixtures'
import { parseIssueResponse, parseStateResponse } from './parsers'

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
