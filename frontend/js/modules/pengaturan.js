// ============================================================
// PENGATURAN.JS — Profil, sistem, manajemen pengguna
// ============================================================
const PengaturanModule = (() => {

  let state = {
    tab: 'profil',
    users: [], meta: null,
    page: 1, search: '', role: '', is_active: '',
  }

  const ROLES = [
    { value: '', label: 'Semua Role' },
    { value: 'super_admin',        label: 'Super Admin' },
    { value: 'admin_akademik',     label: 'Admin Akademik' },
    { value: 'admin_keuangan',     label: 'Admin Keuangan' },
    { value: 'admin_sdm',          label: 'Admin SDM' },
    { value: 'admin_aset',         label: 'Admin Aset' },
    { value: 'admin_perpustakaan', label: 'Admin Perpustakaan' },
    { value: 'admin_pmb',          label: 'Admin PMB' },
    { value: 'lppm',               label: 'LPPM' },
    { value: 'kaprodi',            label: 'Kaprodi' },
    { value: 'dosen',              label: 'Dosen' },
    { value: 'staf',               label: 'Staf' },
    { value: 'mahasiswa',          label: 'Mahasiswa' },
    { value: 'orang_tua',          label: 'Orang Tua' },
    { value: 'alumni',             label: 'Alumni' },
  ]

  const formatRole = (role) => {
    const r = ROLES.find(x => x.value === role)
    return r ? r.label : (role || '—')
  }

  const infoRow = (label, value) => `
    <div class="flex items-start justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
      <span class="text-sm text-slate-500 shrink-0">${label}</span>
      <span class="text-sm text-slate-800 text-right">${value}</span>
    </div>`

  // ── RENDER MAIN ────────────────────────────────────────────
  const render = () => {
    Router.setPageMeta('Pengaturan', 'Profil akun dan manajemen pengguna')
    const user = Auth.getUser()
    const isAdmin = user?.role === 'super_admin' || user?.role === 'admin_akademik'

    document.getElementById('page-content').innerHTML = `
      <!-- Tab nav -->
      <div class="flex gap-1 border-b border-slate-200 mb-6">
        ${tabBtn('profil', 'Profil & Sistem')}
        ${isAdmin ? tabBtn('users', 'Manajemen Pengguna') : ''}
      </div>
      <div id="pgtr-tab-content"></div>
    `
    switchTab(state.tab)
  }

  const tabBtn = (id, label) => `
    <button onclick="PengaturanModule.switchTab('${id}')"
      id="pgtr-tab-${id}"
      class="px-4 py-2 text-sm font-medium border-b-2 transition-colors
        ${state.tab === id
          ? 'border-primary-600 text-primary-700'
          : 'border-transparent text-slate-500 hover:text-slate-700'}">
      ${label}
    </button>`

  const switchTab = (tab) => {
    state.tab = tab
    document.querySelectorAll('[id^="pgtr-tab-"]').forEach(btn => {
      const active = btn.id === `pgtr-tab-${tab}`
      btn.className = btn.className
        .replace(/border-primary-600 text-primary-700|border-transparent text-slate-500 hover:text-slate-700/g, '')
        .trim() + (active
          ? ' border-primary-600 text-primary-700'
          : ' border-transparent text-slate-500 hover:text-slate-700')
    })
    if (tab === 'profil') renderProfilTab()
    if (tab === 'users') renderUsersTab()
  }

  // ── PROFIL TAB ─────────────────────────────────────────────
  const renderProfilTab = () => {
    const user = Auth.getUser()
    document.getElementById('pgtr-tab-content').innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-4">
          ${UI.card(`
            <div class="px-5 py-4 border-b border-slate-200">
              <h3 class="font-semibold text-slate-700 text-sm">Profil Akun</h3>
            </div>
            <div class="p-5">
              <div class="flex items-center gap-4 mb-5">
                <div class="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl">
                  ${(user?.nama || 'A').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p class="font-semibold text-slate-800">${user?.nama || '—'}</p>
                  <p class="text-sm text-slate-500">${user?.email || '—'}</p>
                  <span class="badge bg-primary-100 text-primary-700 mt-1">${formatRole(user?.role)}</span>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="p-3 bg-slate-50 rounded-lg">
                  <p class="text-xs text-slate-500 mb-1">ID Pengguna</p>
                  <p class="text-sm font-mono text-slate-700">${user?.id || '—'}</p>
                </div>
                <div class="p-3 bg-slate-50 rounded-lg">
                  <p class="text-xs text-slate-500 mb-1">Role</p>
                  <p class="text-sm font-medium text-slate-700">${formatRole(user?.role)}</p>
                </div>
              </div>
            </div>
          `)}

          ${UI.card(`
            <div class="px-5 py-4 border-b border-slate-200">
              <h3 class="font-semibold text-slate-700 text-sm">Informasi Sistem</h3>
            </div>
            <div class="p-5 space-y-3">
              ${infoRow('Nama Sistem', 'SIAKAD — Sistem Informasi Akademik')}
              ${infoRow('Versi', '1.0.0-dev')}
              ${infoRow('Mode', DEV_MODE ? '<span class="badge bg-yellow-100 text-yellow-700">Development</span>' : '<span class="badge bg-green-100 text-green-700">Production</span>')}
              ${infoRow('Backend', 'FastAPI (Python) + JSON Storage')}
              ${infoRow('Frontend', 'Vanilla JS + Tailwind CSS')}
              ${infoRow('Tahun Akademik Aktif', '2024/2025')}
            </div>
          `)}
        </div>

        <div class="space-y-4">
          ${UI.card(`
            <div class="px-5 py-4 border-b border-slate-200">
              <h3 class="font-semibold text-slate-700 text-sm">Modul Aktif</h3>
            </div>
            <div class="p-4 space-y-2">
              ${[
                'Dashboard','Mahasiswa','Dosen','KRS','Penilaian',
                'Presensi','Keuangan','Perpustakaan','OBE','Pengaturan',
              ].map(name => `
                <div class="flex items-center justify-between py-1">
                  <span class="text-sm text-slate-700">${name}</span>
                  <span class="badge bg-green-100 text-green-600">Aktif</span>
                </div>`).join('')}
            </div>
          `)}

          ${DEV_MODE ? UI.card(`
            <div class="px-5 py-4 border-b border-slate-200">
              <h3 class="font-semibold text-yellow-700 text-sm">⚠ Dev Mode Aktif</h3>
            </div>
            <div class="p-4 space-y-2 text-xs text-slate-600">
              <p>Autentikasi dinonaktifkan — semua request otomatis sebagai <strong>super_admin</strong>.</p>
              <p class="mt-2">Untuk mengaktifkan login:</p>
              <ol class="list-decimal list-inside space-y-1 text-slate-500 mt-1">
                <li>Set <code class="bg-slate-100 px-1 rounded">DEV_MODE = false</code> di <code class="bg-slate-100 px-1 rounded">auth.js</code></li>
                <li>Set <code class="bg-slate-100 px-1 rounded">DEV_MODE = False</code> di <code class="bg-slate-100 px-1 rounded">dev.py</code></li>
              </ol>
            </div>
          `) : ''}

          <!-- Zona Bahaya -->
          <div class="border border-red-200 rounded-xl overflow-hidden">
            <div class="px-5 py-4 border-b border-red-200 bg-red-50 flex items-center gap-2">
              <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
              </svg>
              <h3 class="font-semibold text-red-700 text-sm">Zona Bahaya</h3>
            </div>
            <div class="p-5 space-y-4 bg-white">
              <div class="flex items-start justify-between gap-4 p-4 border border-slate-200 rounded-lg">
                <div>
                  <p class="text-sm font-medium text-slate-800">Bersihkan Data Transaksi</p>
                  <p class="text-xs text-slate-500 mt-1">Hapus semua mahasiswa, dosen, KRS, nilai, presensi, dan data operasional lainnya. Master data (program studi, mata kuliah, ruang, users) tetap aman.</p>
                  <p class="text-xs text-red-500 mt-1 font-medium">Gunakan ini sebelum go-live dengan data nyata.</p>
                </div>
                <button onclick="PengaturanModule.openReset('clean')"
                  class="shrink-0 px-4 py-2 border-2 border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 whitespace-nowrap">
                  Bersihkan Data
                </button>
              </div>
              <div class="flex items-start justify-between gap-4 p-4 border border-slate-200 rounded-lg">
                <div>
                  <p class="text-sm font-medium text-slate-800">Reset ke Data Demo</p>
                  <p class="text-xs text-slate-500 mt-1">Hapus SEMUA data kemudian pulihkan kembali ke data contoh bawaan sistem. Berguna untuk mendemonstrasikan ulang sistem dari awal.</p>
                  <p class="text-xs text-red-500 mt-1 font-medium">Semua data yang pernah diinput akan hilang permanen.</p>
                </div>
                <button onclick="PengaturanModule.openReset('demo')"
                  class="shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium whitespace-nowrap">
                  Reset Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>`
  }

  // ── USERS TAB ──────────────────────────────────────────────
  const renderUsersTab = () => {
    document.getElementById('pgtr-tab-content').innerHTML = `
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div class="flex-1 min-w-48">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input id="usr-search" type="text" placeholder="Cari nama atau email..."
              value="${state.search}"
              class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              oninput="PengaturanModule.onSearch(this.value)" />
          </div>
        </div>
        <select onchange="PengaturanModule.onFilter('role', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          ${ROLES.map(r => `<option value="${r.value}" ${state.role===r.value?'selected':''}>${r.label}</option>`).join('')}
        </select>
        <select onchange="PengaturanModule.onFilter('is_active', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Status</option>
          <option value="true"  ${state.is_active==='true' ?'selected':''}>Aktif</option>
          <option value="false" ${state.is_active==='false'?'selected':''}>Nonaktif</option>
        </select>
        <button onclick="PengaturanModule.openCreateUser()"
          class="btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Buat Akun
        </button>
      </div>
      ${UI.card(`
        <div id="usr-table-wrap"></div>
        <div id="usr-pagination"></div>
      `)}
    `
    fetchUsers()
  }

  const fetchUsers = async () => {
    try {
      const res = await API.get('/users', {
        page: state.page, per_page: 20,
        search: state.search,
        role: state.role,
        is_active: state.is_active,
      })
      state.users = res.data || []
      state.meta  = res.meta
      renderUsersTable()
      renderUsersPagination()
    } catch(e) {
      UI.toast(e.message || 'Gagal memuat pengguna', 'error')
    }
  }

  const renderUsersTable = () => {
    const el = document.getElementById('usr-table-wrap')
    if (!el) return
    el.innerHTML = UI.renderTable({
      headers: ['Pengguna', 'Role', 'Status', 'Aksi'],
      emptyText: 'Tidak ada pengguna ditemukan',
      rows: state.users.map(u => {
        const active = u.is_active !== false
        return `
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
                ${(u.nama || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <div class="text-sm font-medium text-slate-800">${u.nama || '—'}</div>
                <div class="text-xs text-slate-400">${u.email || '—'}</div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3">
            <span class="badge bg-primary-50 text-primary-700">${formatRole(u.role)}</span>
          </td>
          <td class="px-4 py-3">
            ${active
              ? `<span class="badge bg-green-100 text-green-700">Aktif</span>`
              : `<span class="badge bg-red-100 text-red-600">Nonaktif</span>`}
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-1">
              <button onclick="PengaturanModule.openEditUser('${u.id}')"
                title="Ubah role / status"
                class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button onclick="PengaturanModule.toggleActive('${u.id}', ${active})"
                title="${active ? 'Nonaktifkan' : 'Aktifkan'} akun"
                class="p-1.5 ${active ? 'text-amber-500 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'} rounded-lg">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  ${active
                    ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>`
                    : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>`}
                </svg>
              </button>
              <button onclick="PengaturanModule.openResetPassword('${u.id}', '${(u.nama||'').replace(/'/g,"\\'")}')"
                title="Reset password"
                class="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                </svg>
              </button>
            </div>
          </td>`
      })
    })
  }

  const renderUsersPagination = () => {
    const el = document.getElementById('usr-pagination')
    if (el) el.innerHTML = UI.renderPagination(state.meta, 'PengaturanModule.goPage')
  }

  // ── CREATE USER MODAL ──────────────────────────────────────
  const openCreateUser = () => {
    UI.openModal(`
      <div class="px-6 py-4 border-b flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-800">Buat Akun Pengguna</h3>
        <button onclick="UI.closeModal()" class="text-slate-400 hover:text-slate-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="px-6 py-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap <span class="text-red-500">*</span></label>
          <input id="usr-new-nama" type="text" placeholder="Nama lengkap"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Email <span class="text-red-500">*</span></label>
          <input id="usr-new-email" type="email" placeholder="email@contoh.com"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Password <span class="text-red-500">*</span></label>
          <input id="usr-new-pw" type="password" placeholder="Minimal 6 karakter"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Role <span class="text-red-500">*</span></label>
          <select id="usr-new-role"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
            <option value="">-- Pilih Role --</option>
            ${ROLES.filter(r => r.value).map(r => `<option value="${r.value}">${r.label}</option>`).join('')}
          </select>
        </div>
        <div class="flex gap-3 pt-2">
          <button onclick="UI.closeModal()"
            class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
            Batal
          </button>
          <button onclick="PengaturanModule.submitCreateUser()"
            class="flex-1 btn-primary px-4 py-2 rounded-lg text-sm font-medium">
            Buat Akun
          </button>
        </div>
      </div>
    `)
  }

  const submitCreateUser = async () => {
    const nama  = document.getElementById('usr-new-nama').value.trim()
    const email = document.getElementById('usr-new-email').value.trim()
    const pw    = document.getElementById('usr-new-pw').value
    const role  = document.getElementById('usr-new-role').value
    if (!nama || !email || !pw || !role) { UI.toast('Semua field wajib diisi', 'error'); return }
    if (pw.length < 6) { UI.toast('Password minimal 6 karakter', 'error'); return }
    try {
      await API.post('/users', { nama, email, password: pw, role })
      UI.closeModal()
      UI.toast('Akun berhasil dibuat', 'success')
      fetchUsers()
    } catch(e) { UI.toast(e.message || 'Gagal membuat akun', 'error') }
  }

  // ── EDIT USER MODAL ─────────────────────────────────────────
  let _editUserId = null
  const openEditUser = (userId) => {
    _editUserId = userId
    const u = state.users.find(x => x.id === userId) || {}
    UI.openModal(`
      <div class="px-6 py-4 border-b flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-800">Ubah Role Pengguna</h3>
        <button onclick="UI.closeModal()" class="text-slate-400 hover:text-slate-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="px-6 py-5 space-y-4">
        <div class="p-3 bg-slate-50 rounded-lg">
          <p class="text-sm font-medium text-slate-800">${u.nama || '—'}</p>
          <p class="text-xs text-slate-500">${u.email || '—'}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Role</label>
          <select id="usr-edit-role"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
            ${ROLES.filter(r => r.value).map(r =>
              `<option value="${r.value}" ${u.role===r.value?'selected':''}>${r.label}</option>`
            ).join('')}
          </select>
        </div>
        <div class="flex gap-3 pt-2">
          <button onclick="UI.closeModal()"
            class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
            Batal
          </button>
          <button onclick="PengaturanModule.submitEditUser()"
            class="flex-1 btn-primary px-4 py-2 rounded-lg text-sm font-medium">
            Simpan
          </button>
        </div>
      </div>
    `)
  }

  const submitEditUser = async () => {
    const role = document.getElementById('usr-edit-role').value
    try {
      await API.put(`/users/${_editUserId}`, { role })
      UI.closeModal()
      UI.toast('Role berhasil diperbarui', 'success')
      fetchUsers()
    } catch(e) { UI.toast(e.message || 'Gagal memperbarui', 'error') }
  }

  // ── TOGGLE ACTIVE ───────────────────────────────────────────
  const toggleActive = async (userId, currentActive) => {
    const label = currentActive ? 'nonaktifkan' : 'aktifkan'
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} akun ini?`)) return
    try {
      await API.put(`/users/${userId}`, { is_active: !currentActive })
      UI.toast(`Akun berhasil di${label}kan`, 'success')
      fetchUsers()
    } catch(e) { UI.toast(e.message || 'Gagal mengubah status', 'error') }
  }

  // ── RESET PASSWORD MODAL ────────────────────────────────────
  let _resetUserId = null
  const openResetPassword = (userId, nama) => {
    _resetUserId = userId
    UI.openModal(`
      <div class="px-6 py-4 border-b flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-800">Reset Password</h3>
        <button onclick="UI.closeModal()" class="text-slate-400 hover:text-slate-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="px-6 py-5 space-y-4">
        <p class="text-sm text-slate-600">Reset password untuk: <strong>${nama}</strong></p>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Password Baru <span class="text-red-500">*</span></label>
          <input id="usr-reset-pw" type="password" placeholder="Minimal 6 karakter"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
        </div>
        <div class="flex gap-3 pt-2">
          <button onclick="UI.closeModal()"
            class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
            Batal
          </button>
          <button onclick="PengaturanModule.submitResetPassword()"
            class="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">
            Reset Password
          </button>
        </div>
      </div>
    `)
  }

  const submitResetPassword = async () => {
    const pw = document.getElementById('usr-reset-pw').value.trim()
    if (pw.length < 6) { UI.toast('Password minimal 6 karakter', 'error'); return }
    try {
      await API.post(`/users/${_resetUserId}/reset-password`, { new_password: pw })
      UI.closeModal()
      UI.toast('Password berhasil direset', 'success')
    } catch(e) { UI.toast(e.message || 'Gagal reset password', 'error') }
  }

  // ── RESET DATA ─────────────────────────────────────────────
  let _resetMode = null
  const openReset = (mode) => {
    _resetMode = mode
    const isDemo = mode === 'demo'
    const title  = isDemo ? 'Reset ke Data Demo' : 'Bersihkan Data Transaksi'
    const desc   = isDemo
      ? 'Seluruh data akan <strong>dihapus permanen</strong> dan diganti dengan data demo bawaan sistem.'
      : 'Semua data transaksi (mahasiswa, dosen, KRS, nilai, presensi, dll) akan <strong>dihapus permanen</strong>. Master data tetap aman.'
    const btnCls = isDemo ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
    const btnLabel = isDemo ? 'Ya, Reset Sekarang' : 'Ya, Bersihkan Data'

    UI.openModal(`
      <div class="px-6 py-4 border-b border-red-200 bg-red-50 flex items-center gap-3">
        <svg class="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
        </svg>
        <h3 class="text-lg font-semibold text-red-800">${title}</h3>
      </div>
      <div class="px-6 py-5 space-y-4">
        <p class="text-sm text-slate-600">${desc}</p>
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <strong>Tindakan ini tidak dapat dibatalkan.</strong> Pastikan sudah ada backup sebelum melanjutkan.
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            Ketik <code class="bg-slate-100 px-1 py-0.5 rounded font-mono text-red-600">HAPUS SEMUA DATA</code> untuk konfirmasi
          </label>
          <input id="pgtr-reset-confirm" type="text" placeholder="HAPUS SEMUA DATA"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 font-mono"
            oninput="document.getElementById('pgtr-reset-btn').disabled = this.value !== 'HAPUS SEMUA DATA'"/>
        </div>
        <div class="flex gap-3 pt-2">
          <button onclick="UI.closeModal()"
            class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
            Batal
          </button>
          <button id="pgtr-reset-btn" onclick="PengaturanModule.submitReset()" disabled
            class="flex-1 px-4 py-2 ${btnCls} rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
            ${btnLabel}
          </button>
        </div>
      </div>
    `)
  }

  const submitReset = async () => {
    const confirm = document.getElementById('pgtr-reset-confirm')?.value
    const btn = document.getElementById('pgtr-reset-btn')
    if (confirm !== 'HAPUS SEMUA DATA') return
    btn.disabled = true
    btn.textContent = 'Memproses...'
    try {
      const res = await API.post('/admin/reset-data', {
        mode: _resetMode,
        confirm: 'HAPUS SEMUA DATA',
      })
      UI.closeModal()
      UI.toast(res.message || 'Reset berhasil', 'success')
      setTimeout(() => window.location.reload(), 1500)
    } catch(e) {
      UI.toast(e.message || 'Gagal melakukan reset', 'error')
      btn.disabled = false
      btn.textContent = _resetMode === 'demo' ? 'Ya, Reset Sekarang' : 'Ya, Bersihkan Data'
    }
  }

  // ── SEARCH / FILTER / PAGINATION ───────────────────────────
  let searchTimer = null
  const onSearch = (val) => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => { state.search = val; state.page = 1; fetchUsers() }, 400)
  }
  const onFilter = (key, val) => { state[key] = val; state.page = 1; fetchUsers() }
  const goPage   = (p) => { state.page = p; fetchUsers() }

  return {
    render, switchTab,
    openCreateUser, submitCreateUser,
    openEditUser, submitEditUser,
    toggleActive,
    openResetPassword, submitResetPassword,
    openReset, submitReset,
    onSearch, onFilter, goPage,
  }
})()
