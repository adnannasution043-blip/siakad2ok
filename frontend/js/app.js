// ============================================================
// APP.JS — Entry point + RBAC
// ============================================================

// Route → allowed roles (null = semua role boleh akses)
const ROUTE_ROLES = {
  dashboard:           null,
  mahasiswa:           ['super_admin', 'admin_akademik', 'kaprodi', 'dosen'],
  dosen:               ['super_admin', 'admin_akademik', 'kaprodi', 'lppm'],
  kelas:               ['super_admin', 'admin_akademik', 'kaprodi', 'dosen'],
  krs:                 ['super_admin', 'admin_akademik', 'kaprodi', 'dosen', 'mahasiswa'],
  nilai:               ['super_admin', 'admin_akademik', 'kaprodi', 'dosen', 'mahasiswa'],
  khs:                 ['super_admin', 'admin_akademik', 'kaprodi', 'dosen', 'mahasiswa'],
  presensi:            ['super_admin', 'admin_akademik', 'kaprodi', 'dosen', 'mahasiswa'],
  keuangan:            ['super_admin', 'admin_keuangan', 'mahasiswa'],
  ta:                  ['super_admin', 'admin_akademik', 'kaprodi', 'dosen', 'mahasiswa'],
  ujian:               ['super_admin', 'admin_akademik', 'kaprodi', 'dosen', 'mahasiswa'],
  magang:              ['super_admin', 'admin_akademik', 'kaprodi', 'dosen', 'mahasiswa'],
  beasiswa:            ['super_admin', 'admin_akademik', 'mahasiswa', 'staf'],
  ukm:                 ['super_admin', 'admin_akademik', 'mahasiswa', 'staf'],
  elearning:           ['super_admin', 'admin_akademik', 'kaprodi', 'dosen', 'mahasiswa'],
  penelitian:          ['super_admin', 'kaprodi', 'dosen', 'lppm'],
  pkm:                 ['super_admin', 'kaprodi', 'dosen', 'lppm'],
  surat:               ['super_admin', 'admin_akademik', 'kaprodi', 'dosen', 'mahasiswa', 'staf'],
  pmb:                 ['super_admin', 'admin_akademik', 'staf'],
  'semester-pendek':   ['super_admin', 'admin_akademik', 'kaprodi', 'dosen', 'mahasiswa'],
  kepegawaian:         ['super_admin', 'staf'],
  aset:                ['super_admin', 'staf'],
  akreditasi:          ['super_admin', 'admin_akademik', 'kaprodi', 'dosen'],
  alumni:              ['super_admin', 'admin_akademik', 'kaprodi'],
  laporan:             ['super_admin', 'admin_akademik', 'admin_keuangan', 'kaprodi', 'dosen', 'lppm'],
  notifikasi:          null,
  klinik:              ['super_admin', 'mahasiswa', 'staf'],
  perpustakaan:        ['super_admin', 'admin_akademik', 'dosen', 'mahasiswa', 'staf'],
  obe:                 ['super_admin', 'admin_akademik', 'kaprodi', 'dosen'],
  master:              ['super_admin', 'admin_akademik', 'kaprodi'],
  pengaturan:          null,
}

