/**
 * Small helpers used to describe an attachment the way WhatsApp does:
 * a short type label ("PDF", "DOCX", ...) plus a colour for its badge.
 */

const EXTENSION_COLORS: Record<string, string> = {
  pdf: '#e53935',
  doc: '#2b579a',
  docx: '#2b579a',
  rtf: '#2b579a',
  txt: '#607d8b',
  csv: '#217346',
  xls: '#217346',
  xlsx: '#217346',
  ppt: '#d24726',
  pptx: '#d24726',
  zip: '#7e57c2',
  rar: '#7e57c2',
  '7z': '#7e57c2',
  mp3: '#f9a825',
  wav: '#f9a825',
  m4a: '#f9a825',
  ogg: '#f9a825',
}

export interface DocumentInfo {
  /** Short badge label, e.g. "PDF". */
  label: string
  /** Badge colour. */
  color: string
  /** Human readable description, e.g. "PDF document". */
  description: string
}

export function getFileExtension(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim())
  return match ? match[1].toLowerCase() : ''
}

export function getDocumentInfo(fileName: string, mimeType?: string): DocumentInfo {
  const extension = getFileExtension(fileName)
  const label = (extension || 'FILE').toUpperCase()
  const color = EXTENSION_COLORS[extension] ?? '#8696a0'

  if (extension === 'pdf' || mimeType === 'application/pdf') {
    return { label, color: EXTENSION_COLORS.pdf, description: 'PDF document' }
  }

  if (mimeType?.startsWith('audio/')) {
    return { label, color: EXTENSION_COLORS.mp3, description: 'Audio' }
  }

  return { label, color, description: 'Document' }
}
