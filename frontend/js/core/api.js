// ============================================================
// API.JS — HTTP client terpusat
// DEV_MODE = true → pakai dummy token, skip refresh logic
// ============================================================
const API = (() => {
  const BASE_URL = '/api/v1'
  // Token dummy untuk dev mode (backend juga perlu di-bypass)
  const DEV_TOKEN = 'dev-mode-token'

  const getToken = () => DEV_MODE
    ? DEV_TOKEN
    : localStorage.getItem('access_token')

  const setTokens = (access, refresh) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
  }

  const clearTokens = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
  }

  const request = async (method, path, body = null) => {
    const headers = { 'Content-Type': 'application/json' }
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`

    const config = {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    }

    const res = await fetch(`${BASE_URL}${path}`, config)
    const json = await res.json()
    if (!res.ok) throw { status: res.status, message: json.message || 'Terjadi kesalahan', data: json }
    return json
  }

  return {
    get: (path, params = {}) => {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== '' && v != null)
      ).toString()
      return request('GET', path + (qs ? `?${qs}` : ''))
    },
    post:   (path, body) => request('POST',   path, body),
    put:    (path, body) => request('PUT',    path, body),
    patch:  (path, body) => request('PATCH',  path, body),
    delete: (path)       => request('DELETE', path),
    setTokens,
    clearTokens,
    getToken,
  }
})()