const App = (() => {

  const updateSidebarUser = () => {
    const user = Auth.getUser()
    if (!user) return
    const name = user.nama || user.email?.split('@')[0] || 'User'
    document.getElementById('sidebar-avatar').textContent = name.charAt(0).toUpperCase()
    document.getElementById('sidebar-name').textContent = name
    document.getElementById('sidebar-role').textContent = formatRole(user.role)
  }

  const formatRole = (role) => {
    const map = {
      super_admin: 'Super Admin', admin_akademik: 'Admin Akademik',
      admin_keuangan: 'Admin Keuangan', kaprodi: 'Kaprodi',
      dosen: 'Dosen', mahasiswa: 'Mahasiswa', staf: 'Staf/Tendik', lppm: 'LPPM',
    }
    return map[role] || role
  }

  const updateDatetime = () => {
    const now = new Date()
    const el = document.getElementById('topbar-datetime')
    if (el) el.textContent = now.toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
  }

  // Hide sidebar links/sections based on current user role
  const filterSidebar = () => {
    const user = Auth.getUser()
    if (!user) return
    const role = user.role

    document.querySelectorAll('#sidebar nav [data-roles]').forEach(el => {
      const allowed = el.dataset.roles.split(' ')
      el.style.display = allowed.includes(role) ? '' : 'none'
    })

    // Hide section headers when all their links are hidden
    document.querySelectorAll('#sidebar nav .sidebar-section-header').forEach(header => {
      let el = header.nextElementSibling
      let hasVisible = false
      while (el && !el.classList.contains('sidebar-section-header')) {
        if (el.tagName === 'A' && el.style.display !== 'none') {
          hasVisible = true
          break
        }
        el = el.nextElementSibling
      }
      header.style.display = hasVisible ? '' : 'none'
    })
  }

  const showApp = () => {
    document.getElementById('login-page').classList.add('hidden')
    const appEl = document.getElementById('app')
    appEl.classList.remove('hidden')
    updateSidebarUser()
    filterSidebar()
    updateDatetime()
    setInterval(updateDatetime, 60000)
    Router.resolve()
  }

  const showLogin = () => {
    document.getElementById('login-page').classList.remove('hidden')
    document.getElementById('app').classList.add('hidden')
  }

  const logout = () => {
    Auth.logout()
    showLogin()
    window.location.hash = ''
  }

  const toggleSidebar = () => {
    const sidebar = document.getElementById('sidebar')
    const overlay = document.getElementById('sidebar-overlay')
    sidebar.classList.toggle('-translate-x-full')
    overlay.classList.toggle('hidden')
  }

  // Register route with role guard
  const registerRoute = (page, handler) => {
    Router.register(page, async () => {
      const allowed = ROUTE_ROLES[page]
      if (allowed !== null && allowed !== undefined) {
        const user = Auth.getUser()
        if (!user || !allowed.includes(user.role)) {
          Router.setPageMeta('Akses Ditolak', 'Anda tidak memiliki izin untuk halaman ini')
          document.getElementById('page-content').innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 gap-4 text-center">
              <div class="text-5xl text-slate-300">🔒</div>
              <p class="text-slate-500 text-sm">Halaman ini tidak tersedia untuk role <strong>${user?.role || '—'}</strong>.</p>
              <a href="#/dashboard" class="text-primary-600 text-sm hover:underline">← Kembali ke Dashboard</a>
            </div>`
          return
        }
      }
      await handler()
    })
  }

  const init = () => {
    // Register all routes with RBAC guard
    registerRoute('dashboard',        () => DashboardModule.render())
    registerRoute('mahasiswa',        () => MahasiswaModule.render())
    registerRoute('dosen',            () => DosenModule.render())
    registerRoute('krs',              () => KRSModule.render())
    registerRoute('nilai',            () => NilaiModule.render())
    registerRoute('khs',              () => KHSModule.render())
    registerRoute('presensi',         () => PresensiModule.render())
    registerRoute('keuangan',         () => KeuanganModule.render())
    registerRoute('ujian',            () => UjianModule.render())
    registerRoute('ta',               () => TAModule.render())
    registerRoute('pengaturan',       () => PengaturanModule.render())
    registerRoute('master',           () => MasterModule.render())
    registerRoute('kelas',            () => KelasModule.render())
    registerRoute('magang',           () => MagangModule.render())
    registerRoute('beasiswa',         () => BeasiswaModule.render())
    registerRoute('ukm',              () => UKMModule.render())
    registerRoute('semester-pendek',  () => SPModule.render())
    registerRoute('pmb',              () => PMBModule.render())
    registerRoute('surat',            () => SuratModule.render())
    registerRoute('elearning',        () => ElearningModule.render())
    registerRoute('penelitian',       () => PenelitianModule.render())
    registerRoute('pkm',              () => PKMModule.render())
    registerRoute('aset',             () => AsetModule.render())
    registerRoute('kepegawaian',      () => KepegawaianModule.render())
    registerRoute('akreditasi',       () => AkreditasiModule.render())
    registerRoute('alumni',           () => AlumniModule.render())
    registerRoute('laporan',          () => LaporanModule.render())
    registerRoute('notifikasi',       () => NotifikasiModule.render())
    registerRoute('klinik',           () => KlinikModule.render())
    registerRoute('perpustakaan',     () => PerpustakaanModule.render())
    registerRoute('obe',              () => OBEModule.render())

    // Sidebar overlay click (mobile)
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.add('-translate-x-full')
      document.getElementById('sidebar-overlay').classList.add('hidden')
    })

    // Close sidebar when navigating on mobile
    window.addEventListener('hashchange', () => {
      if (window.innerWidth < 1024) {
        document.getElementById('sidebar')?.classList.add('-translate-x-full')
        document.getElementById('sidebar-overlay')?.classList.add('hidden')
      }
    })

    if (Auth.isLoggedIn()) {
      showApp()
      if (!window.location.hash || window.location.hash === '#') {
        window.location.hash = '#/dashboard'
      }
    } else {
      showLogin()
    }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = document.getElementById('login-email').value
      const password = document.getElementById('login-password').value
      const btn = document.getElementById('login-btn')
      const errEl = document.getElementById('login-error')

      btn.disabled = true
      btn.textContent = 'Memproses...'
      errEl.classList.add('hidden')

      try {
        await Auth.login(email, password)
        showApp()
        window.location.hash = '#/dashboard'
      } catch (err) {
        errEl.textContent = err.message || 'Login gagal'
        errEl.classList.remove('hidden')
        btn.disabled = false
        btn.textContent = 'Masuk'
      }
    })
  }

  return { init, logout, showApp, showLogin, toggleSidebar }
})()

document.addEventListener('DOMContentLoaded', () => App.init())
