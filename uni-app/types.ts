export type NativePickedFile = {
  name: string
  path: string
  size: number
  mime: string
}

export type ChooseNativeFileSuccess = {
  tempFiles: NativePickedFile[]
  tempFilePaths: string[]
  truncated: boolean
}

export type FilePickerErrorCode = 9010001 | 9010002 | 9010003 | 9010004

export type FilePickerFail = {
  errCode: FilePickerErrorCode
  errMsg: string
}

export type ChooseNativeFileOptions = {
  count?: number
  extension?: string[]
  success?: (res: ChooseNativeFileSuccess) => void
  fail?: (err: FilePickerFail) => void
  complete?: () => void
}

export const FILE_PICKER_MESSAGES: Record<FilePickerErrorCode, string> = {
  9010001: '已取消',
  9010002: '当前页面不可用',
  9010003: '文件复制失败',
  9010004: '没有符合类型的文件'
}
