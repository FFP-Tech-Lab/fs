// #ifdef APP-PLUS
import { chooseNativeFileAndroid } from './android'
import { chooseNativeFileIos } from './ios'
// #endif
import type { ChooseNativeFileOptions } from './types'
import { failAndComplete } from './callback'

export type {
  NativePickedFile,
  ChooseNativeFileSuccess,
  FilePickerErrorCode,
  FilePickerFail,
  ChooseNativeFileOptions
} from './types'

export function chooseNativeFile(options: ChooseNativeFileOptions): void {
  // #ifdef APP-PLUS
  const platform = uni.getSystemInfoSync().platform
  if (platform === 'android') {
    chooseNativeFileAndroid(options)
    return
  }
  if (platform === 'ios') {
    chooseNativeFileIos(options)
    return
  }
  failAndComplete(options, 9010002)
  return
  // #endif
  // #ifndef APP-PLUS
  failAndComplete(options, 9010002)
  // #endif
}
