// ============================================================
// AUTH.JS — Skip login untuk development lokal
// Ganti DEV_MODE = false kalau sudah mau pakai login beneran
// ============================================================
const DEV_MODE = true

const DEV_USER = {
  id: 'usr-001',
  email: 'admin@siakad.ac.id',
  nama: 'Administrator',
  role: 'super_admin',
  foto_url: null,
}

const Auth = (() => {
  const USER_KEY = 'user'

  const getUser = () => {
    if (DEV_MODE) return DEV_USER
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  }

  const setUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u))

  const isLoggedIn = () => {
    if (DEV_MODE) return true
    return !!API.getToken() && !!getUser()
  }

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password })
    API.setTokens(res.data.access_token, res.data.refresh_token)
    setUser(res.data.user)
    return res.data
  }

  const logout = () => {
    if (DEV_MODE) return // skip di dev mode
    API.clearTokens()
    localStorage.removeItem(USER_KEY)
  }

  const hasRole = (...roles) => {
    const user = getUser()
    return user && roles.includes(user.role)
  }

  return { getUser, setUser, isLoggedIn, login, logout, hasRole }
})()
