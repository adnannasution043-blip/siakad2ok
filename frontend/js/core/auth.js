// ============================================================
// AUTH.JS — Authentication helper
// DEV_MODE = false → real JWT login required
// ============================================================
const DEV_MODE = false

const Auth = (() => {
  const USER_KEY = 'siakad_user'

  const getUser = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  }

  const setUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u))

  const isLoggedIn = () => !!API.getToken() && !!getUser()

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password })
    API.setTokens(res.data.access_token, res.data.refresh_token)
    setUser(res.data.user)
    return res.data
  }

  const logout = () => {
    API.clearTokens()
    localStorage.removeItem(USER_KEY)
  }

  const hasRole = (...roles) => {
    const user = getUser()
    return user && roles.includes(user.role)
  }

  // Returns the linked mahasiswa.id or dosen.id (null for admin roles)
  const getEntityId = () => {
    const user = getUser()
    return user?.entity_id || null
  }

  // Redirect to dashboard if user doesn't have an allowed role
  const requireRole = (...roles) => {
    if (!hasRole(...roles)) {
      window.location.hash = '#/dashboard'
      return false
    }
    return true
  }

  return { getUser, setUser, isLoggedIn, login, logout, hasRole, getEntityId, requireRole }
})()
