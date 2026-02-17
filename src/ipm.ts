import { IPM } from '@inkdropapp/ipm'
import { getAccessToken } from './auth.js'
import { INKDROP_VERSIOON } from './consts.js'

/**
 * Get the IPM instance with authentication
 */
export function getIPM(): IPM {
  const accessKey = getAccessToken()

  const ipm = new IPM({
    appVersion: process.env.INKDROP_VERSION || INKDROP_VERSIOON, // You may want to make this configurable
    accessKeyId: accessKey?.accessKeyId,
    secretAccessKey: accessKey?.secretAccessKey
  })

  return ipm
}
