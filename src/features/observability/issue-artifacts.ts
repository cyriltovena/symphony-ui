import type { DiffChangeType, TranscriptEntryKind } from './api/types'

export function getDiffLineTone(line: string) {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git')) {
    return 'meta'
  }

  if (line.startsWith('@@')) {
    return 'hunk'
  }

  if (line.startsWith('+')) {
    return 'add'
  }

  if (line.startsWith('-')) {
    return 'remove'
  }

  return 'context'
}

export function getChangeTypeLabel(changeType: DiffChangeType) {
  switch (changeType) {
    case 'added':
      return 'Added'
    case 'deleted':
      return 'Deleted'
    case 'renamed':
      return 'Renamed'
    case 'copied':
      return 'Copied'
    case 'binary':
      return 'Binary'
    case 'untracked':
      return 'Untracked'
    default:
      return 'Modified'
  }
}

export function getTranscriptKindLabel(kind: TranscriptEntryKind) {
  switch (kind) {
    case 'assistant':
      return 'Assistant'
    case 'commentary':
      return 'Commentary'
    case 'tool':
      return 'Tool'
    case 'system':
      return 'System'
    default:
      return 'User'
  }
}
