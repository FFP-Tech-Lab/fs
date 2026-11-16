import { buildStoredName, displayNameFor, isPdfOnly, normalizeCount, resolveMime, selectFiles } from './rules.mjs'
import { failAndComplete, successAndComplete } from './callback'
import type { ChooseNativeFileOptions, NativePickedFile } from './types'

let picking = false

type Source = { name: string; mime: string; path: string }

type IosInvoke = (obj: any, name: string, ...args: any[]) => any

type ChosenFile = string | { path?: string }
type ChooseFileEvent = { files?: ChosenFile[] }
type ChooseFileError = { code?: number; message?: string }
type ChooseFileRequest = {
  title?: string
  filetypes?: string[] | undefined
  multiple?: boolean
  success?: (event: ChooseFileEvent) => void
  fail?: (error: ChooseFileError) => void
}
type ChooseFileFn = (
  options: ChooseFileRequest,
  success?: (event: ChooseFileEvent) => void,
  fail?: (error: ChooseFileError) => void
) => void

// NSCachesDirectory = 13, NSUserDomainMask = 1
const NS_CACHES_DIRECTORY = 13
const NS_USER_DOMAIN_MASK = 1
// The attachment action sheet is still dismissing when its callback runs.
const PRESENT_SETTLE_MS = 400

function iosInvoke(obj: any, name: string, ...args: any[]): any {
  const invoke = plus.ios.invoke as IosInvoke
  return invoke(obj, name, ...args)
}

export function chooseNativeFileIos(options: ChooseNativeFileOptions): void {
  if (picking) return
  const chooseFile = systemChooseFile()
  if (!chooseFile) {
    failAndComplete(options, 9010002, '系统选文件不可用')
    return
  }
  picking = true
  setTimeout(() => openSystemPicker(chooseFile, options), PRESENT_SETTLE_MS)
}

function systemChooseFile(): ChooseFileFn | null {
  const io = (plus as { io?: { chooseFile?: ChooseFileFn } }).io
  if (!io || typeof io.chooseFile !== 'function') return null
  return io.chooseFile.bind(io)
}

function openSystemPicker(chooseFile: ChooseFileFn, options: ChooseNativeFileOptions): void {
  if (!picking) return
  const pdfOnly = isPdfOnly(options.extension || [])
  const onSuccess = (event: ChooseFileEvent) => acceptChosenFiles(options, chosenPaths(event))
  const onFail = (error: ChooseFileError) => {
    if (!picking) return
    picking = false
    if (isCancel(error)) failAndComplete(options, 9010001)
    else failAndComplete(options, 9010002, errorText(error))
  }
  try {
    // The runtime reads the success callback as the second argument.
    // Keeping it on the request as well covers the options-callback form.
    chooseFile(
      {
        title: '选择文件',
        filetypes: pdfOnly ? ['pdf'] : undefined,
        multiple: normalizeCount(options.count as number) > 1,
        success: onSuccess,
        fail: onFail
      },
      onSuccess,
      onFail
    )
  } catch (error) {
    if (!picking) return
    picking = false
    failAndComplete(options, 9010002, errorText(error))
  }
}

function chosenPaths(event: ChooseFileEvent): string[] {
  if (!event || !Array.isArray(event.files)) return []
  const paths: string[] = []
  for (let i = 0; i < event.files.length; i += 1) {
    const item = event.files[i]
    if (typeof item === 'string' && item !== '') paths.push(item)
    else if (item && typeof item.path === 'string' && item.path !== '') paths.push(item.path)
  }
  return paths
}

function isCancel(error: ChooseFileError | undefined): boolean {
  if (error && error.code === 12) return true
  const text = String(error?.message || '').toLowerCase()
  return text.includes('cancel') || text.includes('取消')
}

function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '')
    if (message) return message.length > 36 ? message.slice(0, 36) : message
  }
  const raw = error instanceof Error ? error.message : String(error || '')
  const text = raw.replace(/^Error:\s*/, '').trim()
  if (!text || text === 'undefined') return ''
  return text.length > 36 ? text.slice(0, 36) : text
}

function acceptChosenFiles(options: ChooseNativeFileOptions, paths: string[]): void {
  if (!picking) return
  picking = false
  try {
    const cacheDir = ensureCacheDir()
    const pdfOnly = isPdfOnly(options.extension || [])
    const sources: Source[] = paths.map((path) => ({
      name: fileNameOf(path),
      mime: pdfOnly ? 'application/pdf' : '',
      path
    }))
    const stamp = Date.now()
    const outcome = selectFiles(
      sources,
      options.count as number,
      options.extension || [],
      (source: Source, index: number) => copyPath(source, cacheDir, stamp, index)
    )
    if (!outcome.ok) {
      failAndComplete(options, outcome.errCode as 9010003 | 9010004)
      return
    }
    const tempFiles = outcome.files as NativePickedFile[]
    successAndComplete(options, {
      tempFiles,
      tempFilePaths: tempFiles.map((file) => file.path),
      truncated: outcome.truncated
    })
  } catch {
    failAndComplete(options, 9010003)
  }
}

