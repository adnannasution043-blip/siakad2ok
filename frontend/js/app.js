// ============================================================
// APP.JS — Entry point
// DEV_MODE = true → skip login, langsung dashboard
// ============================================================
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
      dosen: 'Dosen', mahasiswa: 'Mahasiswa', staf: 'Staf', lppm: 'LPPM',
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

  const showApp = () => {
    document.getElementById('login-page').classList.add('hidden')
    const appEl = document.getElementById('app')
    appEl.classList.remove('hidden')
    updateSidebarUser()
    updateDatetime()
    setInterval(updateDatetime, 60000)
    Router.resolve()
  }

  const showLogin = () => {
    document.getElementById('login-page').classList.remove('hidden')
    document.getElementById('app').classList.add('hidden')
  }

  const logout = () => {
    if (DEV_MODE) {
      UI.toast('Dev mode aktif — logout dinonaktifkan', 'info')
      return
    }
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

  const init = () => {
    // Register routes
    Router.register('dashboard',  () => DashboardModule.render())
    Router.register('mahasiswa',  () => MahasiswaModule.render())
    Router.register('dosen',      () => DosenModule.render())
    Router.register('krs',        () => KRSModule.render())
    Router.register('nilai',      () => NilaiModule.render())
    Router.register('khs',        () => KHSModule.render())
    Router.register('presensi',   () => PresensiModule.render())
    Router.register('keuangan',   () => KeuanganModule.render())
    Router.register('ujian',      () => UjianModule.render())
    Router.register('ta',         () => TAModule.render())
    Router.register('pengaturan', () => PengaturanModule.render())
    Router.register('master',     () => MasterModule.render())
    Router.register('kelas',      () => KelasModule.render())
    Router.register('magang',    () => MagangModule.render())
    Router.register('beasiswa',  () => BeasiswaModule.render())
    Router.register('ukm',       () => UKMModule.render())
    Router.register('semester-pendek', () => SPModule.render())
    Router.register('pmb',            () => PMBModule.render())
    Router.register('surat',          () => SuratModule.render())
    Router.register('elearning',      () => ElearningModule.render())
    Router.register('penelitian',     () => PenelitianModule.render())
    Router.register('pkm',            () => PKMModule.render())
    Router.register('aset',           () => AsetModule.render())
    Router.register('kepegawaian',    () => KepegawaianModule.render())
    Router.register('akreditasi',     () => AkreditasiModule.render())
    Router.register('alumni',         () => AlumniModule.render())
    Router.register('laporan',        () => LaporanModule.render())
    Router.register('notifikasi',     () => NotifikasiModule.render())
    Router.register('klinik',         () => KlinikModule.render())
    Router.register('perpustakaan',   () => PerpustakaanModule.render())

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

    if (DEV_MODE) {
      showApp()
      if (!window.location.hash || window.location.hash === '#') {
        window.location.hash = '#/dashboard'
      }
    } else {
      if (Auth.isLoggedIn()) {
        showApp()
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
  }

  return { init, logout, showApp, showLogin, toggleSidebar }
})()

document.addEventListener('DOMContentLoaded', () => App.init())
