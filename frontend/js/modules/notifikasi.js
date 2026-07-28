// Notifikasi Module
const NotifikasiModule = (() => {
  const API = '/api/v1/notifikasi'
  let activeTab = 'notifikasi'

  // ── Helpers ────────────────────────────────────────────────────────────────

  const jenisBadge = (j) => {
    const map = {
      krs: { cls: 'bg-blue-100 text-blue-800', label: 'KRS' },
      nilai: { cls: 'bg-green-100 text-green-800', label: 'Nilai' },
      keuangan: { cls: 'bg-yellow-100 text-yellow-800', label: 'Keuangan' },
      pengumuman: { cls: 'bg-purple-100 text-purple-800', label: 'Pengumuman' },
      presensi: { cls: 'bg-orange-100 text-orange-800', label: 'Presensi' },
      ta: { cls: 'bg-teal-100 text-teal-800', label: 'Tugas Akhir' },
      surat: { cls: 'bg-indigo-100 text-indigo-800', label: 'Surat' },
      ujian: { cls: 'bg-red-100 text-red-800', label: 'Ujian' },
      elearning: { cls: 'bg-cyan-100 text-cyan-800', label: 'E-Learning' },
    }
    const d = map[j] || { cls: 'bg-slate-100 text-slate-700', label: j || 'Sistem' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${d.cls}">${d.label}</span>`
  }

  const jenisIcon = (j) => {
    const icons = {
      krs: '📋', nilai: '📊', keuangan: '💰', pengumuman: '📢',
      presensi: '📍', ta: '🎓', surat: '📄', ujian: '✏️', elearning: '💻',
    }
    return icons[j] || '🔔'
  }

  const kategoriPengumBadge = (k) => {
    const map = {
      ujian: 'bg-red-100 text-red-800',
      akademik: 'bg-blue-100 text-blue-800',
      beasiswa: 'bg-green-100 text-green-800',
      umum: 'bg-slate-100 text-slate-700',
      kegiatan: 'bg-purple-100 text-purple-800',
    }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[k] || 'bg-slate-100 text-slate-700'}">${k}</span>`
  }

  const fmtDate = (d) => {
    if (!d) return ''
    const dt = new Date(d)
    const now = new Date()
    const diff = Math.floor((now - dt) / 1000)
    if (diff < 60) return 'Baru saja'
    if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu'
    if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu'
    if (diff < 604800) return Math.floor(diff / 86400) + ' hari lalu'
    return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const loadStats = async () => {
    try {
      const r = await fetch(`${API}/stats`)
      const j = await r.json()
      const d = j.data || {}
      document.getElementById('notif-stat-total').textContent = d.total ?? 0
      document.getElementById('notif-stat-belum').textContent = d.belum_dibaca ?? 0
      document.getElementById('notif-stat-dibaca').textContent = d.sudah_dibaca ?? 0
      document.getElementById('notif-stat-pengum').textContent = d.pengumuman ?? 0
    } catch (e) { console.error(e) }
  }

  // ── Notifikasi Tab ─────────────────────────────────────────────────────────

  const loadNotifikasi = async (params = {}) => {
    const container = document.getElementById('notif-list')
    if (!container) return
    container.innerHTML = '<div class="p-8 text-center text-slate-400">Memuat...</div>'
    try {
      const qs = new URLSearchParams({ per_page: 50, ...params }).toString()
      const r = await fetch(`${API}?${qs}`)
      const j = await r.json()
      const items = j.data || []
      if (!items.length) {
        container.innerHTML = '<div class="p-10 text-center text-slate-400">Tidak ada notifikasi</div>'
        return
      }
      container.innerHTML = items.map(n => `
        <div class="flex gap-3 p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${n.dibaca ? 'opacity-60' : ''}">
          <div class="text-2xl flex-shrink-0 mt-0.5">${jenisIcon(n.jenis)}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div>
                <span class="font-medium text-sm text-slate-800 dark:text-slate-100 ${!n.dibaca ? 'font-semibold' : ''}">${n.judul}</span>
                ${!n.dibaca ? '<span class="ml-1.5 inline-block w-2 h-2 bg-blue-500 rounded-full align-middle"></span>' : ''}
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                ${jenisBadge(n.jenis)}
              </div>
            </div>
            <p class="text-xs text-slate-500 mt-1 line-clamp-2">${n.isi}</p>
            <div class="flex items-center justify-between mt-2">
              <span class="text-xs text-slate-400">${fmtDate(n.created_at)}</span>
              <div class="flex gap-1">
                ${!n.dibaca ? `<button onclick="NotifikasiModule.tandaiBaca('${n.id}')" class="text-xs text-blue-600 hover:underline">Tandai Dibaca</button>` : ''}
                <button onclick="NotifikasiModule.hapusNotif('${n.id}')" class="text-xs text-red-500 hover:underline ml-2">Hapus</button>
              </div>
            </div>
          </div>
        </div>`).join('')
    } catch (e) {
      container.innerHTML = '<div class="p-8 text-center text-red-400">Gagal memuat notifikasi</div>'
    }
  }

  const tandaiBaca = async (id) => {
    await fetch(`${API}/${id}/baca`, { method: 'POST' })
    loadNotifikasi(getFilterParams())
    loadStats()
  }

  const tandaiSemuaBaca = async () => {
    const r = await fetch(`${API}/baca-semua`, { method: 'POST' })
    const j = await r.json()
    UI.toast(j.message || 'Semua dibaca', 'success')
    loadNotifikasi()
    loadStats()
  }

  const hapusNotif = async (id) => {
    await fetch(`${API}/${id}`, { method: 'DELETE' })
    loadNotifikasi(getFilterParams())
    loadStats()
  }

  const getFilterParams = () => {
    const jenis = document.getElementById('notif-filter-jenis')?.value
    const dibaca = document.getElementById('notif-filter-status')?.value
    const params = {}
    if (jenis) params.jenis = jenis
    if (dibaca === 'belum') params.dibaca = false
    if (dibaca === 'sudah') params.dibaca = true
    return params
  }

  const doFilter = () => loadNotifikasi(getFilterParams())

  // ── Pengumuman Tab ─────────────────────────────────────────────────────────

  let currentPengumId = null

  const loadPengumuman = async (params = {}) => {
    const tbody = document.getElementById('pengum-tbody')
    if (!tbody) return
    try {
      const qs = new URLSearchParams({ per_page: 50, ...params }).toString()
      const r = await fetch(`${API}/pengumuman/list?${qs}`)
      const j = await r.json()
      const items = j.data || []
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-400">Belum ada pengumuman</td></tr>'
        return
      }
      tbody.innerHTML = items.map(p => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30">
          <td class="px-4 py-3">
            <div class="font-medium text-sm ${p.penting ? 'text-slate-800 dark:text-slate-100' : ''}">${p.judul}</div>
            <div class="text-xs text-slate-400 mt-0.5 line-clamp-1">${p.isi}</div>
          </td>
          <td class="px-4 py-3">${kategoriPengumBadge(p.kategori)}</td>
          <td class="px-4 py-3 text-sm">${p.target || '-'}</td>
          <td class="px-4 py-3">
            ${p.penting ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Penting</span>' : '<span class="text-slate-400 text-xs">-</span>'}
          </td>
          <td class="px-4 py-3 text-xs text-slate-500">${fmtDate(p.published_at)}</td>
          <td class="px-4 py-3">
            <div class="flex gap-1">
              <button onclick="NotifikasiModule.openEditPengum('${p.id}')" class="px-2 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded">Edit</button>
              <button onclick="NotifikasiModule.hapusPengum('${p.id}','${p.judul.replace(/'/g,"\\'")}','${p.isi.replace(/'/g,"\\'").substring(0,30)}')" class="px-2 py-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded">Hapus</button>
            </div>
          </td>
        </tr>`).join('')
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-red-400">Gagal memuat data</td></tr>'
    }
  }

  const openAddPengum = () => {
    currentPengumId = null
    document.getElementById('pengum-form-title').textContent = 'Buat Pengumuman'
    document.getElementById('pengum-form').reset()
    document.getElementById('pengum-form-modal')?.classList.remove('hidden')
  }

  const openEditPengum = async (id) => {
    const r = await fetch(`${API}/pengumuman/list?per_page=50`)
    const j = await r.json()
    const p = (j.data || []).find(x => x.id === id)
    if (!p) return
    currentPengumId = id
    document.getElementById('pengum-form-title').textContent = 'Edit Pengumuman'
    const fields = ['judul', 'isi', 'kategori', 'target']
    fields.forEach(f => { const el = document.getElementById(`pf-${f}`); if (el) el.value = p[f] || '' })
    const pentingEl = document.getElementById('pf-penting')
    if (pentingEl) pentingEl.checked = !!p.penting
    document.getElementById('pengum-form-modal')?.classList.remove('hidden')
  }

  const submitPengumForm = async (e) => {
    e.preventDefault()
    const body = {
      judul: document.getElementById('pf-judul')?.value,
      isi: document.getElementById('pf-isi')?.value,
      kategori: document.getElementById('pf-kategori')?.value,
      target: document.getElementById('pf-target')?.value,
      penting: document.getElementById('pf-penting')?.checked,
    }
    try {
      const url = currentPengumId ? `${API}/pengumuman/${currentPengumId}` : `${API}/pengumuman`
      const method = currentPengumId ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (!j.success) { UI.toast(j.message || 'Gagal', 'error'); return }
      UI.toast(j.message || 'Berhasil', 'success')
      document.getElementById('pengum-form-modal')?.classList.add('hidden')
      loadPengumuman()
      loadStats()
    } catch (err) {
      UI.toast('Error: ' + err.message, 'error')
    }
  }

  const hapusPengum = async (id, judul) => {
    if (!confirm(`Hapus pengumuman "${judul}"?`)) return
    const r = await fetch(`${API}/pengumuman/${id}`, { method: 'DELETE' })
    const j = await r.json()
    UI.toast(j.message || 'Dihapus', j.success ? 'success' : 'error')
    if (j.success) { loadPengumuman(); loadStats() }
  }

  // ── Tab switching ───────────────────────────────────────────────────────────

  const switchTab = (tab) => {
    activeTab = tab
    const tabs = ['notifikasi', 'pengumuman']
    tabs.forEach(t => {
      const btn = document.getElementById(`notif-tab-${t}`)
      const pane = document.getElementById(`notif-pane-${t}`)
      const addBtn = document.getElementById('notif-btn-add-pengum')
      if (btn && pane) {
        if (t === tab) {
          btn.classList.add('border-b-2', 'border-blue-600', 'text-blue-600')
          btn.classList.remove('text-slate-500')
          pane.classList.remove('hidden')
        } else {
          btn.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600')
          btn.classList.add('text-slate-500')
          pane.classList.add('hidden')
        }
      }
      if (addBtn) addBtn.classList.toggle('hidden', tab !== 'pengumuman')
    })
    if (tab === 'notifikasi') loadNotifikasi()
    if (tab === 'pengumuman') loadPengumuman()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const render = () => {
    const el = document.getElementById('page-content')
    if (!el) return
    el.innerHTML = `
    <div class="p-6 space-y-6">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">Notifikasi & Pengumuman</h1>
          <p class="text-sm text-slate-500 mt-0.5">Pusat informasi dan pemberitahuan sistem</p>
        </div>
        <button id="notif-btn-add-pengum" onclick="NotifikasiModule.openAddPengum()" class="hidden px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">+ Buat Pengumuman</button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        ${[
          ['notif-stat-total', 'Total Notifikasi', '🔔', 'blue'],
          ['notif-stat-belum', 'Belum Dibaca', '🔴', 'red'],
          ['notif-stat-dibaca', 'Sudah Dibaca', '✅', 'green'],
          ['notif-stat-pengum', 'Pengumuman', '📢', 'purple'],
        ].map(([id, label, icon, c]) => `
          <div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
            <div class="text-2xl mb-1">${icon}</div>
            <div id="${id}" class="text-2xl font-bold text-slate-800 dark:text-slate-100">-</div>
            <div class="text-xs text-slate-500 mt-0.5">${label}</div>
          </div>`).join('')}
      </div>

      <!-- Tabs -->
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div class="flex border-b border-slate-200 dark:border-slate-700 px-4">
          <button id="notif-tab-notifikasi" onclick="NotifikasiModule.switchTab('notifikasi')"
            class="py-3 px-4 text-sm font-medium border-b-2 border-blue-600 text-blue-600 -mb-px">
            Notifikasi
          </button>
          <button id="notif-tab-pengumuman" onclick="NotifikasiModule.switchTab('pengumuman')"
            class="py-3 px-4 text-sm font-medium text-slate-500 hover:text-slate-700 -mb-px">
            Pengumuman
          </button>
        </div>

        <!-- Notifikasi Pane -->
        <div id="notif-pane-notifikasi">
          <div class="flex flex-wrap items-center gap-2 p-3 border-b border-slate-100 dark:border-slate-700">
            <select id="notif-filter-jenis" onchange="NotifikasiModule.doFilter()"
              class="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-1.5 text-sm">
              <option value="">Semua Jenis</option>
              <option value="krs">KRS</option>
              <option value="nilai">Nilai</option>
              <option value="keuangan">Keuangan</option>
              <option value="pengumuman">Pengumuman</option>
              <option value="presensi">Presensi</option>
              <option value="ta">Tugas Akhir</option>
              <option value="surat">Surat</option>
              <option value="ujian">Ujian</option>
              <option value="elearning">E-Learning</option>
            </select>
            <select id="notif-filter-status" onchange="NotifikasiModule.doFilter()"
              class="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-1.5 text-sm">
              <option value="">Semua Status</option>
              <option value="belum">Belum Dibaca</option>
              <option value="sudah">Sudah Dibaca</option>
            </select>
            <button onclick="NotifikasiModule.tandaiSemuaBaca()"
              class="ml-auto text-xs text-blue-600 hover:underline">Tandai Semua Dibaca</button>
          </div>
          <div id="notif-list" class="divide-y divide-slate-100 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
            <div class="p-8 text-center text-slate-400">Memuat notifikasi...</div>
          </div>
        </div>

        <!-- Pengumuman Pane -->
        <div id="notif-pane-pengumuman" class="hidden p-4">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Judul & Isi</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Kategori</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Target</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Prioritas</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Dipublikasikan</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Aksi</th>
                </tr>
              </thead>
              <tbody id="pengum-tbody" class="divide-y divide-slate-100 dark:divide-slate-700">
                <tr><td colspan="6" class="text-center py-10 text-slate-400">Memuat...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Pengumuman Form Modal -->
    <div id="pengum-form-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h3 id="pengum-form-title" class="text-lg font-semibold">Buat Pengumuman</h3>
          <button onclick="document.getElementById('pengum-form-modal').classList.add('hidden')"
            class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form id="pengum-form" onsubmit="NotifikasiModule.submitPengumForm(event)" class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Judul *</label>
            <input id="pf-judul" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Isi Pengumuman *</label>
            <textarea id="pf-isi" required rows="4" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kategori *</label>
              <select id="pf-kategori" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
                <option value="umum">Umum</option>
                <option value="akademik">Akademik</option>
                <option value="ujian">Ujian</option>
                <option value="beasiswa">Beasiswa</option>
                <option value="kegiatan">Kegiatan</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target</label>
              <select id="pf-target" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
                <option value="semua">Semua</option>
                <option value="mahasiswa">Mahasiswa</option>
                <option value="dosen">Dosen</option>
                <option value="pegawai">Pegawai</option>
              </select>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <input id="pf-penting" type="checkbox" class="w-4 h-4 rounded">
            <label for="pf-penting" class="text-sm text-slate-700 dark:text-slate-300">Tandai sebagai penting</label>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="document.getElementById('pengum-form-modal').classList.add('hidden')"
              class="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">Batal</button>
            <button type="submit" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Publikasikan</button>
          </div>
        </form>
      </div>
    </div>
    `

    loadStats()
    loadNotifikasi()
  }

  return {
    render, switchTab, doFilter,
    tandaiBaca, tandaiSemuaBaca, hapusNotif,
    openAddPengum, openEditPengum, submitPengumForm, hapusPengum,
  }
})()
