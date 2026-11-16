import {
  FILE_PICKER_MESSAGES,
  type ChooseNativeFileOptions,
  type ChooseNativeFileSuccess,
  type FilePickerErrorCode
} from './types'

export function successAndComplete(
  options: ChooseNativeFileOptions,
  result: ChooseNativeFileSuccess
): void {
  if (options.success) options.success(result)
  if (options.complete) options.complete()
}

export function failAndComplete(
  options: ChooseNativeFileOptions,
  errCode: FilePickerErrorCode,
  errMsg?: string
): void {
  if (options.fail) {
    options.fail({
      errCode,
      errMsg: errMsg || FILE_PICKER_MESSAGES[errCode]
    })
  }
  if (options.complete) options.complete()
}
