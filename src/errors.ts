/**
 * Axios-shaped HTTP error, duck-typed so we don't depend on axios (it reaches
 * us transitively through `@inkdropapp/ipm`).
 */
type HttpError = {
  config?: RequestConfig
  response?: HttpErrorResponse
}

type RequestConfig = {
  method?: string
  url?: string
  baseURL?: string
}

type HttpErrorResponse = {
  status?: number
  statusText?: string
  data?: unknown
  config?: RequestConfig
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined
}

/**
 * Find the HTTP error in the `cause` chain. `@inkdropapp/ipm` re-throws Axios
 * failures wrapped in an `Error` that explains the operation, so the request
 * details live one or more levels down.
 */
function findHttpError(error: unknown): HttpError | undefined {
  const seen = new Set<unknown>()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    const candidate = asObject(current)
    if (!candidate) {
      return undefined
    }
    if (asObject(candidate.response) || asObject(candidate.config)) {
      return candidate as HttpError
    }
    current = candidate.cause
  }

  return undefined
}

function getResponseBodyMessage(data: unknown): string | undefined {
  if (typeof data === 'string') {
    return data.trim() || undefined
  }
  const body = asObject(data)
  if (!body) {
    return undefined
  }

  const { message, error } = body
  if (typeof message === 'string' && message) {
    return message
  }
  if (typeof error === 'string' && error) {
    return error
  }

  const serialized = JSON.stringify(body)
  return serialized === '{}' ? undefined : serialized
}

function getResponseMessage(response: HttpErrorResponse | undefined): string | undefined {
  if (!response) {
    return undefined
  }
  const status = [response.status, response.statusText].filter(Boolean).join(' ')
  const body = getResponseBodyMessage(response.data)
  if (status && body) {
    return `${status} - ${body}`
  }
  return status || body
}

function getRequestUrl({ baseURL, url }: RequestConfig): string | undefined {
  if (!url) {
    return baseURL
  }
  if (!baseURL || /^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    return url
  }
  return `${baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`
}

/** Renders the request as `POST https://api.inkdrop.app/v2/packages`. */
function getRequestSummary(httpError: HttpError): string | undefined {
  const config = httpError.config ?? httpError.response?.config
  if (!config) {
    return undefined
  }

  const url = getRequestUrl(config)
  if (!url) {
    return undefined
  }

  const method = typeof config.method === 'string' ? config.method.toUpperCase() : undefined
  return method ? `${method} ${url}` : url
}

/**
 * Reduce a thrown value to a single human-readable line.
 *
 * HTTP failures surface the request, the status, and the server's response
 * body — the only parts that explain *what* was attempted and *why* it failed.
 * Dumping the raw error object instead buries them under a stack trace and
 * truncates the body to `[Object]`.
 *
 * @param error - The caught value, of any type
 * @returns A message suitable for printing to the terminal
 */
export function formatError(error: unknown): string {
  const httpError = findHttpError(error)

  // A wrapper Error already names the failed operation, so only unwrap the
  // response when the HTTP error is the value that was thrown.
  const responseMessage =
    httpError && httpError === error ? getResponseMessage(httpError.response) : undefined

  const message =
    responseMessage ?? (error instanceof Error ? error.message || String(error) : String(error))

  const request = httpError && getRequestSummary(httpError)
  return request ? `${message}\n(${request})` : message
}
