// ============================================================
// KRS.JS — Kartu Rencana Studi
// Admin view: list semua KRS + setujui/tolak/batalkan
// Tambah: ajukan KRS untuk mahasiswa
// ============================================================
const KRSModule = (() => {

  let state = {
    list: [], meta: null, semesters: [], stats: null,
    page: 1, search: '', status: '', semester_akademik: '',
    mhsList: [], kelasList: [],
  }

  // ── Data loaders ──────────────────────────────────────────
  const fetchSemesters = async () => {
    if (state.semesters.length) return
    const [semRes, kelasRes] = await Promise.all([
      API.get('/krs/semesters'),
      API.get('/kelas/semesters'),
    ])
    // merge unique semesters from both sources
    const all = [...new Set([...(semRes.data || []), ...(kelasRes.data || [])])]
    state.semesters = all.sort().reverse()
    if (!state.semester_akademik && state.semesters.length) {
      state.semester_akademik = state.semesters[0]
    }
  }

  const fetchStats = async () => {
    const res = await API.get('/krs/stats', { semester_akademik: state.semester_akademik })
    state.stats = res.data
    renderStats()
  }

  const fetchList = async () => {
    const params = {
      page: state.page, per_page: 20,
      search: state.search, status: state.status,
      semester_akademik: state.semester_akademik,
    }
    if (Auth.hasRole('mahasiswa')) params.mahasiswa_id = Auth.getEntityId() || ''
    const res = await API.get('/krs', params)
    state.list = res.data
    state.meta = res.meta
    renderTable()
    renderPagination()
  }

  const loadFormRefs = async () => {
    if (state.mhsList.length) return
    const [mhsRes, kelasRes] = await Promise.all([
      API.get('/mahasiswa', { per_page: 500, status: 'aktif' }),
      API.get('/kelas', { per_page: 200, semester_akademik: state.semester_akademik }),
    ])
    state.mhsList   = mhsRes.data  || []
    state.kelasList = kelasRes.data || []
  }

  // ── Main render ──────────────────────────────────────────
  const render = async () => {
    Router.setPageMeta('KRS', 'Kartu Rencana Studi')
    await fetchSemesters()

    document.getElementById('page-content').innerHTML = `
      <!-- Stats row -->
      <div id="krs-stats" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5"></div>

      <!-- Filters + action -->
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div class="flex-1 min-w-48">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" placeholder="Cari mahasiswa atau mata kuliah…"
              value="${state.search}"
              class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              oninput="KRSModule.onSearch(this.value)" />
          </div>
        </div>
        <select onchange="KRSModule.onFilter('semester_akademik', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Semester</option>
          ${state.semesters.map(s => `<option value="${s}" ${state.semester_akademik===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <select onchange="KRSModule.onFilter('status', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Status</option>
          <option value="pending"    ${state.status==='pending'   ?'selected':''}>Pending</option>
          <option value="disetujui"  ${state.status==='disetujui' ?'selected':''}>Disetujui</option>
          <option value="ditolak"    ${state.status==='ditolak'   ?'selected':''}>Ditolak</option>
          <option value="dibatalkan" ${state.status==='dibatalkan'?'selected':''}>Dibatalkan</option>
        </select>
        <button onclick="KRSModule.openAjukan()"
          class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Ajukan KRS
        </button>
      </div>

      ${UI.card(`
        <div id="krs-table-wrap"></div>
        <div id="krs-pagination"></div>
      `)}
    `
    await Promise.all([fetchStats(), fetchList()])
  }

  // ── Stats cards ──────────────────────────────────────────
  const renderStats = () => {
    const s = state.stats
    if (!s) return
    const el = document.getElementById('krs-stats')
    if (!el) return
    const card = (label, val, color) => `
      <div class="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0">
          <span class="text-lg font-bold">${val}</span>
        </div>
        <div class="text-sm text-slate-600">${label}</div>
      </div>`
    el.innerHTML =
      card('Total KRS',  s.total,     'bg-slate-100 text-slate-700') +
      card('Pending',    s.pending,   'bg-yellow-100 text-yellow-700') +
      card('Disetujui',  s.disetujui, 'bg-green-100 text-green-700') +
      card('Ditolak',    s.ditolak,   'bg-red-100 text-red-700')
  }

  const statusBadge = (s) => {
    const map = {
      disetujui:  'bg-green-100 text-green-700',
      pending:    'bg-yellow-100 text-yellow-700',
      ditolak:    'bg-red-100 text-red-700',
      dibatalkan: 'bg-slate-100 text-slate-500',
    }
    return `<span class="badge ${map[s] || 'bg-slate-100 text-slate-600'}">${s}</span>`
  }

  // ── Table ─────────────────────────────────────────────────
  const renderTable = () => {
    document.getElementById('krs-table-wrap').innerHTML = UI.renderTable({
      headers: ['Mahasiswa', 'Mata Kuliah', 'SKS', 'Semester', 'Dosen Wali', 'Status', 'Aksi'],
      emptyText: 'Tidak ada data KRS',
      rows: state.list.map(k => `
        <td class="px-4 py-3">
          <div class="font-medium text-slate-800 text-sm">${k.mahasiswa_nama}</div>
          <div class="text-xs text-slate-400 font-mono">${k.mahasiswa_nim}</div>
        </td>
        <td class="px-4 py-3">
          <div class="text-sm text-slate-800">${k.mata_kuliah_nama}</div>
          <div class="text-xs text-slate-400">${k.mata_kuliah_kode}</div>
        </td>
        <td class="px-4 py-3 text-center text-sm font-medium text-slate-700">${k.sks}</td>
        <td class="px-4 py-3 text-sm text-slate-600">${k.semester_akademik}</td>
        <td class="px-4 py-3 text-sm text-slate-600">${k.dosen_wali_nama || '—'}</td>
        <td class="px-4 py-3">${statusBadge(k.status)}</td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-1">
            ${k.status === 'pending' ? `
              <button onclick="KRSModule.setujui('${k.id}')" title="Setujui"
                class="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              </button>
              <button onclick="KRSModule.openTolak('${k.id}','${k.mahasiswa_nama}','${k.mata_kuliah_kode}')" title="Tolak"
                class="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>` : ''}
            ${k.status !== 'dibatalkan' && k.status !== 'ditolak' ? `
              <button onclick="KRSModule.batalkan('${k.id}')" title="Batalkan"
                class="p-1.5 rounded-lg hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
              </button>` : ''}
            ${k.alasan_tolak ? `
              <button onclick="KRSModule.showAlasan('${k.alasan_tolak}')" title="Lihat alasan penolakan"
                class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </button>` : ''}
          </div>
        </td>
      `)
    })
  }

  const renderPagination = () => {
    document.getElementById('krs-pagination').innerHTML =
      UI.renderPagination(state.meta, 'KRSModule.goPage')
  }

  // ── Ajukan KRS ───────────────────────────────────────────
  const openAjukan = async () => {
    await loadFormRefs()
    UI.openModal(`
      <div class="p-5 border-b border-slate-200">
        <h3 class="font-semibold text-slate-800">Ajukan KRS</h3>
        <p class="text-xs text-slate-500 mt-0.5">Validasi: kapasitas kelas, batas SKS, dan bentrok jadwal</p>
      </div>
      <form id="krs-form" class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Mahasiswa <span class="text-red-500">*</span></label>
          <select name="mahasiswa_id" required id="krs-mhs-select"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            onchange="KRSModule._onMhsChange(this.value)">
            <option value="">— Pilih mahasiswa —</option>
            ${state.mhsList.map(m => `<option value="${m.id}">${m.nim} — ${m.nama_lengkap}</option>`).join('')}
          </select>
        </div>
        <div id="krs-mhs-info" class="hidden p-3 bg-slate-50 rounded-lg text-sm space-y-1"></div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Kelas <span class="text-red-500">*</span></label>
          <select name="kelas_id" required
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
            <option value="">— Pilih kelas —</option>
            ${state.kelasList.map(k => `<option value="${k.id}">${k.mata_kuliah_kode} ${k.kode_kelas} — ${k.mata_kuliah_nama} (${k.hari} ${k.jam_mulai}–${k.jam_selesai}, ${k.ruang_nama})</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Semester Akademik <span class="text-red-500">*</span></label>
          <select name="semester_akademik" required
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
            ${state.semesters.map(s => `<option value="${s}" ${state.semester_akademik===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Batal</button>
          <button type="submit" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg">Ajukan KRS</button>
        </div>
      </form>
    `)

    document.getElementById('krs-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const body = Object.fromEntries(fd.entries())
      const btn = e.target.querySelector('button[type=submit]')
      btn.disabled = true; btn.textContent = 'Mengajukan…'
      try {
        await API.post('/krs', body)
        UI.toast('KRS berhasil diajukan')
        UI.closeModal()
        state.mhsList = []; state.kelasList = []  // reset cache
        await Promise.all([fetchStats(), fetchList()])
      } catch (err) {
        UI.toast(err.message || 'Gagal mengajukan', 'error')
        btn.disabled = false; btn.textContent = 'Ajukan KRS'
      }
    })
  }

  const _onMhsChange = async (id) => {
    const infoEl = document.getElementById('krs-mhs-info')
    if (!id) { infoEl.classList.add('hidden'); return }
    const mhs = state.mhsList.find(m => m.id === id)
    if (!mhs) return
    const ipk = Number(mhs.ipk || 0).toFixed(2)
    const limit = ipk >= 3.0 ? 24 : ipk >= 2.5 ? 21 : 18
    infoEl.classList.remove('hidden')
    infoEl.innerHTML = `
      <div class="flex items-center gap-4 flex-wrap">
        <span class="text-slate-600">IPK: <strong class="text-slate-800">${ipk}</strong></span>
        <span class="text-slate-600">Prodi: <strong class="text-slate-800">${mhs.program_studi?.nama || '—'}</strong></span>
        <span class="text-slate-600">Batas SKS: <strong class="text-primary-600">${limit} SKS</strong></span>
        <span class="text-slate-600">Semester: <strong class="text-slate-800">${mhs.semester_aktif}</strong></span>
      </div>`
  }

  // ── Aksi: setujui ────────────────────────────────────────
  const setujui = async (id) => {
    try {
      await API.post(`/krs/${id}/setujui`)
      UI.toast('KRS disetujui')
      await Promise.all([fetchStats(), fetchList()])
    } catch (e) { UI.toast(e.message, 'error') }
  }

  // ── Aksi: tolak (dengan alasan) ──────────────────────────
  const openTolak = (id, nama, mk) => {
    UI.openModal(`
      <div class="p-5 border-b border-slate-200">
        <h3 class="font-semibold text-slate-800">Tolak KRS</h3>
        <p class="text-sm text-slate-500 mt-0.5">${nama} — ${mk}</p>
      </div>
      <form id="tolak-form" class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Alasan penolakan (opsional)</label>
          <textarea name="alasan" rows="3" placeholder="Tuliskan alasan penolakan…"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"></textarea>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Batal</button>
          <button type="submit" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg">Ya, Tolak</button>
        </div>
      </form>
    `)
    document.getElementById('tolak-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const alasan = new FormData(e.target).get('alasan')
      const btn = e.target.querySelector('button[type=submit]')
      btn.disabled = true; btn.textContent = 'Menolak…'
      try {
        await API.post(`/krs/${id}/tolak`, { alasan })
        UI.toast('KRS ditolak')
        UI.closeModal()
        await Promise.all([fetchStats(), fetchList()])
      } catch (err) {
        UI.toast(err.message, 'error')
        btn.disabled = false; btn.textContent = 'Ya, Tolak'
      }
    })
  }

  // ── Aksi: batalkan ───────────────────────────────────────
  const batalkan = async (id) => {
    try {
      await API.post(`/krs/${id}/batalkan`)
      UI.toast('KRS dibatalkan', 'info')
      await Promise.all([fetchStats(), fetchList()])
    } catch (e) { UI.toast(e.message, 'error') }
  }

  // ── Show alasan tolak ────────────────────────────────────
  const showAlasan = (alasan) => {
    UI.openModal(`
      <div class="p-5">
        <h3 class="font-semibold text-slate-800 mb-2">Alasan Penolakan</h3>
        <p class="text-sm text-slate-600 bg-red-50 border border-red-100 rounded-lg p-3">${alasan}</p>
        <div class="flex justify-end mt-4">
          <button onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Tutup</button>
        </div>
      </div>
    `)
  }

  // ── Event handlers ────────────────────────────────────────
  let searchTimer = null
  const onSearch = (val) => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => { state.search = val; state.page = 1; fetchList() }, 400)
  }
  const onFilter = (key, val) => {
    state[key] = val; state.page = 1
    if (key === 'semester_akademik') {
      state.kelasList = []  // reset so form reloads for new semester
      fetchStats()
    }
    fetchList()
  }
  const goPage = (p) => { state.page = p; fetchList() }

  return { render, onSearch, onFilter, goPage, openAjukan, setujui, openTolak, batalkan, showAlasan, _onMhsChange }
})()
