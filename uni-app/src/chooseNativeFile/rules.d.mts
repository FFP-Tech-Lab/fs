import type { NativePickedFile } from './types'

export type FileSource = {
  name: string
  mime: string
}

export type SelectFilesResult =
  | {
      ok: true
      errCode: 0
      files: NativePickedFile[]
      truncated: boolean
    }
  | {
      ok: false
      errCode: 9010003 | 9010004
      files: NativePickedFile[]
      truncated: false
    }

export function normalizeCount(count: number | null | undefined): number

export function normalizeExtensions(
  extension: ReadonlyArray<string | null | undefined> | null | undefined
): string[]

export function isPdfOnly(
  extension: ReadonlyArray<string | null | undefined> | null | undefined
): boolean

export function extensionOf(name: string | null | undefined): string

export function fileMatches(name: string, mime: string, allowed: readonly string[]): boolean

export function sanitizeFileName(name: string | null | undefined): string

export function displayNameFor(raw: string | null | undefined, mime: string): string

export function resolveMime(name: string, systemMime: string | null | undefined): string

export function buildStoredName(
  stamp: number,
  index: number,
  displayName: string,
  mime: string
): string

export function selectFiles<TSource extends FileSource>(
  sources: readonly TSource[],
  count: number | null | undefined,
  extension: ReadonlyArray<string | null | undefined> | null | undefined,
  copy: (source: TSource, index: number) => NativePickedFile | null
): SelectFilesResult
