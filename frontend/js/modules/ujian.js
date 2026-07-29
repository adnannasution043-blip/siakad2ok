// ============================================================
// UJIAN MODULE — Jadwal Ujian, Kartu Ujian, Berita Acara
// ============================================================
const UjianModule = (() => {

  // ── state ──────────────────────────────────────────────────
  let currentTab = 'jadwal'
  let jadwalPage = 1; let kartuPage = 1; let baPage = 1
  let jadwalFilter = {}; let kartuFilter = {}; let baFilter = {}
  let stats = {}
  let editingJadwalId = null; let editingBaId = null
  let kelas_list = []; let ruang_list = []

  // ── render ─────────────────────────────────────────────────
  const render = async () => {
    Router.setPageMeta('Ujian (UTS/UAS)', 'Kelola jadwal ujian, kartu ujian, dan berita acara')
    const main = document.getElementById('page-content')
    main.innerHTML = `
      <div class="p-4 md:p-6 space-y-4">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Ujian (UTS / UAS)</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">Kelola jadwal ujian, kartu ujian, dan berita acara</p>
          </div>
        </div>

        <!-- Stats cards -->
        <div id="ujian-stats" class="grid grid-cols-2 md:grid-cols-4 gap-3"></div>

        <!-- Tabs -->
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="flex gap-1">
            ${['jadwal','kartu','berita-acara'].map(t => `
              <button onclick="UjianModule.switchTab('${t}')"
                id="tab-${t}"
                class="tab-btn px-4 py-2 text-sm font-medium border-b-2 transition-colors
                  ${currentTab === t
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}">
                ${t === 'jadwal' ? 'Jadwal Ujian' : t === 'kartu' ? 'Kartu Ujian' : 'Berita Acara'}
              </button>`).join('')}
          </nav>
        </div>

        <!-- Tab panels -->
        <div id="tab-jadwal-panel"   class="${currentTab === 'jadwal'        ? '' : 'hidden'}"></div>
        <div id="tab-kartu-panel"    class="${currentTab === 'kartu'         ? '' : 'hidden'}"></div>
        <div id="tab-berita-acara-panel" class="${currentTab === 'berita-acara' ? '' : 'hidden'}"></div>
      </div>

      <!-- Modals -->
      ${modalJadwal()}
      ${modalGenKartu()}
      ${modalKartuDetail()}
      ${modalBeritaAcara()}
    `

    await Promise.all([loadKelas(), loadRuang()])
    await loadStats()
    await renderActiveTab()
  }

  const switchTab = async (tab) => {
    currentTab = tab
    ;['jadwal','kartu','berita-acara'].forEach(t => {
      const btn = document.getElementById(`tab-${t}`)
      const panel = document.getElementById(`tab-${t}-panel`)
      if (!btn || !panel) return
      const active = t === tab
      btn.className = `tab-btn px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-blue-600 text-blue-600'
               : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`
      panel.classList.toggle('hidden', !active)
    })
    await renderActiveTab()
  }

  const renderActiveTab = async () => {
    if (currentTab === 'jadwal') await renderJadwal()
    else if (currentTab === 'kartu') await renderKartu()
    else await renderBeritaAcara()
  }

  // ── stats ──────────────────────────────────────────────────
  const loadStats = async () => {
    try {
      const res = await API.get('/ujian/stats')
      stats = res.data || {}
      const el = document.getElementById('ujian-stats')
      if (!el) return
      el.innerHTML = [
        { label: 'Total Jadwal', val: stats.total_jadwal, sub: `UTS: ${stats.jadwal_uts} / UAS: ${stats.jadwal_uas}`, color: 'blue' },
        { label: 'Dijadwalkan', val: stats.jadwal_dijadwalkan, sub: `${stats.jadwal_selesai} selesai`, color: 'amber' },
        { label: 'Kartu Ujian', val: stats.total_kartu, sub: `Layak: ${stats.kartu_layak}`, color: 'green' },
        { label: 'Tidak Layak', val: stats.kartu_tidak_layak, sub: `Perlu tindakan`, color: 'red' },
      ].map(s => `
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-2xl font-bold text-${s.color}-600 dark:text-${s.color}-400">${s.val ?? 0}</div>
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300">${s.label}</div>
          <div class="text-xs text-gray-400 mt-1">${s.sub}</div>
        </div>`).join('')
    } catch (e) {}
  }

  // ── helpers ────────────────────────────────────────────────
  const loadKelas = async () => {
    try {
      const res = await API.get('/kelas?per_page=200')
      kelas_list = res.data || []
    } catch (e) {}
  }

  const loadRuang = async () => {
    try {
      const res = await API.get('/ruang?per_page=100')
      ruang_list = res.data || []
    } catch (e) {}
  }

  const semesterOptions = () => {
    const sems = [...new Set(kelas_list.map(k => k.semester_akademik))].sort().reverse()
    return sems.map(s => `<option value="${s}">${s}</option>`).join('')
  }

  const fmtTgl = (s) => s ? new Date(s).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '-'

  const statusBadge = (s, map) => {
    const cls = map[s] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${cls}">${s}</span>`
  }

  // ── JADWAL tab ─────────────────────────────────────────────
  const renderJadwal = async () => {
    const panel = document.getElementById('tab-jadwal-panel')
    const params = new URLSearchParams({ page: jadwalPage, per_page: 20, ...jadwalFilter })
    let data = [], meta = {}
    try {
      const res = await API.get(`/ujian/jadwal?${params}`)
      data = res.data || []; meta = res.meta || {}
    } catch (e) {}

    const jenisBadge = { UTS: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
                         UAS: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
                         Susulan: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' }
    const statusMap = { dijadwalkan: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
                        berlangsung: 'bg-blue-100 text-blue-700',
                        selesai: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                        batal: 'bg-red-100 text-red-700' }

    panel.innerHTML = `
      <!-- Filter bar -->
      <div class="flex flex-wrap gap-2 mb-4">
        <select id="jadwal-f-jenis" onchange="UjianModule.filterJadwal()"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">Semua Jenis</option>
          <option value="UTS" ${jadwalFilter.jenis === 'UTS' ? 'selected' : ''}>UTS</option>
          <option value="UAS" ${jadwalFilter.jenis === 'UAS' ? 'selected' : ''}>UAS</option>
          <option value="Susulan" ${jadwalFilter.jenis === 'Susulan' ? 'selected' : ''}>Susulan</option>
        </select>
        <select id="jadwal-f-sem" onchange="UjianModule.filterJadwal()"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">Semua Semester</option>${semesterOptions()}
        </select>
        <select id="jadwal-f-status" onchange="UjianModule.filterJadwal()"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">Semua Status</option>
          <option value="dijadwalkan">Dijadwalkan</option>
          <option value="selesai">Selesai</option>
          <option value="batal">Batal</option>
        </select>
        <input id="jadwal-f-search" type="text" placeholder="Cari mata kuliah / dosen…"
          value="${jadwalFilter.search || ''}"
          oninput="UjianModule.filterJadwal()"
          class="flex-1 min-w-[180px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
        <button onclick="UjianModule.openJadwalModal()"
          class="ml-auto px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + Tambah Jadwal
        </button>
      </div>

      <!-- Table -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 text-left">
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Mata Kuliah</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Jenis</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Tanggal & Waktu</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Ruang</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Semester</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0
              ? `<tr><td colspan="7" class="text-center py-10 text-gray-400">Belum ada jadwal ujian</td></tr>`
              : data.map(j => `
              <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                <td class="px-4 py-3">
                  <div class="font-medium text-gray-900 dark:text-white">${j.mata_kuliah_nama}</div>
                  <div class="text-xs text-gray-400">${j.mata_kuliah_kode} · ${j.dosen_nama}</div>
                </td>
                <td class="px-4 py-3">${statusBadge(j.jenis, jenisBadge)}</td>
                <td class="px-4 py-3">
                  <div class="font-medium dark:text-white">${fmtTgl(j.tanggal)}</div>
                  <div class="text-xs text-gray-400">${j.jam_mulai} – ${j.jam_selesai}</div>
                </td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-400">${j.ruang_nama || '-'}</td>
                <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">${j.semester_akademik}</td>
                <td class="px-4 py-3">${statusBadge(j.status, statusMap)}</td>
                <td class="px-4 py-3">
                  <div class="flex gap-1">
                    <button onclick="UjianModule.openJadwalModal('${j.id}')"
                      class="px-2 py-1 text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 rounded">Edit</button>
                    <button onclick="UjianModule.openNewBa('${j.id}')"
                      title="Buat Berita Acara"
                      class="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded">BA</button>
                    ${j.status !== 'selesai' ? `
                    <button onclick="UjianModule.hapusJadwal('${j.id}')"
                      class="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded">Hapus</button>` : ''}
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(meta, 'UjianModule.gotoJadwalPage')}
    `
  }

  const filterJadwal = () => {
    jadwalFilter = {}
    const jenis = document.getElementById('jadwal-f-jenis')?.value
    const sem   = document.getElementById('jadwal-f-sem')?.value
    const stat  = document.getElementById('jadwal-f-status')?.value
    const search = document.getElementById('jadwal-f-search')?.value.trim()
    if (jenis)  jadwalFilter.jenis    = jenis
    if (sem)    jadwalFilter.semester = sem
    if (stat)   jadwalFilter.status   = stat
    if (search) jadwalFilter.search   = search
    jadwalPage = 1
    renderJadwal()
  }

  const gotoJadwalPage = (p) => { jadwalPage = p; renderJadwal() }

  // ── JADWAL MODAL ───────────────────────────────────────────
  const modalJadwal = () => `
    <div id="modal-jadwal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h3 id="modal-jadwal-title" class="text-lg font-semibold dark:text-white">Tambah Jadwal Ujian</h3>
          <button onclick="UjianModule.closeJadwalModal()" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelas</label>
            <select id="j-kelas" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
              <option value="">-- Pilih Kelas --</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Ujian</label>
              <select id="j-jenis" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
                <option value="UTS">UTS</option>
                <option value="UAS">UAS</option>
                <option value="Susulan">Susulan</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ruang</label>
              <select id="j-ruang" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
                <option value="">-- Pilih Ruang --</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal</label>
            <input id="j-tanggal" type="date" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Mulai</label>
              <input id="j-jam-mulai" type="time" value="08:00" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Selesai</label>
              <input id="j-jam-selesai" type="time" value="10:00" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
            </div>
          </div>
          <div id="j-status-row" class="hidden">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select id="j-status" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
              <option value="dijadwalkan">Dijadwalkan</option>
              <option value="berlangsung">Berlangsung</option>
              <option value="selesai">Selesai</option>
              <option value="batal">Batal</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
            <textarea id="j-catatan" rows="2" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" placeholder="Opsional"></textarea>
          </div>
          <div id="modal-jadwal-err" class="hidden text-sm text-red-600 dark:text-red-400"></div>
        </div>
        <div class="flex justify-end gap-2 px-5 pb-5">
          <button onclick="UjianModule.closeJadwalModal()" class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Batal</button>
          <button id="btn-save-jadwal" onclick="UjianModule.saveJadwal()" class="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium">Simpan</button>
        </div>
      </div>
    </div>`

  const openJadwalModal = async (jadwalId = null) => {
    editingJadwalId = jadwalId
    const modal = document.getElementById('modal-jadwal')
    modal.classList.remove('hidden')
    document.getElementById('modal-jadwal-title').textContent = jadwalId ? 'Edit Jadwal Ujian' : 'Tambah Jadwal Ujian'
    document.getElementById('modal-jadwal-err').classList.add('hidden')
    document.getElementById('j-status-row').classList.toggle('hidden', !jadwalId)

    // Populate kelas
    const kelasEl = document.getElementById('j-kelas')
    kelasEl.innerHTML = '<option value="">-- Pilih Kelas --</option>' +
      kelas_list.map(k => `<option value="${k.id}">${k.semester_akademik} · ${k.mata_kuliah_kode} ${k.mata_kuliah_nama} (${k.kode_kelas})</option>`).join('')

    // Populate ruang
    const ruangEl = document.getElementById('j-ruang')
    ruangEl.innerHTML = '<option value="">-- Pilih Ruang --</option>' +
      ruang_list.map(r => `<option value="${r.id}">${r.nama} (kap ${r.kapasitas})</option>`).join('')

    if (jadwalId) {
      try {
        const res = await API.get(`/ujian/jadwal/${jadwalId}`)
        const j = res.data
        document.getElementById('j-kelas').value     = j.kelas_id
        document.getElementById('j-kelas').disabled  = true
        document.getElementById('j-jenis').value     = j.jenis
        document.getElementById('j-jenis').disabled  = true
        document.getElementById('j-ruang').value     = j.ruang_id || ''
        document.getElementById('j-tanggal').value   = j.tanggal
        document.getElementById('j-jam-mulai').value = j.jam_mulai
        document.getElementById('j-jam-selesai').value = j.jam_selesai
        document.getElementById('j-status').value    = j.status
        document.getElementById('j-catatan').value   = j.catatan || ''
      } catch (e) {}
    } else {
      document.getElementById('j-kelas').disabled  = false
      document.getElementById('j-jenis').disabled  = false
    }
  }

  const closeJadwalModal = () => {
    document.getElementById('modal-jadwal').classList.add('hidden')
    editingJadwalId = null
    document.getElementById('j-kelas').disabled  = false
    document.getElementById('j-jenis').disabled  = false
  }

  const saveJadwal = async () => {
    const btn = document.getElementById('btn-save-jadwal')
    const errEl = document.getElementById('modal-jadwal-err')
    btn.disabled = true; btn.textContent = 'Menyimpan...'
    errEl.classList.add('hidden')
    try {
      const body = {
        kelas_id:   document.getElementById('j-kelas').value,
        jenis:      document.getElementById('j-jenis').value,
        ruang_id:   document.getElementById('j-ruang').value,
        tanggal:    document.getElementById('j-tanggal').value,
        jam_mulai:  document.getElementById('j-jam-mulai').value,
        jam_selesai:document.getElementById('j-jam-selesai').value,
        catatan:    document.getElementById('j-catatan').value.trim() || null,
      }
      if (editingJadwalId) {
        body.status = document.getElementById('j-status').value
        await API.put(`/ujian/jadwal/${editingJadwalId}`, body)
      } else {
        await API.post('/ujian/jadwal', body)
      }
      closeJadwalModal()
      await loadStats()
      await renderJadwal()
      UI.toast('Jadwal berhasil disimpan', 'success')
    } catch (e) {
      errEl.textContent = e.message || 'Gagal menyimpan jadwal'
      errEl.classList.remove('hidden')
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan'
    }
  }

  const hapusJadwal = async (id) => {
    if (!confirm('Hapus jadwal ujian ini?')) return
    try {
      await API.delete(`/ujian/jadwal/${id}`)
      await loadStats(); await renderJadwal()
      UI.toast('Jadwal dihapus', 'success')
    } catch (e) { UI.toast(e.message || 'Gagal hapus', 'error') }
  }

  // ── KARTU UJIAN tab ────────────────────────────────────────
  const renderKartu = async () => {
    const panel = document.getElementById('tab-kartu-panel')
    const params = new URLSearchParams({ page: kartuPage, per_page: 20, ...kartuFilter })
    let data = [], meta = {}
    try {
      const res = await API.get(`/ujian/kartu?${params}`)
      data = res.data || []; meta = res.meta || {}
    } catch (e) {}

    const statusMap = {
      layak: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      tidak_layak: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    }

    panel.innerHTML = `
      <div class="flex flex-wrap gap-2 mb-4">
        <select id="kartu-f-jenis" onchange="UjianModule.filterKartu()"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">Semua Jenis</option>
          <option value="UTS" ${kartuFilter.jenis==='UTS'?'selected':''}>UTS</option>
          <option value="UAS" ${kartuFilter.jenis==='UAS'?'selected':''}>UAS</option>
        </select>
        <select id="kartu-f-sem" onchange="UjianModule.filterKartu()"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">Semua Semester</option>${semesterOptions()}
        </select>
        <select id="kartu-f-status" onchange="UjianModule.filterKartu()"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">Semua Status</option>
          <option value="layak" ${kartuFilter.status==='layak'?'selected':''}>Layak</option>
          <option value="tidak_layak" ${kartuFilter.status==='tidak_layak'?'selected':''}>Tidak Layak</option>
        </select>
        <input id="kartu-f-search" type="text" placeholder="Cari nama / NIM…"
          value="${kartuFilter.search || ''}"
          oninput="UjianModule.filterKartu()"
          class="flex-1 min-w-[180px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
        <button onclick="UjianModule.openGenKartu()"
          class="ml-auto px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Generate Kartu
        </button>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 text-left">
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Mahasiswa</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Semester</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Jenis</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Kendala</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0
              ? `<tr><td colspan="6" class="text-center py-10 text-gray-400">Belum ada kartu ujian. Klik "Generate Kartu" untuk membuat.</td></tr>`
              : data.map(k => `
              <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                <td class="px-4 py-3">
                  <div class="font-medium dark:text-white">${k.mahasiswa_nama}</div>
                  <div class="text-xs text-gray-400">${k.mahasiswa_nim}</div>
                </td>
                <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">${k.semester_akademik}</td>
                <td class="px-4 py-3">
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">${k.jenis}</span>
                </td>
                <td class="px-4 py-3">${statusBadge(k.status.replace('_', ' '), statusMap)}</td>
                <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                  ${k.kendala?.length ? k.kendala.map(kd =>
                    `<div class="text-red-500">${kd.isu === 'spp_belum_lunas' ? '⚠ SPP belum lunas' : `⚠ ${kd.mata_kuliah_kode || ''}: ${kd.persen_hadir}% hadir`}</div>`
                  ).join('') : '<span class="text-green-500">Memenuhi syarat</span>'}
                </td>
                <td class="px-4 py-3">
                  <div class="flex gap-1">
                    <button onclick="UjianModule.lihatKartu('${k.id}')"
                      class="px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded">Detail</button>
                    ${k.status === 'layak' ? `
                    <button onclick="UjianModule.printKartu('${k.id}')"
                      class="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded">Print</button>` : ''}
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(meta, 'UjianModule.gotoKartuPage')}
    `
  }

  const filterKartu = () => {
    kartuFilter = {}
    const jenis  = document.getElementById('kartu-f-jenis')?.value
    const sem    = document.getElementById('kartu-f-sem')?.value
    const stat   = document.getElementById('kartu-f-status')?.value
    const search = document.getElementById('kartu-f-search')?.value.trim()
    if (jenis)  kartuFilter.jenis    = jenis
    if (sem)    kartuFilter.semester = sem
    if (stat)   kartuFilter.status   = stat
    if (search) kartuFilter.search   = search
    kartuPage = 1
    renderKartu()
  }

  const gotoKartuPage = (p) => { kartuPage = p; renderKartu() }

  // ── Generate Kartu modal ───────────────────────────────────
  const modalGenKartu = () => `
    <div id="modal-gen-kartu" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h3 class="text-lg font-semibold dark:text-white">Generate Kartu Ujian</h3>
          <button onclick="document.getElementById('modal-gen-kartu').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">Generate kartu ujian untuk semua mahasiswa aktif. Sistem akan memeriksa kelayakan (SPP lunas dan kehadiran ≥ 75%).</p>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
            <select id="gen-sem" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
              ${semesterOptions()}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Ujian</label>
            <select id="gen-jenis" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
              <option value="UTS">UTS</option>
              <option value="UAS">UAS</option>
            </select>
          </div>
          <div id="gen-err" class="hidden text-sm text-red-600 dark:text-red-400"></div>
        </div>
        <div class="flex justify-end gap-2 px-5 pb-5">
          <button onclick="document.getElementById('modal-gen-kartu').classList.add('hidden')" class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Batal</button>
          <button id="btn-gen-kartu" onclick="UjianModule.doGenKartu()" class="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium">Generate</button>
        </div>
      </div>
    </div>`

  const openGenKartu = () => {
    document.getElementById('modal-gen-kartu').classList.remove('hidden')
    document.getElementById('gen-err').classList.add('hidden')
  }

  const doGenKartu = async () => {
    const btn = document.getElementById('btn-gen-kartu')
    const errEl = document.getElementById('gen-err')
    btn.disabled = true; btn.textContent = 'Memproses...'
    errEl.classList.add('hidden')
    try {
      const res = await API.post('/ujian/kartu/generate', {
        semester_akademik: document.getElementById('gen-sem').value,
        jenis: document.getElementById('gen-jenis').value,
      })
      document.getElementById('modal-gen-kartu').classList.add('hidden')
      await loadStats(); await renderKartu()
      UI.toast(res.message, 'success')
    } catch (e) {
      errEl.textContent = e.message || 'Gagal generate kartu'
      errEl.classList.remove('hidden')
    } finally {
      btn.disabled = false; btn.textContent = 'Generate'
    }
  }

  // ── Kartu Detail modal ─────────────────────────────────────
  const modalKartuDetail = () => `
    <div id="modal-kartu-detail" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h3 class="text-lg font-semibold dark:text-white">Kartu Ujian</h3>
          <button onclick="document.getElementById('modal-kartu-detail').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div id="kartu-detail-body" class="p-5"></div>
        <div class="flex justify-end gap-2 px-5 pb-5">
          <button onclick="document.getElementById('modal-kartu-detail').classList.add('hidden')" class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Tutup</button>
          <button id="btn-print-detail" class="hidden px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium">Print Kartu</button>
        </div>
      </div>
    </div>`

  const lihatKartu = async (id) => {
    document.getElementById('modal-kartu-detail').classList.remove('hidden')
    const body = document.getElementById('kartu-detail-body')
    body.innerHTML = '<div class="text-center py-8 text-gray-400">Memuat...</div>'
    try {
      const res = await API.get(`/ujian/kartu/${id}`)
      const k = res.data
      const printBtn = document.getElementById('btn-print-detail')
      if (k.status === 'layak') {
        printBtn.classList.remove('hidden')
        printBtn.onclick = () => printKartu(id)
      } else {
        printBtn.classList.add('hidden')
      }
      body.innerHTML = `
        <div class="space-y-4">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-xl font-bold dark:text-white">${k.mahasiswa_nama}</div>
              <div class="text-gray-500 dark:text-gray-400">${k.mahasiswa_nim}</div>
            </div>
            <span class="px-3 py-1 rounded-full text-sm font-medium ${k.status === 'layak'
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}">
              ${k.status === 'layak' ? 'LAYAK UJIAN' : 'TIDAK LAYAK'}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div><span class="text-gray-500">Semester:</span> <span class="font-medium dark:text-white">${k.semester_akademik}</span></div>
            <div><span class="text-gray-500">Jenis:</span> <span class="font-medium dark:text-white">${k.jenis}</span></div>
          </div>
          ${k.kendala?.length ? `
          <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <div class="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Kendala:</div>
            ${k.kendala.map(kd => `
              <div class="text-sm text-red-600 dark:text-red-400">• ${kd.keterangan}</div>`).join('')}
          </div>` : ''}
          ${k.mata_kuliah_ujian?.length ? `
          <div>
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Jadwal Ujian:</div>
            <div class="space-y-2">
              ${k.mata_kuliah_ujian.map(m => `
                <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm">
                  <div class="font-medium dark:text-white">${m.mata_kuliah_nama} <span class="text-gray-400">(${m.mata_kuliah_kode})</span></div>
                  <div class="text-gray-500 dark:text-gray-400">${fmtTgl(m.tanggal)} · ${m.jam_mulai} – ${m.jam_selesai} · ${m.ruang_nama || 'Ruang TBA'}</div>
                </div>`).join('')}
            </div>
          </div>` : '<div class="text-sm text-gray-400">Belum ada jadwal ujian yang terdaftar</div>'}
        </div>`
    } catch (e) {
      body.innerHTML = `<div class="text-center py-8 text-red-400">Gagal memuat data</div>`
    }
  }

  const printKartu = async (id) => {
    try {
      const res = await API.get(`/ujian/kartu/${id}`)
      const k = res.data
      const win = window.open('', '_blank')
      win.document.write(`<!DOCTYPE html><html><head>
        <title>Kartu Ujian – ${k.mahasiswa_nim}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 700px; margin: 20px auto; padding: 20px; }
          h1 { text-align: center; font-size: 18px; margin-bottom: 4px; }
          .sub { text-align: center; font-size: 13px; color: #555; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th, td { border: 1px solid #ccc; padding: 8px 10px; }
          th { background: #f0f0f0; text-align: left; }
          .status { text-align: center; font-weight: bold; padding: 8px 16px;
            border: 2px solid; border-radius: 4px; display: inline-block; margin: 10px 0; }
          .layak { color: green; border-color: green; }
          .ttd { margin-top: 40px; display: flex; justify-content: space-between; }
          .ttd-box { text-align: center; width: 200px; }
          @media print { button { display: none !important; } }
        </style>
      </head><body>
        <h1>KARTU UJIAN ${k.jenis}</h1>
        <div class="sub">Semester ${k.semester_akademik}</div>
        <div style="text-align:center">
          <div class="status layak">LAYAK MENGIKUTI UJIAN</div>
        </div>
        <table style="margin-bottom:16px">
          <tr><th width="35%">Nama</th><td>${k.mahasiswa_nama}</td></tr>
          <tr><th>NIM</th><td>${k.mahasiswa_nim}</td></tr>
          <tr><th>Semester</th><td>${k.semester_akademik}</td></tr>
          <tr><th>Jenis Ujian</th><td>${k.jenis}</td></tr>
        </table>
        <h3 style="font-size:14px;margin:12px 0 8px">Jadwal Ujian:</h3>
        <table>
          <thead>
            <tr>
              <th>No</th><th>Mata Kuliah</th><th>Tanggal</th><th>Waktu</th><th>Ruang</th><th>Tanda Tangan</th>
            </tr>
          </thead>
          <tbody>
            ${(k.mata_kuliah_ujian || []).map((m, i) => `
              <tr>
                <td style="text-align:center">${i+1}</td>
                <td>${m.mata_kuliah_nama} (${m.mata_kuliah_kode})</td>
                <td>${new Date(m.tanggal).toLocaleDateString('id-ID', {weekday:'short',day:'numeric',month:'short',year:'numeric'})}</td>
                <td>${m.jam_mulai} – ${m.jam_selesai}</td>
                <td>${m.ruang_nama || '-'}</td>
                <td style="width:80px">&nbsp;</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <div class="ttd">
          <div class="ttd-box">
            <div>Mengetahui,</div>
            <div>Admin Akademik</div>
            <div style="height:50px"></div>
            <div style="border-top:1px solid #000;padding-top:4px">(.........................)</div>
          </div>
          <div class="ttd-box">
            <div>Dicetak tanggal:</div>
            <div>${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</div>
            <div style="height:50px"></div>
            <div style="border-top:1px solid #000;padding-top:4px">Mahasiswa</div>
          </div>
        </div>
        <script>window.print();</script>
      </body></html>`)
      win.document.close()
    } catch (e) { UI.toast('Gagal memuat kartu', 'error') }
  }

  // ── BERITA ACARA tab ───────────────────────────────────────
  const renderBeritaAcara = async () => {
    const panel = document.getElementById('tab-berita-acara-panel')
    const params = new URLSearchParams({ page: baPage, per_page: 20, ...baFilter })
    let data = [], meta = {}
    try {
      const res = await API.get(`/ujian/berita-acara?${params}`)
      data = res.data || []; meta = res.meta || {}
    } catch (e) {}

    const statusMap = {
      draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
      selesai: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    }

    panel.innerHTML = `
      <div class="flex flex-wrap gap-2 mb-4">
        <select id="ba-f-jenis" onchange="UjianModule.filterBa()"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">Semua Jenis</option>
          <option value="UTS">UTS</option>
          <option value="UAS">UAS</option>
        </select>
        <select id="ba-f-sem" onchange="UjianModule.filterBa()"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">Semua Semester</option>${semesterOptions()}
        </select>
        <select id="ba-f-status" onchange="UjianModule.filterBa()"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="selesai">Selesai</option>
        </select>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 text-left">
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Mata Kuliah</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Jenis</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Tanggal</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Peserta</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Hadir</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0
              ? `<tr><td colspan="7" class="text-center py-10 text-gray-400">Belum ada berita acara. Buat dari tombol "BA" pada tabel Jadwal Ujian.</td></tr>`
              : data.map(b => `
              <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                <td class="px-4 py-3">
                  <div class="font-medium dark:text-white">${b.mata_kuliah_nama}</div>
                  <div class="text-xs text-gray-400">${b.mata_kuliah_kode} · ${b.ruang_nama || '-'}</div>
                </td>
                <td class="px-4 py-3">
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">${b.jenis}</span>
                </td>
                <td class="px-4 py-3 text-sm dark:text-gray-300">${fmtTgl(b.tanggal)}</td>
                <td class="px-4 py-3 text-center font-medium dark:text-white">${b.jumlah_peserta_terdaftar}</td>
                <td class="px-4 py-3">
                  <div class="text-center font-medium dark:text-white">${b.jumlah_hadir}</div>
                  <div class="text-xs text-gray-400 text-center">${b.jumlah_peserta_terdaftar > 0
                    ? Math.round(b.jumlah_hadir / b.jumlah_peserta_terdaftar * 100) + '%' : '-'}</div>
                </td>
                <td class="px-4 py-3">${statusBadge(b.status, statusMap)}</td>
                <td class="px-4 py-3">
                  <button onclick="UjianModule.openBaModal('${b.id}')"
                    class="px-2 py-1 text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 rounded">
                    ${b.status === 'selesai' ? 'Lihat' : 'Edit'}
                  </button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(meta, 'UjianModule.gotoBaPage')}
    `
  }

  const filterBa = () => {
    baFilter = {}
    const jenis = document.getElementById('ba-f-jenis')?.value
    const sem   = document.getElementById('ba-f-sem')?.value
    const stat  = document.getElementById('ba-f-status')?.value
    if (jenis) baFilter.jenis    = jenis
    if (sem)   baFilter.semester = sem
    if (stat)  baFilter.status   = stat
    baPage = 1
    renderBeritaAcara()
  }

  const gotoBaPage = (p) => { baPage = p; renderBeritaAcara() }

  // ── Berita Acara modal ─────────────────────────────────────
  const modalBeritaAcara = () => `
    <div id="modal-ba" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h3 id="modal-ba-title" class="text-lg font-semibold dark:text-white">Berita Acara Ujian</h3>
          <button onclick="UjianModule.closeBaModal()" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div id="ba-jadwal-info" class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300"></div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pengawas 1</label>
              <input id="ba-pengawas1" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" placeholder="Nama pengawas">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pengawas 2</label>
              <input id="ba-pengawas2" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" placeholder="Opsional">
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Peserta Terdaftar</label>
              <input id="ba-terdaftar" type="number" min="0" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hadir</label>
              <input id="ba-hadir" type="number" min="0" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tidak Hadir</label>
              <input id="ba-tidak-hadir" type="number" min="0" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select id="ba-status" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
              <option value="draft">Draft</option>
              <option value="selesai">Selesai</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
            <textarea id="ba-catatan" rows="2" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"></textarea>
          </div>
          <div id="modal-ba-err" class="hidden text-sm text-red-600 dark:text-red-400"></div>
        </div>
        <div class="flex justify-end gap-2 px-5 pb-5">
          <button onclick="UjianModule.closeBaModal()" class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Batal</button>
          <button id="btn-save-ba" onclick="UjianModule.saveBa()" class="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium">Simpan</button>
        </div>
      </div>
    </div>`

  // jadwalId can be for creating new BA, or null when editing existing
  let _pendingJadwalId = null
  const openNewBa = async (jadwalId) => {
    _pendingJadwalId = jadwalId
    editingBaId = null
    const modal = document.getElementById('modal-ba')
    modal.classList.remove('hidden')
    document.getElementById('modal-ba-title').textContent = 'Buat Berita Acara'
    document.getElementById('modal-ba-err').classList.add('hidden')
    document.getElementById('btn-save-ba').classList.remove('hidden')

    try {
      const res = await API.get(`/ujian/jadwal/${jadwalId}`)
      const j = res.data
      document.getElementById('ba-jadwal-info').innerHTML =
        `<strong>${j.mata_kuliah_nama}</strong> · ${j.jenis} · ${fmtTgl(j.tanggal)} · ${j.jam_mulai}–${j.jam_selesai} · ${j.ruang_nama || '-'}`
      document.getElementById('ba-pengawas1').value = j.pengawas?.[0] || ''
      document.getElementById('ba-pengawas2').value = j.pengawas?.[1] || ''
    } catch (e) {}

    document.getElementById('ba-terdaftar').value   = '0'
    document.getElementById('ba-hadir').value        = '0'
    document.getElementById('ba-tidak-hadir').value  = '0'
    document.getElementById('ba-status').value       = 'draft'
    document.getElementById('ba-catatan').value      = ''
  }

  const openBaModal = async (baId) => {
    editingBaId = baId
    _pendingJadwalId = null
    const modal = document.getElementById('modal-ba')
    modal.classList.remove('hidden')
    document.getElementById('modal-ba-err').classList.add('hidden')
    try {
      const res = await API.get(`/ujian/berita-acara/${baId}`)
      const b = res.data
      const selesai = b.status === 'selesai'
      document.getElementById('modal-ba-title').textContent = selesai ? 'Berita Acara (Selesai)' : 'Edit Berita Acara'
      document.getElementById('btn-save-ba').classList.toggle('hidden', selesai)
      document.getElementById('ba-jadwal-info').innerHTML =
        `<strong>${b.mata_kuliah_nama}</strong> · ${b.jenis} · ${fmtTgl(b.tanggal)} · ${b.jam_mulai}–${b.jam_selesai} · ${b.ruang_nama || '-'}`
      document.getElementById('ba-pengawas1').value     = b.pengawas1 || ''
      document.getElementById('ba-pengawas2').value     = b.pengawas2 || ''
      document.getElementById('ba-terdaftar').value     = b.jumlah_peserta_terdaftar
      document.getElementById('ba-hadir').value          = b.jumlah_hadir
      document.getElementById('ba-tidak-hadir').value   = b.jumlah_tidak_hadir
      document.getElementById('ba-status').value         = b.status
      document.getElementById('ba-catatan').value        = b.catatan || ''
    } catch (e) {}
  }

  const closeBaModal = () => {
    document.getElementById('modal-ba').classList.add('hidden')
    editingBaId = null; _pendingJadwalId = null
  }

  const saveBa = async () => {
    const btn = document.getElementById('btn-save-ba')
    const errEl = document.getElementById('modal-ba-err')
    btn.disabled = true; btn.textContent = 'Menyimpan...'
    errEl.classList.add('hidden')
    try {
      const body = {
        pengawas1: document.getElementById('ba-pengawas1').value.trim(),
        pengawas2: document.getElementById('ba-pengawas2').value.trim(),
        jumlah_peserta_terdaftar: parseInt(document.getElementById('ba-terdaftar').value) || 0,
        jumlah_hadir: parseInt(document.getElementById('ba-hadir').value) || 0,
        jumlah_tidak_hadir: parseInt(document.getElementById('ba-tidak-hadir').value) || 0,
        status: document.getElementById('ba-status').value,
        catatan: document.getElementById('ba-catatan').value.trim(),
      }
      if (editingBaId) {
        await API.put(`/ujian/berita-acara/${editingBaId}`, body)
      } else {
        body.jadwal_ujian_id = _pendingJadwalId
        await API.post('/ujian/berita-acara', body)
      }
      closeBaModal()
      await loadStats(); await renderBeritaAcara()
      UI.toast('Berita acara berhasil disimpan', 'success')
    } catch (e) {
      errEl.textContent = e.message || 'Gagal menyimpan'
      errEl.classList.remove('hidden')
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan'
    }
  }

  // ── pagination helper ──────────────────────────────────────
  const renderPagination = (meta, fn) => {
    if (!meta || meta.total_pages <= 1) return ''
    const { page, total_pages, total } = meta
    return `
      <div class="flex items-center justify-between mt-4 text-sm text-gray-600 dark:text-gray-400">
        <div>Total: ${total} data</div>
        <div class="flex gap-1">
          ${page > 1 ? `<button onclick="${fn}(${page - 1})" class="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">‹</button>` : ''}
          <span class="px-3 py-1">Hal ${page} / ${total_pages}</span>
          ${page < total_pages ? `<button onclick="${fn}(${page + 1})" class="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">›</button>` : ''}
        </div>
      </div>`
  }

  return {
    render, switchTab,
    filterJadwal, gotoJadwalPage,
    openJadwalModal, closeJadwalModal, saveJadwal, hapusJadwal,
    filterKartu, gotoKartuPage,
    openGenKartu, doGenKartu,
    lihatKartu, printKartu,
    filterBa, gotoBaPage,
    openNewBa, openBaModal, closeBaModal, saveBa,
  }
})()
