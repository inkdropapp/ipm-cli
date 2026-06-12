import { Entry } from '@napi-rs/keyring'
import open from 'open'

import { INKDROP_ACCESS_KEY_URI, KEYRING_ACCOUNT, KEYRING_SERVICE } from './consts.js'

type AccessKey = {
  accessKeyId: string
  secretAccessKey: string
}

/**
 * Get the keyring entry
 */
function getEntry(): Entry {
  return new Entry(KEYRING_SERVICE, KEYRING_ACCOUNT)
}

/**
 * Get the access token from the keyring
 * @returns The access token if it exists, null otherwise
 */
export function getAccessToken(): AccessKey | null {
  try {
    const entry = getEntry()
    const token = entry.getPassword()
    if (token) {
      const [accessKeyId, secretAccessKey] = token.split(':')
      return { accessKeyId, secretAccessKey }
    } else {
      return null
    }
  } catch (_error) {
    return null
  }
}

/**
 * Save the access token to the keyring
 * @param token The access token to save
 */
export function saveAccessToken(token: string): void {
  const entry = getEntry()
  entry.setPassword(token)
}

/**
 * Open the Inkdrop desktop app to display the access key
 */
export async function openAccessKeyPage(): Promise<void> {
  await open(INKDROP_ACCESS_KEY_URI)
}

/**
 * Check if the user is authenticated
 * @returns true if authenticated, false otherwise
 */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null
}
