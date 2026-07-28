// ============================================================
// ROUTER.JS — Hash-based SPA router
// ============================================================
const Router = (() => {
  const routes = {}
  let currentPage = null

  const register = (hash, handler) => { routes[hash] = handler }

  const navigate = (hash) => { window.location.hash = hash }

  const resolve = async () => {
    const hash = window.location.hash || '#/dashboard'
    const page = hash.replace('#/', '').split('/')[0] || 'dashboard'
    const params = hash.replace('#/', '').split('/').slice(1)

    // Update sidebar active state
    document.querySelectorAll('.sidebar-link').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page)
    })

    const handler = routes[page]
    if (!handler) {
      document.getElementById('page-content').innerHTML = `
        <div class="flex flex-col items-center justify-center h-64 text-slate-400">
          <p class="text-4xl font-bold mb-2">404</p>
          <p class="text-sm">Halaman tidak ditemukan</p>
        </div>`
      return
    }

    UI.setLoading(true)
    try {
      await handler(params)
    } catch (e) {
      console.error(e)
      document.getElementById('page-content').innerHTML = `
        <div class="text-center py-16 text-red-500 text-sm">
          Gagal memuat halaman: ${e.message || 'Terjadi kesalahan'}
        </div>`
    } finally {
      UI.setLoading(false)
    }
    currentPage = page
  }

  const setPageMeta = (title, subtitle = '') => {
    document.getElementById('page-title').textContent = title
    document.getElementById('page-subtitle').textContent = subtitle
  }

  window.addEventListener('hashchange', resolve)

  return { register, navigate, resolve, setPageMeta }
})()
