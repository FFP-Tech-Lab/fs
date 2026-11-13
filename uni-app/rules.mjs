const ILLEGAL = '<>:"/\\|?*'

export function normalizeCount(count) {
  if (!(count >= 1)) return 1
  return Math.floor(count)
}

export function normalizeExtensions(extension) {
  if (!Array.isArray(extension)) return []
  return extension
    .map((item) => String(item == null ? '' : item).trim().toLowerCase())
    .map((item) => (item.startsWith('.') ? item.slice(1) : item))
    .filter((item) => item !== '')
}

export function isPdfOnly(extension) {
  const allowed = normalizeExtensions(extension)
  return allowed.length > 0 && allowed.every((item) => item === 'pdf')
}

export function extensionOf(name) {
  const text = String(name == null ? '' : name)
  const dot = text.lastIndexOf('.')
  if (dot < 0 || dot === text.length - 1) return ''
  return text.slice(dot + 1).toLowerCase()
}

export function fileMatches(name, mime, allowed) {
  if (allowed.length === 0) return true
  const ext = extensionOf(name)
  if (ext !== '' && allowed.includes(ext)) return true
  return ext === '' && allowed.includes('pdf') && mime === 'application/pdf'
}

export function sanitizeFileName(name) {
  const text = String(name == null ? '' : name)
  let out = ''
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i)
    const code = text.charCodeAt(i)
    const isControl = code <= 31 || code === 127
    const isWhitespace =
      ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v'
    if (ILLEGAL.indexOf(ch) >= 0 || (isControl && !isWhitespace)) out += '_'
    else out += ch
  }
  return out
}

export function displayNameFor(raw, mime) {
  const name = String(raw == null ? '' : raw).trim()
  if (name !== '') return name
  if (mime === 'application/pdf') return '附件.pdf'
  return '附件'
}

export function resolveMime(name, systemMime) {
  if (extensionOf(name) === 'pdf') return 'application/pdf'
  const mime = String(systemMime == null ? '' : systemMime).trim()
  if (mime !== '') return mime
  return 'application/octet-stream'
}

export function buildStoredName(stamp, index, displayName, mime) {
  const shown = displayNameFor(displayName, mime)
  return String(stamp) + '-' + String(index) + '-' + sanitizeFileName(shown)
}

export function selectFiles(sources, count, extension, copy) {
  const limit = normalizeCount(count)
  const allowed = normalizeExtensions(extension)
  const matched = []
  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i]
    if (fileMatches(source.name, source.mime, allowed)) matched.push(source)
  }
  if (matched.length === 0) {
    return { ok: false, errCode: 9010004, files: [], truncated: false }
  }
  const files = []
  for (let i = 0; i < matched.length && files.length < limit; i += 1) {
    const saved = copy(matched[i], files.length)
    if (saved != null) files.push(saved)
  }
  if (files.length === 0) {
    return { ok: false, errCode: 9010003, files: [], truncated: false }
  }
  return { ok: true, errCode: 0, files, truncated: matched.length > limit }
}