function fileNameOf(path: string): string {
  const parts = String(path).split('/')
  return parts[parts.length - 1] ?? ''
}

function ensureCacheDir(): string {
  const base = cachesDirectory().replace(/\/+$/, '')
  if (!base) {
    throw new Error('ios caches directory unavailable')
  }
  const dir = base + '/yelo-file-picker'
  const fm = fileManager()
  if (!nativeBool(iosInvoke(fm, 'fileExistsAtPath:', dir))) {
    iosInvoke(
      fm,
      'createDirectoryAtPath:withIntermediateDirectories:attributes:error:',
      dir,
      true,
      null,
      null
    )
  }
  return dir
}

function cachesDirectory(): string {
  const fromInvoke = cachesDirectoryFromInvoke()
  if (fromInvoke) return fromInvoke
  return cachesDirectoryFromImport()
}

function cachesDirectoryFromInvoke(): string {
  try {
    const fm = iosInvoke('NSFileManager', 'defaultManager')
    if (fm == null) return ''
    const urls = iosInvoke(fm, 'URLsForDirectory:inDomains:', NS_CACHES_DIRECTORY, NS_USER_DOMAIN_MASK)
    return pathFromDirectoryUrls(urls)
  } catch {
    // Class-name invoke can miss; importClass below is the same URLsForDirectory call.
    return ''
  }
}

function cachesDirectoryFromImport(): string {
  try {
    const NSFileManager = plus.ios.importClass('NSFileManager') as any
    const fm = NSFileManager.defaultManager()
    const urls = fm.URLsForDirectoryinDomains(NS_CACHES_DIRECTORY, NS_USER_DOMAIN_MASK)
    return pathFromDirectoryUrls(urls)
  } catch {
    return ''
  }
}

function pathFromDirectoryUrls(urls: any): string {
  if (urls == null) return ''
  const url = iosInvoke(urls, 'objectAtIndex:', 0)
  if (url == null) return ''
  return String(iosInvoke(url, 'path') || '')
}

function fileManager(): any {
  try {
    const fm = iosInvoke('NSFileManager', 'defaultManager')
    if (fm != null) return fm
  } catch {
    // Class-name invoke can miss; importClass below is the same defaultManager call.
  }
  const NSFileManager = plus.ios.importClass('NSFileManager') as any
  return NSFileManager.defaultManager()
}

function copyPath(
  source: Source,
  cacheDir: string,
  stamp: number,
  index: number
): NativePickedFile | null {
  const mime = resolveMime(source.name, source.mime)
  const shown = displayNameFor(source.name, mime)
  const stored = buildStoredName(stamp, index, shown, mime)
  const destPath = cacheDir + '/' + stored
  try {
    const fm = fileManager()
    if (nativeBool(iosInvoke(fm, 'fileExistsAtPath:', destPath))) {
      iosInvoke(fm, 'removeItemAtPath:error:', destPath, null)
    }
    iosInvoke(fm, 'copyItemAtPath:toPath:error:', source.path, destPath, null)
    if (!nativeBool(iosInvoke(fm, 'fileExistsAtPath:', destPath))) return null
    const attrs = iosInvoke(fm, 'attributesOfItemAtPath:error:', destPath, null)
    const sizeObj = attrs ? iosInvoke(attrs, 'objectForKey:', 'NSFileSize') : null
    return { name: shown, path: destPath, size: byteLength(sizeObj), mime }
  } catch {
    return null
  }
}

function nativeBool(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (value == null) return false
  try {
    const numeric = iosInvoke(value, 'boolValue')
    if (typeof numeric === 'boolean') return numeric
    if (typeof numeric === 'number') return numeric !== 0
  } catch {
    // value was already a JS boolean the bridge did not box.
  }
  return false
}

function byteLength(sizeObj: any): number {
  if (sizeObj == null) return 0
  if (typeof sizeObj === 'number') return sizeObj
  try {
    const numeric = iosInvoke(sizeObj, 'longLongValue')
    const size = numeric != null ? Number(numeric) : Number.NaN
    return Number.isFinite(size) ? size : 0
  } catch {
    const size = Number(sizeObj)
    return Number.isFinite(size) ? size : 0
  }
}
