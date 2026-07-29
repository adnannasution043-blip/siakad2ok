// Alumni & Yudisium Module
const AlumniModule = (() => {
  const API = '/api/v1/alumni'
  let activeTab = 'alumni'
  let currentAlumniId = null
  let currentYudisiumId = null

  // ── Helpers ────────────────────────────────────────────────────────────────

  const statusYudBadge = (s) => {
    const map = {
      selesai: 'bg-green-100 text-green-800',
      belum: 'bg-slate-100 text-slate-700',
    }
    const label = { selesai: 'Selesai', belum: 'Belum Yudisium' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || 'bg-slate-100 text-slate-700'}">${label[s] || s}</span>`
  }

  const statusYudisiumBadge = (s) => {
    const map = {
      dijadwalkan: 'bg-blue-100 text-blue-800',
      selesai: 'bg-green-100 text-green-800',
      dibatalkan: 'bg-red-100 text-red-800',
    }
    const label = { dijadwalkan: 'Dijadwalkan', selesai: 'Selesai', dibatalkan: 'Dibatalkan' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || 'bg-slate-100 text-slate-700'}">${label[s] || s}</span>`
  }

  const pekerjaanBadge = (a) => {
    if (!a.instansi) return '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Belum Bekerja</span>'
    return '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">Bekerja</span>'
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
  const fmtIPK = (v) => parseFloat(v || 0).toFixed(2)

  // ── Stats ──────────────────────────────────────────────────────────────────

  const loadStats = async () => {
    try {
      const r = await fetch(`${API}/stats`)
      const j = await r.json()
      const d = j.data || {}
      document.getElementById('alm-stat-total').textContent = d.total_alumni ?? 0
      document.getElementById('alm-stat-bekerja').textContent = d.sudah_bekerja ?? 0
      document.getElementById('alm-stat-belum').textContent = d.belum_bekerja ?? 0
      document.getElementById('alm-stat-prodi').textContent = d.jumlah_prodi ?? 0
      document.getElementById('alm-stat-yud-selesai').textContent = d.yudisium_selesai ?? 0
      document.getElementById('alm-stat-yud-jadwal').textContent = d.yudisium_dijadwalkan ?? 0
    } catch (e) {
      console.error('Stats error', e)
    }
  }

  // ── Alumni Tab ─────────────────────────────────────────────────────────────

  const loadAlumni = async (params = {}) => {
    const qs = new URLSearchParams({ page: 1, per_page: 50, ...params }).toString()
    const tbody = document.getElementById('alm-tbody')
    if (!tbody) return
    try {
      const r = await fetch(`${API}?${qs}`)
      const j = await r.json()
      const items = j.data || []
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-slate-400">Belum ada data alumni</td></tr>'
        return
      }
      tbody.innerHTML = items.map(a => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30">
          <td class="px-4 py-3 font-mono text-sm">${a.nim}</td>
          <td class="px-4 py-3 font-medium">${a.nama}</td>
          <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">${a.program_studi}</td>
          <td class="px-4 py-3 text-sm">${a.angkatan}</td>
          <td class="px-4 py-3 text-sm font-medium">${fmtIPK(a.ipk)}</td>
          <td class="px-4 py-3 text-sm">${a.pekerjaan || '-'}<br><span class="text-xs text-slate-400">${a.instansi || ''}</span></td>
          <td class="px-4 py-3">${pekerjaanBadge(a)}</td>
          <td class="px-4 py-3">
            <div class="flex gap-1">
              <button onclick="AlumniModule.openDetail('${a.id}')" class="px-2 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded">Detail</button>
              <button onclick="AlumniModule.openEdit('${a.id}')" class="px-2 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded">Edit</button>
              <button onclick="AlumniModule.hapusAlumni('${a.id}','${a.nama}')" class="px-2 py-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded">Hapus</button>
            </div>
          </td>
        </tr>`).join('')
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-red-400">Gagal memuat data</td></tr>'
    }
  }

  // ── Yudisium Tab ───────────────────────────────────────────────────────────

  const loadYudisium = async () => {
    const tbody = document.getElementById('yud-tbody')
    if (!tbody) return
    try {
      const r = await fetch(`${API}/yudisium/list?per_page=50`)
      const j = await r.json()
      const items = j.data || []
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-10 text-slate-400">Belum ada data yudisium</td></tr>'
        return
      }
      tbody.innerHTML = items.map(y => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30">
          <td class="px-4 py-3 font-medium">${y.nama}</td>
          <td class="px-4 py-3 text-sm">${y.periode}</td>
          <td class="px-4 py-3 text-sm">${fmtDate(y.tanggal)}</td>
          <td class="px-4 py-3 text-sm">${y.tempat}</td>
          <td class="px-4 py-3 text-center font-medium">${y.jumlah_peserta}</td>
          <td class="px-4 py-3">${statusYudisiumBadge(y.status)}</td>
          <td class="px-4 py-3">
            <div class="flex gap-1">
              <button onclick="AlumniModule.openEditYudisium('${y.id}')" class="px-2 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded">Edit</button>
              <button onclick="AlumniModule.hapusYudisium('${y.id}','${y.nama}')" class="px-2 py-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded">Hapus</button>
            </div>
          </td>
        </tr>`).join('')
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-10 text-red-400">Gagal memuat data</td></tr>'
    }
  }

  // ── Tab Switching ──────────────────────────────────────────────────────────

  const switchTab = (tab) => {
    activeTab = tab
    const tabs = ['alumni', 'yudisium']
    tabs.forEach(t => {
      const btn = document.getElementById(`alm-tab-${t}`)
      const pane = document.getElementById(`alm-pane-${t}`)
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
    })
    if (tab === 'alumni') loadAlumni()
    if (tab === 'yudisium') loadYudisium()
  }

  // ── Detail Modal ───────────────────────────────────────────────────────────

  const openDetail = async (id) => {
    const r = await fetch(`${API}/${id}`)
    const j = await r.json()
    const a = j.data
    if (!a) return
    const body = document.getElementById('alm-detail-body')
    if (body) body.innerHTML = `
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><span class="text-slate-500">NIM</span><p class="font-mono font-medium">${a.nim}</p></div>
        <div><span class="text-slate-500">Nama</span><p class="font-medium">${a.nama}</p></div>
        <div><span class="text-slate-500">Program Studi</span><p>${a.program_studi}</p></div>
        <div><span class="text-slate-500">Angkatan</span><p>${a.angkatan}</p></div>
        <div><span class="text-slate-500">IPK</span><p class="font-semibold text-blue-700">${fmtIPK(a.ipk)}</p></div>
        <div><span class="text-slate-500">Total SKS</span><p>${a.total_sks}</p></div>
        <div><span class="text-slate-500">Tanggal Lulus</span><p>${fmtDate(a.tgl_lulus)}</p></div>
        <div><span class="text-slate-500">Tanggal Yudisium</span><p>${fmtDate(a.tgl_yudisium)}</p></div>
        <div><span class="text-slate-500">No. Ijazah</span><p class="font-mono">${a.no_ijazah}</p></div>
        <div><span class="text-slate-500">No. Transkrip</span><p class="font-mono">${a.no_transkrip}</p></div>
        <div><span class="text-slate-500">Pekerjaan</span><p>${a.pekerjaan || '-'}</p></div>
        <div><span class="text-slate-500">Instansi</span><p>${a.instansi || '-'}</p></div>
        <div><span class="text-slate-500">Email</span><p>${a.email_alumni || '-'}</p></div>
        <div><span class="text-slate-500">No. HP</span><p>${a.no_hp || '-'}</p></div>
        <div><span class="text-slate-500">Kota Domisili</span><p>${a.kota_domisili || '-'}</p></div>
        <div><span class="text-slate-500">Status Yudisium</span><p>${statusYudBadge(a.status_yudisium)}</p></div>
      </div>`
    document.getElementById('alm-detail-modal')?.classList.remove('hidden')
  }

  // ── Alumni Form Modal ──────────────────────────────────────────────────────

  const openAdd = () => {
    currentAlumniId = null
    document.getElementById('alm-form-title').textContent = 'Tambah Alumni'
    document.getElementById('alm-form').reset()
    document.getElementById('alm-form-modal')?.classList.remove('hidden')
  }

  const openEdit = async (id) => {
    const r = await fetch(`${API}/${id}`)
    const j = await r.json()
    const a = j.data
    if (!a) return
    currentAlumniId = id
    document.getElementById('alm-form-title').textContent = 'Edit Data Alumni'
    const fields = ['pekerjaan', 'instansi', 'email_alumni', 'no_hp', 'kota_domisili', 'status_yudisium', 'tgl_yudisium']
    fields.forEach(f => {
      const el = document.getElementById(`alf-${f}`)
      if (el) el.value = a[f] || ''
    })
    document.getElementById('alm-form-modal')?.classList.remove('hidden')
  }

  const submitAlumniForm = async (e) => {
    e.preventDefault()
    const body = {
      mahasiswa_id: document.getElementById('alf-mahasiswa_id')?.value,
      nim: document.getElementById('alf-nim')?.value,
      nama: document.getElementById('alf-nama')?.value,
      program_studi_id: document.getElementById('alf-program_studi_id')?.value,
      program_studi: document.getElementById('alf-program_studi')?.value,
      angkatan: document.getElementById('alf-angkatan')?.value,
      ipk: document.getElementById('alf-ipk')?.value,
      total_sks: document.getElementById('alf-total_sks')?.value,
      tgl_lulus: document.getElementById('alf-tgl_lulus')?.value,
      no_ijazah: document.getElementById('alf-no_ijazah')?.value,
      no_transkrip: document.getElementById('alf-no_transkrip')?.value,
      pekerjaan: document.getElementById('alf-pekerjaan')?.value,
      instansi: document.getElementById('alf-instansi')?.value,
      email_alumni: document.getElementById('alf-email_alumni')?.value,
      no_hp: document.getElementById('alf-no_hp')?.value,
      kota_domisili: document.getElementById('alf-kota_domisili')?.value,
      status_yudisium: document.getElementById('alf-status_yudisium')?.value,
      tgl_yudisium: document.getElementById('alf-tgl_yudisium')?.value,
    }
    try {
      const url = currentAlumniId ? `${API}/${currentAlumniId}` : API
      const method = currentAlumniId ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (!j.success) { UI.toast(j.message || 'Gagal menyimpan', 'error'); return }
      UI.toast(j.message || 'Berhasil disimpan', 'success')
      document.getElementById('alm-form-modal')?.classList.add('hidden')
      loadAlumni()
      loadStats()
    } catch (err) {
      UI.toast('Error: ' + err.message, 'error')
    }
  }

  const hapusAlumni = async (id, nama) => {
    if (!confirm(`Hapus alumni "${nama}"?`)) return
    const r = await fetch(`${API}/${id}`, { method: 'DELETE' })
    const j = await r.json()
    UI.toast(j.message || 'Dihapus', j.success ? 'success' : 'error')
    if (j.success) { loadAlumni(); loadStats() }
  }

  // ── Yudisium Form Modal ────────────────────────────────────────────────────

  const openAddYudisium = () => {
    currentYudisiumId = null
    document.getElementById('yud-form-title').textContent = 'Jadwalkan Yudisium'
    document.getElementById('yud-form').reset()
    document.getElementById('yud-form-modal')?.classList.remove('hidden')
  }

  const openEditYudisium = async (id) => {
    const r = await fetch(`${API}/yudisium/${id}`)
    const j = await r.json()
    const y = j.data
    if (!y) return
    currentYudisiumId = id
    document.getElementById('yud-form-title').textContent = 'Edit Yudisium'
    const fields = ['nama', 'tanggal', 'periode', 'tempat', 'jumlah_peserta', 'status', 'keterangan']
    fields.forEach(f => {
      const el = document.getElementById(`ydf-${f}`)
      if (el) el.value = y[f] || ''
    })
    document.getElementById('yud-form-modal')?.classList.remove('hidden')
  }

  const submitYudisiumForm = async (e) => {
    e.preventDefault()
    const body = {
      nama: document.getElementById('ydf-nama')?.value,
      tanggal: document.getElementById('ydf-tanggal')?.value,
      periode: document.getElementById('ydf-periode')?.value,
      tempat: document.getElementById('ydf-tempat')?.value,
      jumlah_peserta: document.getElementById('ydf-jumlah_peserta')?.value,
      status: document.getElementById('ydf-status')?.value,
      keterangan: document.getElementById('ydf-keterangan')?.value,
    }
    try {
      const url = currentYudisiumId ? `${API}/yudisium/${currentYudisiumId}` : `${API}/yudisium`
      const method = currentYudisiumId ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (!j.success) { UI.toast(j.message || 'Gagal menyimpan', 'error'); return }
      UI.toast(j.message || 'Berhasil disimpan', 'success')
      document.getElementById('yud-form-modal')?.classList.add('hidden')
      loadYudisium()
      loadStats()
    } catch (err) {
      UI.toast('Error: ' + err.message, 'error')
    }
  }

  const hapusYudisium = async (id, nama) => {
    if (!confirm(`Hapus yudisium "${nama}"?`)) return
    const r = await fetch(`${API}/yudisium/${id}`, { method: 'DELETE' })
    const j = await r.json()
    UI.toast(j.message || 'Dihapus', j.success ? 'success' : 'error')
    if (j.success) { loadYudisium(); loadStats() }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const render = () => {
    const el = document.getElementById('page-content')
    Router.setPageMeta('Alumni & Yudisium', 'Data alumni dan proses yudisium')
    if (!el) return
    el.innerHTML = `
    <div class="p-6 space-y-6">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">Alumni & Yudisium</h1>
          <p class="text-sm text-slate-500 mt-0.5">Manajemen data alumni dan jadwal yudisium</p>
        </div>
        <div class="flex gap-2">
          <button id="alm-btn-add-yud" onclick="AlumniModule.openAddYudisium()" class="hidden px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium">+ Jadwalkan Yudisium</button>
          <button id="alm-btn-add" onclick="AlumniModule.openAdd()" class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">+ Tambah Alumni</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        ${[
          ['alm-stat-total', 'Total Alumni', '🎓', 'blue'],
          ['alm-stat-bekerja', 'Sudah Bekerja', '💼', 'green'],
          ['alm-stat-belum', 'Belum Bekerja', '⏳', 'yellow'],
          ['alm-stat-prodi', 'Prodi', '🏫', 'purple'],
          ['alm-stat-yud-selesai', 'Yudisium Selesai', '✅', 'teal'],
          ['alm-stat-yud-jadwal', 'Yudisium Dijadwalkan', '📅', 'orange'],
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
          <button id="alm-tab-alumni" onclick="AlumniModule.switchTab('alumni')"
            class="py-3 px-4 text-sm font-medium border-b-2 border-blue-600 text-blue-600 -mb-px">
            Daftar Alumni
          </button>
          <button id="alm-tab-yudisium" onclick="AlumniModule.switchTab('yudisium')"
            class="py-3 px-4 text-sm font-medium text-slate-500 hover:text-slate-700 -mb-px">
            Yudisium
          </button>
        </div>

        <!-- Alumni Pane -->
        <div id="alm-pane-alumni" class="p-4">
          <div class="flex flex-wrap gap-2 mb-4">
            <input id="alm-search" type="text" placeholder="Cari nama / NIM / instansi..."
              class="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm w-64"
              oninput="AlumniModule.doSearch()">
            <select id="alm-filter-angkatan" onchange="AlumniModule.doSearch()"
              class="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
              <option value="">Semua Angkatan</option>
              <option value="2020">2020</option>
              <option value="2021">2021</option>
              <option value="2022">2022</option>
            </select>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">NIM</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Nama</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Prodi</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Angkatan</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">IPK</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Pekerjaan / Instansi</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Status</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Aksi</th>
                </tr>
              </thead>
              <tbody id="alm-tbody" class="divide-y divide-slate-100 dark:divide-slate-700">
                <tr><td colspan="8" class="text-center py-10 text-slate-400">Memuat data...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Yudisium Pane -->
        <div id="alm-pane-yudisium" class="p-4 hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Nama Kegiatan</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Periode</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Tanggal</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Tempat</th>
                  <th class="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-300">Peserta</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Status</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Aksi</th>
                </tr>
              </thead>
              <tbody id="yud-tbody" class="divide-y divide-slate-100 dark:divide-slate-700">
                <tr><td colspan="7" class="text-center py-10 text-slate-400">Memuat data...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div id="alm-detail-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold">Detail Alumni</h3>
          <button onclick="document.getElementById('alm-detail-modal').classList.add('hidden')"
            class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div id="alm-detail-body" class="p-5"></div>
      </div>
    </div>

    <!-- Alumni Form Modal -->
    <div id="alm-form-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h3 id="alm-form-title" class="text-lg font-semibold">Tambah Alumni</h3>
          <button onclick="document.getElementById('alm-form-modal').classList.add('hidden')"
            class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form id="alm-form" onsubmit="AlumniModule.submitAlumniForm(event)" class="p-5 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mahasiswa ID *</label>
              <input id="alf-mahasiswa_id" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm" placeholder="mhs-xxxx">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">NIM *</label>
              <input id="alf-nim" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap *</label>
              <input id="alf-nama" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Program Studi ID *</label>
              <input id="alf-program_studi_id" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm" placeholder="prodi-ti">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Program Studi *</label>
              <input id="alf-program_studi" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Angkatan *</label>
              <input id="alf-angkatan" required type="number" min="2000" max="2030" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">IPK *</label>
              <input id="alf-ipk" required type="number" step="0.01" min="0" max="4" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Total SKS *</label>
              <input id="alf-total_sks" required type="number" min="0" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tanggal Lulus *</label>
              <input id="alf-tgl_lulus" required type="date" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">No. Ijazah *</label>
              <input id="alf-no_ijazah" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">No. Transkrip *</label>
              <input id="alf-no_transkrip" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pekerjaan</label>
              <input id="alf-pekerjaan" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Instansi</label>
              <input id="alf-instansi" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Alumni</label>
              <input id="alf-email_alumni" type="email" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">No. HP</label>
              <input id="alf-no_hp" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kota Domisili</label>
              <input id="alf-kota_domisili" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status Yudisium</label>
              <select id="alf-status_yudisium" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
                <option value="belum">Belum Yudisium</option>
                <option value="selesai">Selesai</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tanggal Yudisium</label>
              <input id="alf-tgl_yudisium" type="date" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="document.getElementById('alm-form-modal').classList.add('hidden')"
              class="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">Batal</button>
            <button type="submit" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Simpan</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Yudisium Form Modal -->
    <div id="yud-form-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h3 id="yud-form-title" class="text-lg font-semibold">Jadwalkan Yudisium</h3>
          <button onclick="document.getElementById('yud-form-modal').classList.add('hidden')"
            class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form id="yud-form" onsubmit="AlumniModule.submitYudisiumForm(event)" class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Kegiatan *</label>
            <input id="ydf-nama" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm" placeholder="Yudisium Periode I 2025">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Periode *</label>
              <input id="ydf-periode" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm" placeholder="Ganjil 2024/2025">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tanggal *</label>
              <input id="ydf-tanggal" required type="date" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tempat *</label>
            <input id="ydf-tempat" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Jumlah Peserta</label>
              <input id="ydf-jumlah_peserta" type="number" min="0" value="0" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select id="ydf-status" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
                <option value="dijadwalkan">Dijadwalkan</option>
                <option value="selesai">Selesai</option>
                <option value="dibatalkan">Dibatalkan</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Keterangan</label>
            <textarea id="ydf-keterangan" rows="2" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm"></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="document.getElementById('yud-form-modal').classList.add('hidden')"
              class="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">Batal</button>
            <button type="submit" class="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Simpan</button>
          </div>
        </form>
      </div>
    </div>
    `

    loadStats()
    loadAlumni()

    // Show yudisium add button when on yudisium tab
    document.getElementById('alm-tab-yudisium')?.addEventListener('click', () => {
      document.getElementById('alm-btn-add')?.classList.add('hidden')
      document.getElementById('alm-btn-add-yud')?.classList.remove('hidden')
    })
    document.getElementById('alm-tab-alumni')?.addEventListener('click', () => {
      document.getElementById('alm-btn-add')?.classList.remove('hidden')
      document.getElementById('alm-btn-add-yud')?.classList.add('hidden')
    })
  }

  const doSearch = () => {
    const search = document.getElementById('alm-search')?.value
    const angkatan = document.getElementById('alm-filter-angkatan')?.value
    loadAlumni({ search, angkatan })
  }

  return {
    render, switchTab, doSearch,
    openDetail, openAdd, openEdit, submitAlumniForm, hapusAlumni,
    openAddYudisium, openEditYudisium, submitYudisiumForm, hapusYudisium,
  }
})()
