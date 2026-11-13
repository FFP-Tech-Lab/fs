import { buildStoredName, displayNameFor, isPdfOnly, normalizeCount, resolveMime, selectFiles } from './rules.mjs'
import { failAndComplete, successAndComplete } from './callback'
import type { ChooseNativeFileOptions, NativePickedFile } from './types'

const REQUEST_CODE = 91021
let picking = false

type Source = { name: string; mime: string; uri: any }

export function chooseNativeFileAndroid(options: ChooseNativeFileOptions): void {
  if (picking) return
  const main = plus.android.runtimeMainActivity() as any
  if (!main) {
    failAndComplete(options, 9010002)
    return
  }

  const Intent = plus.android.importClass('android.content.Intent') as any
  const Activity = plus.android.importClass('android.app.Activity') as any
  const intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
  intent.addCategory(Intent.CATEGORY_OPENABLE)
  intent.setType(isPdfOnly(options.extension || []) ? 'application/pdf' : '*/*')
  intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
  if (normalizeCount(options.count as number) > 1) {
    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
  }

  const previous = main.onActivityResult
  picking = true
  main.onActivityResult = function (requestCode: number, resultCode: number, data: any) {
    if (requestCode !== REQUEST_CODE) {
      if (typeof previous === 'function') previous(requestCode, resultCode, data)
      return
    }
    picking = false
    main.onActivityResult = previous
    if (resultCode !== Activity.RESULT_OK || data == null) {
      failAndComplete(options, 9010001)
      return
    }
    try {
      ensureCacheDir()
      const sources = collectSources(main, data)
      const stamp = Date.now()
      const outcome = selectFiles(
        sources,
        options.count as number,
        options.extension || [],
        (source: Source, index: number) => copyUri(main, source, stamp, index)
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

  try {
    main.startActivityForResult(intent, REQUEST_CODE)
  } catch {
    picking = false
    main.onActivityResult = previous
    failAndComplete(options, 9010002)
  }
}

function cacheDirPath(): string {
  return plus.io.convertLocalFileSystemURL('_doc/yelo-file-picker')
}

function ensureCacheDir(): void {
  const File = plus.android.importClass('java.io.File') as any
  const dir = new File(cacheDirPath())
  if (!dir.exists()) dir.mkdirs()
}

function queryDisplayName(main: any, uri: any): string {
  let name = ''
  let cursor: any = null
  try {
    const resolver = contentResolver(main)
    cursor = resolver.query(uri, ['_display_name'], null, null, null)
    if (cursor != null) {
      plus.android.importClass(cursor)
      if (cursor.moveToFirst()) {
        const idx = cursor.getColumnIndex('_display_name')
        if (idx >= 0) name = String(cursor.getString(idx) || '')
      }
    }
  } catch {
    // Display name is optional; displayNameFor fills in when the provider query fails.
  } finally {
    if (cursor != null) {
      try {
        cursor.close()
      } catch {
        // A failed close must not drop a display name we already read.
      }
    }
  }
  return name
}

function collectSources(main: any, data: any): Source[] {
  const resolver = contentResolver(main)
  const out: Source[] = []
  const clip = data.getClipData && data.getClipData()
  if (clip != null) {
    plus.android.importClass(clip)
    if (clip.getItemCount() > 0) {
      const count = clip.getItemCount()
      for (let i = 0; i < count; i += 1) {
        const item = clip.getItemAt(i)
        plus.android.importClass(item)
        const uri = item.getUri()
        const mime = String(resolver.getType(uri) || '')
        out.push({ name: queryDisplayName(main, uri), mime, uri })
      }
      return out
    }
  }
  const uri = data.getData && data.getData()
  if (uri != null) {
    const mime = String(resolver.getType(uri) || '')
    out.push({ name: queryDisplayName(main, uri), mime, uri })
  }
  return out
}

function contentResolver(main: any): any {
  const resolver = main.getContentResolver()
  plus.android.importClass(resolver)
  return resolver
}

// android.os.FileUtils.copy 需要 API 29（Android 10）
const FILE_UTILS_MIN_ANDROID = 10

/**
 * byte[] 经 HTML5+ 桥接后会被转成 JS 数组副本，InputStream 读入的数据写不回该副本，
 * 写出的文件全是 0，因此字节不能经过 JS 侧缓冲区。
 */
function copyStream(input: any, output: any): void {
  if (parseInt(String(plus.os.version || ''), 10) >= FILE_UTILS_MIN_ANDROID) {
    const FileUtils = plus.android.importClass('android.os.FileUtils') as any
    FileUtils.copy(input, output)
    return
  }
  const BufferedInputStream = plus.android.importClass('java.io.BufferedInputStream') as any
  const BufferedOutputStream = plus.android.importClass('java.io.BufferedOutputStream') as any
  const bufferedInput = new BufferedInputStream(input)
  const bufferedOutput = new BufferedOutputStream(output)
  let byte = bufferedInput.read()
  while (byte >= 0) {
    bufferedOutput.write(byte)
    byte = bufferedInput.read()
  }
  bufferedOutput.flush()
}

function copyUri(main: any, source: Source, stamp: number, index: number): NativePickedFile | null {
  const File = plus.android.importClass('java.io.File') as any
  const FileOutputStream = plus.android.importClass('java.io.FileOutputStream') as any
  const mime = resolveMime(source.name, source.mime)
  const shown = displayNameFor(source.name, mime)
  const stored = buildStoredName(stamp, index, shown, mime)
  const destPath = cacheDirPath() + '/' + stored
  const dest = new File(destPath)
  let input: any = null
  let output: any = null
  try {
    input = contentResolver(main).openInputStream(source.uri)
    if (input == null) return null
    plus.android.importClass(input)
    output = new FileOutputStream(dest)
    copyStream(input, output)
    output.flush()
    const size = dest.length()
    return { name: shown, path: destPath, size: Number(size), mime }
  } catch {
    try {
      if (dest.exists()) dest.delete()
    } catch {
      // Best-effort cleanup after a failed copy.
    }
    return null
  } finally {
    try {
      if (input != null) input.close()
    } catch {
      // Closing the source stream is best-effort.
    }
    try {
      if (output != null) output.close()
    } catch {
      // Closing the destination stream is best-effort.
    }
  }
}
