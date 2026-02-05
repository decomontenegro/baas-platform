const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

interface ApiErrorResponse {
  error?: {
    message: string
    code?: string
    details?: unknown
  }
  message?: string
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`)
  
  if (!res.ok) {
    let errorMessage = 'An error occurred while fetching the data.'
    try {
      const errorData: ApiErrorResponse = await res.json()
      errorMessage = errorData.error?.message || errorData.message || errorMessage
    } catch {
      // Ignore JSON parse errors for error responses
    }
    throw new Error(errorMessage)
  }
  
  // API returns data directly, not wrapped in { success, data }
  return res.json()
}

export async function postData<T>(url: string, data: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    throw new Error('Failed to post data')
  }
  return res.json()
}

export async function patchData<T>(url: string, data: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    throw new Error('Failed to update data')
  }
  return res.json()
}

export async function deleteData(url: string): Promise<void> {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    throw new Error('Failed to delete data')
  }
}
