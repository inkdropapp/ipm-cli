import { describe, expect, it } from 'vitest'

import { formatError } from '../src/errors.js'

type AxiosErrorFields = {
  status?: number
  statusText?: string
  data?: unknown
  method?: string
  url?: string
  baseURL?: string
  message?: string
}

/** Builds an Axios-shaped error without pulling axios into the test. */
function axiosError({
  status,
  statusText,
  data,
  method,
  url,
  baseURL,
  message = status ? `Request failed with status code ${status}` : 'Network Error'
}: AxiosErrorFields) {
  const config = method || url || baseURL ? { method, url, baseURL } : undefined
  const response = status || statusText || data ? { status, statusText, data } : undefined
  return Object.assign(new Error(message), { isAxiosError: true, config, response })
}

const PUBLISH_REQUEST = {
  method: 'post',
  url: '',
  baseURL: 'https://api.inkdrop.app/v2/packages'
}

describe('formatError', () => {
  it('returns the message of a plain Error', () => {
    expect(formatError(new Error('Something broke'))).toBe('Something broke')
  })

  it('appends the request to the wrapper message of an Error with an HTTP cause', () => {
    const error = new Error('Upload failed: 409 - Document update conflict.', {
      cause: axiosError({
        status: 409,
        statusText: 'Conflict',
        data: { message: 'Document update conflict.' },
        ...PUBLISH_REQUEST
      })
    })
    expect(formatError(error)).toBe(
      'Upload failed: 409 - Document update conflict. (POST https://api.inkdrop.app/v2/packages)'
    )
  })

  it('finds an HTTP error nested deeper in the cause chain', () => {
    const inner = axiosError({ status: 404, statusText: 'Not Found', ...PUBLISH_REQUEST })
    const error = new Error('outer', { cause: new Error('middle', { cause: inner }) })
    expect(formatError(error)).toBe('outer (POST https://api.inkdrop.app/v2/packages)')
  })

  it('reads the response body message of an HTTP error', () => {
    const error = axiosError({
      status: 409,
      statusText: 'Conflict',
      data: { message: 'Document update conflict.' },
      ...PUBLISH_REQUEST
    })
    expect(formatError(error)).toBe(
      '409 Conflict - Document update conflict. (POST https://api.inkdrop.app/v2/packages)'
    )
  })

  it('falls back to the `error` field of the response body', () => {
    const error = axiosError({
      status: 403,
      statusText: 'Forbidden',
      data: { error: 'Not the package owner' }
    })
    expect(formatError(error)).toBe('403 Forbidden - Not the package owner')
  })

  it('uses a plain-text response body as the message', () => {
    const error = axiosError({ status: 502, statusText: 'Bad Gateway', data: '  upstream down  ' })
    expect(formatError(error)).toBe('502 Bad Gateway - upstream down')
  })

  it('serializes an unrecognized response body', () => {
    const error = axiosError({
      status: 422,
      statusText: 'Unprocessable Entity',
      data: { reason: 'bad version' }
    })
    expect(formatError(error)).toBe('422 Unprocessable Entity - {"reason":"bad version"}')
  })

  it('reports the status alone when the response body carries no message', () => {
    expect(formatError(axiosError({ status: 500, statusText: 'Server Error', data: {} }))).toBe(
      '500 Server Error'
    )
    expect(formatError(axiosError({ status: 404, statusText: 'Not Found' }))).toBe('404 Not Found')
  })

  it('omits a missing statusText', () => {
    expect(formatError(axiosError({ status: 400, data: 'nope' }))).toBe('400 - nope')
  })

  it('falls back to the error message when the response carries nothing usable', () => {
    const error = Object.assign(new Error('Network Error'), { response: {} })
    expect(formatError(error)).toBe('Network Error')
  })

  it('reports the request of a failure that never got a response', () => {
    const error = axiosError({
      message: 'getaddrinfo ENOTFOUND api.inkdrop.app',
      method: 'get',
      url: '/my-plugin',
      baseURL: 'https://api.inkdrop.app/v2/packages'
    })
    expect(formatError(error)).toBe(
      'getaddrinfo ENOTFOUND api.inkdrop.app (GET https://api.inkdrop.app/v2/packages/my-plugin)'
    )
  })

  it('joins baseURL and url without doubling the separator', () => {
    const error = axiosError({
      status: 404,
      method: 'delete',
      baseURL: 'https://api.inkdrop.app/v2/packages/',
      url: '/my-plugin/versions/1.0.0'
    })
    expect(formatError(error)).toBe(
      '404 (DELETE https://api.inkdrop.app/v2/packages/my-plugin/versions/1.0.0)'
    )
  })

  it('prefers an absolute url over the baseURL', () => {
    const error = axiosError({
      status: 500,
      method: 'get',
      baseURL: 'https://api.inkdrop.app/v2/packages',
      url: 'https://example.com/tarball.tgz'
    })
    expect(formatError(error)).toBe('500 (GET https://example.com/tarball.tgz)')
  })

  it('reports the url alone when the method is unknown', () => {
    expect(formatError(axiosError({ status: 500, url: 'https://api.inkdrop.app/v2' }))).toBe(
      '500 (https://api.inkdrop.app/v2)'
    )
  })

  it('omits the request when there is no url to report', () => {
    expect(formatError(axiosError({ status: 500, method: 'get' }))).toBe('500')
  })

  it('survives a cyclic cause chain', () => {
    const error: Error & { cause?: unknown } = new Error('looping')
    error.cause = error
    expect(formatError(error)).toBe('looping')
  })

  it('handles errors thrown as non-Error values', () => {
    expect(formatError('just a string')).toBe('just a string')
    expect(formatError(42)).toBe('42')
    expect(formatError(null)).toBe('null')
    expect(formatError(undefined)).toBe('undefined')
  })

  it('falls back to the string form of an Error with an empty message', () => {
    expect(formatError(new Error(''))).toBe('Error')
  })
})
