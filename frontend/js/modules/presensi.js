// ============================================================
// PRESENSI.JS — Kehadiran mahasiswa (Sesi, Presensi, Rekap)
// ============================================================
const PresensiModule = (() => {

  let state = {
    tab: 'sesi',
    // sesi
    kelasList: [],
    sesiList: [], sesiMeta: null, sesiPage: 1, sesiKelasId: '',
    activeSesi: null,
    // presensi
    prsList: [], prsMeta: null, prsPage: 1,
    prsSearch: '', prsStatus: '', prsKelasId: '', prsSesiId: '',
    // rekap
    rekapData: [], rekapKelasId: '',
    // stats
    rekap: null,
  }

  let _qrTimer = null

  // ── FETCH ──────────────────────────────────────────────────
  const fetchKelas = async () => {
    if (state.kelasList.length) return
    const res = await API.get('/presensi/kelas')
    state.kelasList = res.data || []
  }

  const fetchRekap = async () => {
    const res = await API.get('/presensi/rekap')
    state.rekap = res.data
    renderStats()
  }

  const fetchSesi = async () => {
    const res = await API.get('/presensi/sesi', {
      page: state.sesiPage, per_page: 15,
      kelas_id: state.sesiKelasId,
    })
    state.sesiList = res.data || []
    state.sesiMeta = res.meta
    renderSesiTable()
  }

  const fetchPrs = async () => {
    const res = await API.get('/presensi', {
      page: state.prsPage, per_page: 20,
      search: state.prsSearch, status: state.prsStatus,
      kelas_id: state.prsKelasId, sesi_id: state.prsSesiId,
    })
    state.prsList = res.data || []
    state.prsMeta = res.meta
    renderPrsTable()
  }

  const fetchRekapKelas = async () => {
    if (!state.rekapKelasId) { state.rekapData = []; renderRekapTable(); return }
    const res = await API.get('/presensi/rekap-kelas', { kelas_id: state.rekapKelasId })
    state.rekapData = res.data || []
    renderRekapTable()
  }

  // ── MAIN RENDER ────────────────────────────────────────────
  const render = async () => {
    Router.setPageMeta('Presensi', 'Kehadiran dan sesi perkuliahan')
    await fetchKelas()

    document.getElementById('page-content').innerHTML = `
      <!-- Stats -->
      <div id="prs-stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5"></div>

      <!-- Tabs -->
      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-5">
        <button id="tab-sesi"    onclick="PresensiModule.switchTab('sesi')"
          class="tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-all">Sesi Kuliah</button>
        <button id="tab-presensi" onclick="PresensiModule.switchTab('presensi')"
          class="tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-all">Presensi</button>
        <button id="tab-rekap"   onclick="PresensiModule.switchTab('rekap')"
          class="tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-all">Rekap Kehadiran</button>
      </div>

      <!-- Tab content areas -->
      <div id="tab-content-sesi"></div>
      <div id="tab-content-presensi" class="hidden"></div>
      <div id="tab-content-rekap"    class="hidden"></div>

      <!-- Modal: Buat Sesi -->
      <div id="sesi-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" onclick="PresensiModule.closeSesiModal()"></div>
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div class="px-6 py-4 border-b flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-800">Buat Sesi Kuliah</h3>
            <button onclick="PresensiModule.closeSesiModal()" class="text-slate-400 hover:text-slate-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <form id="sesi-form" onsubmit="PresensiModule.submitSesi(event)" class="px-6 py-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Kelas</label>
              <select name="kelas_id" required
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                <option value="">— Pilih Kelas —</option>
                ${state.kelasList.map(k =>
                  `<option value="${k.id}">${k.mata_kuliah_nama} — ${k.kode_kelas}</option>`
                ).join('')}
              </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Tanggal</label>
                <input type="date" name="tanggal" required
                  value="${new Date().toISOString().slice(0,10)}"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Pertemuan Ke-</label>
                <input type="number" name="pertemuan_ke" min="1" max="20" value="1" required
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Topik / Materi</label>
              <input type="text" name="topik" placeholder="Cth: Pengenalan OOP"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            </div>
            <div class="flex gap-3 pt-2">
              <button type="button" onclick="PresensiModule.closeSesiModal()"
                class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button>
              <button type="submit"
                class="flex-1 btn-primary px-4 py-2 rounded-lg text-sm font-medium">Buat Sesi</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal: QR Display -->
      <div id="qr-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/80" onclick="PresensiModule.closeQRModal()"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm text-center">
          <div class="px-6 pt-6 pb-4 border-b">
            <div id="qr-sesi-title" class="text-base font-bold text-slate-800"></div>
            <div id="qr-sesi-sub"   class="text-sm text-slate-500 mt-0.5"></div>
          </div>
          <div class="px-8 py-6">
            <div class="bg-slate-50 rounded-2xl p-6 mb-4">
              <div class="text-xs text-slate-400 mb-2 uppercase tracking-wider">Token Presensi</div>
              <div id="qr-token-display" class="font-mono text-4xl font-bold tracking-widest text-primary-600 select-all"></div>
            </div>
            <div id="qr-countdown" class="flex items-center justify-center gap-2 mb-4">
              <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span class="text-sm font-medium text-slate-600"></span>
            </div>
            <div class="flex gap-2">
              <button onclick="PresensiModule.perpanjangQR()"
                class="flex-1 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                Perpanjang +15 min
              </button>
              <button onclick="PresensiModule.selesaiSesi()"
                class="flex-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                Akhiri Sesi
              </button>
            </div>
            <button onclick="PresensiModule.openScan()"
              class="w-full mt-2 px-3 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg text-sm font-medium">
              Input Presensi Manual
            </button>
          </div>
        </div>
      </div>

      <!-- Modal: Input Presensi Manual -->
      <div id="prs-manual-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" onclick="PresensiModule.closeManualModal()"></div>
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div class="px-6 py-4 border-b flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-800">Input Presensi Manual</h3>
            <button onclick="PresensiModule.closeManualModal()" class="text-slate-400 hover:text-slate-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <form id="prs-manual-form" onsubmit="PresensiModule.submitManual(event)" class="px-6 py-4 space-y-4">
            <div id="prs-manual-sesi-info" class="p-3 bg-slate-50 rounded-lg text-sm text-slate-600"></div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Mahasiswa</label>
              <select id="prs-manual-mhs" name="mahasiswa_id" required
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                <option value="">— Pilih Mahasiswa —</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select name="status" required
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                <option value="hadir">Hadir</option>
                <option value="izin">Izin</option>
                <option value="sakit">Sakit</option>
                <option value="alpha">Alpha</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Keterangan</label>
              <input type="text" name="keterangan" placeholder="Opsional"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            </div>
            <div class="flex gap-3 pt-2">
              <button type="button" onclick="PresensiModule.closeManualModal()"
                class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button>
              <button type="submit"
                class="flex-1 btn-primary px-4 py-2 rounded-lg text-sm font-medium">Simpan</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal: Edit Presensi -->
      <div id="prs-edit-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" onclick="PresensiModule.closeEditModal()"></div>
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-sm">
          <div class="px-6 py-4 border-b">
            <h3 class="text-lg font-semibold text-slate-800">Edit Status Presensi</h3>
          </div>
          <form id="prs-edit-form" onsubmit="PresensiModule.submitEdit(event)" class="px-6 py-4 space-y-4">
            <div id="prs-edit-info" class="p-3 bg-slate-50 rounded-lg text-sm text-slate-600"></div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select id="prs-edit-status" name="status" required
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                <option value="hadir">Hadir</option>
                <option value="izin">Izin</option>
                <option value="sakit">Sakit</option>
                <option value="alpha">Alpha</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Keterangan</label>
              <input id="prs-edit-ket" type="text" name="keterangan" placeholder="Opsional"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            </div>
            <div class="flex gap-3 pt-2">
              <button type="button" onclick="PresensiModule.closeEditModal()"
                class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button>
              <button type="submit"
                class="flex-1 btn-primary px-4 py-2 rounded-lg text-sm font-medium">Simpan</button>
            </div>
          </form>
        </div>
      </div>
    `

    switchTab(state.tab)
    await fetchRekap()
  }

  // ── TAB SWITCH ─────────────────────────────────────────────
  const switchTab = (tab) => {
    state.tab = tab
    ;['sesi', 'presensi', 'rekap'].forEach(t => {
      const btn = document.getElementById(`tab-${t}`)
      const content = document.getElementById(`tab-content-${t}`)
      if (!btn || !content) return
      const active = t === tab
      btn.className = `tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-all ${active ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`
      content.classList.toggle('hidden', !active)
    })

    if (tab === 'sesi')     renderSesiView()
    if (tab === 'presensi') renderPresensiView()
    if (tab === 'rekap')    renderRekapView()
  }

  // ── STATS CARDS ────────────────────────────────────────────
  const renderStats = () => {
    const r = state.rekap || {}
    const d = r.distribusi_status || {}
    document.getElementById('prs-stats').innerHTML = [
      { label: 'Total Presensi',  val: r.total || 0,                   color: 'text-slate-700',  bg: 'bg-slate-50' },
      { label: 'Hadir',           val: d.hadir || 0,                   color: 'text-green-600',  bg: 'bg-green-50' },
      { label: 'Izin / Sakit',    val: (d.izin||0) + (d.sakit||0),    color: 'text-amber-600',  bg: 'bg-amber-50' },
      { label: 'Alpha',           val: d.alpha || 0,                   color: 'text-red-600',    bg: 'bg-red-50'   },
    ].map(c => `
      <div class="${c.bg} rounded-xl p-4 flex flex-col gap-1">
        <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">${c.label}</span>
        <span class="text-2xl font-bold ${c.color}">${c.val}</span>
      </div>`).join('')
  }

  // ── SESI TAB ───────────────────────────────────────────────
  const renderSesiView = () => {
    document.getElementById('tab-content-sesi').innerHTML = `
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <select onchange="PresensiModule.onSesiFilter(this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Kelas</option>
          ${state.kelasList.map(k =>
            `<option value="${k.id}" ${state.sesiKelasId===k.id?'selected':''}>${k.mata_kuliah_nama} — ${k.kode_kelas}</option>`
          ).join('')}
        </select>
        <button onclick="PresensiModule.openSesiModal()"
          class="btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Buat Sesi
        </button>
        <button onclick="PresensiModule.cetakBA()"
          class="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50 text-slate-700">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          Cetak BA Perkuliahan
        </button>
      </div>
      ${UI.card(`<div id="sesi-table-wrap"></div><div id="sesi-pagination"></div>`)}
    `
    fetchSesi()
  }

  const renderSesiTable = () => {
    const el = document.getElementById('sesi-table-wrap')
    if (!el) return
    el.innerHTML = UI.renderTable({
      headers: ['Kelas / MK', 'Pertemuan', 'Tanggal', 'Topik', 'Status', 'Aksi'],
      emptyText: 'Belum ada sesi kuliah',
      rows: state.sesiList.map(s => {
        const statusMap = {
          aktif: 'bg-green-100 text-green-700',
          selesai: 'bg-slate-100 text-slate-500',
          belum_mulai: 'bg-amber-100 text-amber-700',
        }
        const cls = statusMap[s.status] || 'bg-slate-100 text-slate-500'
        const qrActive = s.qr_active
        const mulaiBtn = (s.status === 'belum_mulai' || s.status === 'aktif') ? `
          <button onclick="PresensiModule.mulaiSesi('${s.id}')"
            title="${qrActive ? 'Tampilkan QR' : 'Mulai / Aktifkan QR'}"
            class="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 4v1m6.364 1.636l-.707.707M20 12h-1M17.657 17.657l-.707-.707M12 20v-1m-5.657-1.636l.707-.707M4 12H3M6.343 6.343l.707.707M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </button>` : ''
        const selesaiBtn = s.status === 'aktif' ? `
          <button onclick="PresensiModule.selesaiSesiById('${s.id}')"
            title="Selesaikan sesi"
            class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10h6v4H9z"/>
            </svg>
          </button>` : ''
        const manualBtn = `
          <button onclick="PresensiModule.openManualForSesi('${s.id}', '${(s.mata_kuliah_nama||'').replace(/'/g,"\\'")}', '${s.tanggal}')"
            title="Input presensi manual"
            class="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>`
        return `
          <td class="px-4 py-3">
            <div class="text-sm font-medium text-slate-800">${s.mata_kuliah_nama || (s.kelas?.mata_kuliah_nama||'—')}</div>
            <div class="text-xs text-slate-400">${s.kelas_kode || ''}</div>
          </td>
          <td class="px-4 py-3 text-sm text-center font-semibold text-slate-700">Ke-${s.pertemuan_ke}</td>
          <td class="px-4 py-3 text-sm text-slate-600">${s.tanggal}</td>
          <td class="px-4 py-3 text-sm text-slate-600">${s.topik || '—'}</td>
          <td class="px-4 py-3 text-center">
            <span class="badge ${cls} flex items-center gap-1.5 w-fit mx-auto">
              ${qrActive ? '<span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>' : ''}
              ${s.status.replace('_', ' ')}
            </span>
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-center gap-1">${mulaiBtn}${selesaiBtn}${manualBtn}</div>
          </td>`
      })
    })
    document.getElementById('sesi-pagination').innerHTML =
      UI.renderPagination(state.sesiMeta, 'PresensiModule.goSesiPage')
  }

  // ── SESI ACTIONS ───────────────────────────────────────────
  const openSesiModal = () => {
    document.getElementById('sesi-form').reset()
    document.getElementById('sesi-modal').classList.remove('hidden')
  }
  const closeSesiModal = () => document.getElementById('sesi-modal').classList.add('hidden')

  const submitSesi = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const btn = e.target.querySelector('[type="submit"]')
    btn.disabled = true
    try {
      await API.post('/presensi/sesi', {
        kelas_id:     fd.get('kelas_id'),
        tanggal:      fd.get('tanggal'),
        pertemuan_ke: parseInt(fd.get('pertemuan_ke')),
        topik:        fd.get('topik'),
      })
      UI.toast('Sesi berhasil dibuat', 'success')
      closeSesiModal()
      fetchSesi()
      fetchRekap()
    } catch(err) {
      UI.toast(err.message || 'Gagal membuat sesi', 'error')
    } finally { btn.disabled = false }
  }

  let _activeSesiId = null

  const mulaiSesi = async (sesiId) => {
    try {
      const res = await API.post(`/presensi/sesi/${sesiId}/mulai`)
      _activeSesiId = sesiId
      state.activeSesi = res.data
      showQRModal(res.data)
      fetchSesi()
    } catch(err) {
      // Maybe already active — just show the existing QR
      const existing = state.sesiList.find(s => s.id === sesiId)
      if (existing && existing.status === 'aktif') {
        _activeSesiId = sesiId
        state.activeSesi = existing
        showQRModal(existing)
      } else {
        UI.toast(err.message || 'Gagal memulai sesi', 'error')
      }
    }
  }

  const showQRModal = (sesi) => {
    document.getElementById('qr-sesi-title').textContent =
      `${sesi.mata_kuliah_nama || sesi.kelas?.mata_kuliah_nama || ''} — Pertemuan ${sesi.pertemuan_ke}`
    document.getElementById('qr-sesi-sub').textContent = sesi.tanggal + (sesi.topik ? ` • ${sesi.topik}` : '')
    document.getElementById('qr-token-display').textContent = sesi.qr_token || '—'
    document.getElementById('qr-modal').classList.remove('hidden')
    startCountdown(sesi.qr_expires_at)
  }

  const closeQRModal = () => {
    clearInterval(_qrTimer)
    document.getElementById('qr-modal').classList.add('hidden')
  }

  const startCountdown = (expiresAt) => {
    clearInterval(_qrTimer)
    const cdEl = document.getElementById('qr-countdown')
    const update = () => {
      if (!expiresAt) { cdEl.innerHTML = '<span class="text-sm text-slate-400">Tidak ada batas waktu</span>'; return }
      const now = Date.now()
      const exp = new Date(expiresAt).getTime()
      const diff = Math.max(0, Math.floor((exp - now) / 1000))
      const m = Math.floor(diff / 60)
      const s = diff % 60
      const color = diff < 60 ? 'text-red-600' : diff < 180 ? 'text-amber-600' : 'text-green-600'
      const dotColor = diff < 60 ? 'bg-red-400' : diff < 180 ? 'bg-amber-400' : 'bg-green-400'
      cdEl.innerHTML = `
        <div class="w-2 h-2 rounded-full ${dotColor} ${diff > 0 ? 'animate-pulse' : ''}"></div>
        <span class="text-sm font-medium ${color}">
          ${diff > 0 ? `Kadaluarsa dalam ${m}:${String(s).padStart(2,'0')}` : 'QR sudah kadaluarsa'}
        </span>`
      if (diff <= 0) clearInterval(_qrTimer)
    }
    update()
    _qrTimer = setInterval(update, 1000)
  }

  const perpanjangQR = async () => {
    if (!_activeSesiId) return
    try {
      const res = await API.post(`/presensi/sesi/${_activeSesiId}/perpanjang`)
      state.activeSesi = res.data
      document.getElementById('qr-token-display').textContent = res.data.qr_token
      startCountdown(res.data.qr_expires_at)
      UI.toast('QR diperpanjang 15 menit', 'success')
      fetchSesi()
    } catch(err) { UI.toast(err.message || 'Gagal perpanjang QR', 'error') }
  }

  const selesaiSesi = async () => {
    if (!_activeSesiId) return
    await selesaiSesiById(_activeSesiId)
    closeQRModal()
  }

  const selesaiSesiById = async (id) => {
    if (!confirm('Akhiri sesi? Mahasiswa yang belum presensi akan ditandai Alpha otomatis.')) return
    try {
      await API.post(`/presensi/sesi/${id}/selesai`)
      UI.toast('Sesi selesai', 'success')
      fetchSesi()
      fetchRekap()
    } catch(err) { UI.toast(err.message || 'Gagal mengakhiri sesi', 'error') }
  }

  const onSesiFilter = (kelasId) => {
    state.sesiKelasId = kelasId
    state.sesiPage = 1
    fetchSesi()
  }
  const goSesiPage = (p) => { state.sesiPage = p; fetchSesi() }

  // ── PRESENSI TAB ───────────────────────────────────────────
  const renderPresensiView = () => {
    document.getElementById('tab-content-presensi').innerHTML = `
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div class="flex-1 min-w-48">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" placeholder="Cari nama atau NIM mahasiswa..."
              value="${state.prsSearch}"
              class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              oninput="PresensiModule.onPrsSearch(this.value)"/>
          </div>
        </div>
        <select onchange="PresensiModule.onPrsFilter('prsKelasId', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Kelas</option>
          ${state.kelasList.map(k =>
            `<option value="${k.id}" ${state.prsKelasId===k.id?'selected':''}>${k.mata_kuliah_nama} — ${k.kode_kelas}</option>`
          ).join('')}
        </select>
        <select onchange="PresensiModule.onPrsFilter('prsStatus', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Status</option>
          <option value="hadir"  ${state.prsStatus==='hadir'?'selected':''}>Hadir</option>
          <option value="izin"   ${state.prsStatus==='izin'?'selected':''}>Izin</option>
          <option value="sakit"  ${state.prsStatus==='sakit'?'selected':''}>Sakit</option>
          <option value="alpha"  ${state.prsStatus==='alpha'?'selected':''}>Alpha</option>
        </select>
      </div>
      ${UI.card(`<div id="prs-table-wrap"></div><div id="prs-pagination"></div>`)}
    `
    fetchPrs()
  }

  const statusBadge = (s) => {
    const map = {
      hadir: 'bg-green-100 text-green-700',
      izin:  'bg-blue-100 text-blue-700',
      sakit: 'bg-yellow-100 text-yellow-700',
      alpha: 'bg-red-100 text-red-700',
    }
    return `<span class="badge ${map[s] || 'bg-slate-100 text-slate-600'}">${s}</span>`
  }

  const renderPrsTable = () => {
    const el = document.getElementById('prs-table-wrap')
    if (!el) return
    el.innerHTML = UI.renderTable({
      headers: ['Mahasiswa', 'Kelas', 'Status', 'Waktu Scan', 'Keterangan', 'Aksi'],
      emptyText: 'Tidak ada data presensi',
      rows: state.prsList.map(p => `
        <td class="px-4 py-3">
          <div class="font-medium text-slate-800 text-sm">${p.mahasiswa_nama}</div>
          <div class="text-xs text-slate-400 font-mono">${p.mahasiswa_nim}</div>
        </td>
        <td class="px-4 py-3 text-xs text-slate-500 font-mono">${p.kelas_id?.slice(0,8)}…</td>
        <td class="px-4 py-3">${statusBadge(p.status)}</td>
        <td class="px-4 py-3 text-sm text-slate-600">
          ${p.waktu_scan ? new Date(p.waktu_scan).toLocaleString('id-ID', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}
        </td>
        <td class="px-4 py-3 text-sm text-slate-500">${p.keterangan || '—'}</td>
        <td class="px-4 py-3">
          <button onclick="PresensiModule.openEdit('${p.id}', '${p.mahasiswa_nama.replace(/'/g,"\\'")}', '${p.status}', '${(p.keterangan||'').replace(/'/g,"\\'")}')"
            class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
        </td>`)
    })
    document.getElementById('prs-pagination').innerHTML =
      UI.renderPagination(state.prsMeta, 'PresensiModule.goPage')
  }

  let _editId = null
  const openEdit = (id, nama, status, ket) => {
    _editId = id
    document.getElementById('prs-edit-info').textContent = nama
    document.getElementById('prs-edit-status').value = status
    document.getElementById('prs-edit-ket').value = ket
    document.getElementById('prs-edit-modal').classList.remove('hidden')
  }
  const closeEditModal = () => { document.getElementById('prs-edit-modal').classList.add('hidden'); _editId = null }
  const submitEdit = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    try {
      await API.put(`/presensi/${_editId}`, { status: fd.get('status'), keterangan: fd.get('keterangan') })
      UI.toast('Presensi diperbarui', 'success')
      closeEditModal()
      fetchPrs()
      fetchRekap()
    } catch(err) { UI.toast(err.message || 'Gagal memperbarui', 'error') }
  }

  let _manualSesiId = null
  const openScan = () => openManualForSesi(_activeSesiId, state.activeSesi?.mata_kuliah_nama || '', state.activeSesi?.tanggal || '')
  const openManualForSesi = async (sesiId, mk, tanggal) => {
    _manualSesiId = sesiId
    document.getElementById('prs-manual-sesi-info').innerHTML =
      `<b>${mk}</b>${tanggal ? ` — ${tanggal}` : ''}`
    // Load mahasiswa enrolled in this session's kelas
    const sesi = state.sesiList.find(s => s.id === sesiId) || {}
    const kelasId = sesi.kelas_id || ''
    try {
      const res = await API.get('/krs', { kelas_id: kelasId, status: 'disetujui', per_page: 200 })
      const sel = document.getElementById('prs-manual-mhs')
      sel.innerHTML = `<option value="">— Pilih Mahasiswa —</option>` +
        (res.data || []).map(k =>
          `<option value="${k.mahasiswa_id}">${k.mahasiswa_nama} (${k.mahasiswa_nim})</option>`
        ).join('')
    } catch(e) { /* fallback empty */ }
    document.getElementById('prs-manual-modal').classList.remove('hidden')
  }
  const closeManualModal = () => { document.getElementById('prs-manual-modal').classList.add('hidden'); _manualSesiId = null }
  const submitManual = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const btn = e.target.querySelector('[type="submit"]')
    btn.disabled = true
    try {
      await API.post('/presensi/manual', {
        sesi_id:      _manualSesiId,
        mahasiswa_id: fd.get('mahasiswa_id'),
        status:       fd.get('status'),
        keterangan:   fd.get('keterangan'),
      })
      UI.toast('Presensi berhasil diinput', 'success')
      closeManualModal()
      fetchPrs()
      fetchRekap()
    } catch(err) { UI.toast(err.message || 'Gagal input presensi', 'error') }
    finally { btn.disabled = false }
  }

  let prsSearchTimer = null
  const onPrsSearch = (val) => {
    clearTimeout(prsSearchTimer)
    prsSearchTimer = setTimeout(() => { state.prsSearch = val; state.prsPage = 1; fetchPrs() }, 400)
  }
  const onPrsFilter = (key, val) => { state[key] = val; state.prsPage = 1; fetchPrs() }
  const goPage = (p) => { state.prsPage = p; fetchPrs() }

  // ── REKAP TAB ──────────────────────────────────────────────
  const renderRekapView = () => {
    document.getElementById('tab-content-rekap').innerHTML = `
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <select onchange="PresensiModule.onRekapFilter(this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">— Pilih Kelas —</option>
          ${state.kelasList.map(k =>
            `<option value="${k.id}" ${state.rekapKelasId===k.id?'selected':''}>${k.mata_kuliah_nama} — ${k.kode_kelas}</option>`
          ).join('')}
        </select>
        <button onclick="PresensiModule.cetakAbsensi()"
          class="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50 text-slate-700">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          Cetak Daftar Hadir
        </button>
      </div>
      ${UI.card(`<div id="rekap-table-wrap"></div>`)}
    `
    if (state.rekapKelasId) fetchRekapKelas()
    else renderRekapTable()
  }

  const renderRekapTable = () => {
    const el = document.getElementById('rekap-table-wrap')
    if (!el) return
    if (!state.rekapKelasId) {
      el.innerHTML = `<p class="text-sm text-slate-400 text-center py-8">Pilih kelas untuk melihat rekap kehadiran</p>`
      return
    }
    if (state.rekapData.length === 0) {
      el.innerHTML = `<p class="text-sm text-slate-400 text-center py-8">Belum ada data presensi untuk kelas ini</p>`
      return
    }
    el.innerHTML = UI.renderTable({
      headers: ['Mahasiswa', 'Total', 'Hadir', 'Izin', 'Sakit', 'Alpha', '% Kehadiran', 'Status'],
      emptyText: 'Tidak ada data',
      rows: state.rekapData.map(m => {
        const pct = m.persen_hadir
        const warn = m.status_kehadiran === 'warning'
        const barColor = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
        return `
          <td class="px-4 py-3">
            <div class="text-sm font-medium text-slate-800">${m.mahasiswa_nama}</div>
            <div class="text-xs text-slate-400 font-mono">${m.mahasiswa_nim}</div>
          </td>
          <td class="px-4 py-3 text-sm text-center text-slate-600">${m.total}</td>
          <td class="px-4 py-3 text-sm text-center text-green-600 font-medium">${m.hadir || 0}</td>
          <td class="px-4 py-3 text-sm text-center text-blue-500">${m.izin || 0}</td>
          <td class="px-4 py-3 text-sm text-center text-amber-500">${m.sakit || 0}</td>
          <td class="px-4 py-3 text-sm text-center text-red-500 font-medium">${m.alpha || 0}</td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              <div class="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div class="${barColor} h-2 rounded-full transition-all" style="width:${Math.min(pct,100)}%"></div>
              </div>
              <span class="text-sm font-semibold ${warn ? 'text-red-600' : 'text-slate-700'} w-12 text-right">${pct}%</span>
            </div>
          </td>
          <td class="px-4 py-3 text-center">
            ${warn
              ? `<span class="badge bg-red-100 text-red-700 flex items-center gap-1 w-fit mx-auto">
                   <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                   </svg>
                   < 75%
                 </span>`
              : `<span class="badge bg-green-100 text-green-700">Aman</span>`}
          </td>`
      })
    })
  }

  const onRekapFilter = (kelasId) => {
    state.rekapKelasId = kelasId
    state.rekapData = []
    renderRekapTable()
    if (kelasId) fetchRekapKelas()
  }

  // ── PRINT HELPERS ──────────────────────────────────────────
  const openPrint = (title, bodyHtml, landscape = false) => {
    const w = window.open('', '_blank', 'width=1000,height=720')
    if (!w) return UI.toast('Izinkan popup di browser untuk mencetak', 'warning')
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:11pt;color:#000;padding:15mm 20mm}
@media print{body{padding:0}@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:12mm 15mm}}
h1{font-size:14pt;text-align:center;text-transform:uppercase;margin-bottom:3px}
h2{font-size:11pt;text-align:center;font-weight:normal;margin-bottom:2px}
.sub{text-align:center;font-size:10pt;color:#444;margin-bottom:10px}
hr.thick{border:0;border-top:2px solid #000;margin:6px 0 10px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin-bottom:10px;font-size:10pt}
.info-grid span{display:block}b{font-weight:bold}
table{width:100%;border-collapse:collapse;margin-top:6px;font-size:9.5pt}
th{background:#ddd;border:1px solid #666;padding:4px 6px;text-align:left;font-weight:bold}
td{border:1px solid #999;padding:3px 6px}
tr:nth-child(even) td{background:#f5f5f5}
.c{text-align:center}.r{text-align:right}
.ok{color:#16a34a;font-weight:bold}.warn{color:#dc2626;font-weight:bold}
.footer{margin-top:32px;display:flex;justify-content:flex-end}
.ttd{text-align:center;min-width:200px}
.ttd .line{margin-top:60px;border-top:1px solid #000;padding-top:2px}
.small{font-size:9pt;color:#666}
</style></head><body>${bodyHtml}
<script>setTimeout(()=>window.print(),400)</script>
</body></html>`)
    w.document.close()
  }

  // Cetak Daftar Hadir (Rekap Absensi)
  const cetakAbsensi = () => {
    if (!state.rekapKelasId) return UI.toast('Pilih kelas terlebih dahulu', 'warning')
    if (!state.rekapData.length) return UI.toast('Data rekap kosong — muat data kelas dulu', 'warning')
    const kelas = state.kelasList.find(k => k.id === state.rekapKelasId) || {}
    const tgl = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    const rows = state.rekapData.map((m, i) => `
      <tr>
        <td class="c">${i+1}</td>
        <td class="c small">${m.mahasiswa_nim}</td>
        <td>${m.mahasiswa_nama}</td>
        <td class="c">${m.total}</td>
        <td class="c ok">${m.hadir||0}</td>
        <td class="c" style="color:#2563eb">${m.izin||0}</td>
        <td class="c" style="color:#d97706">${m.sakit||0}</td>
        <td class="c warn">${m.alpha||0}</td>
        <td class="c ${m.status_kehadiran==='warning'?'warn':'ok'}">${m.persen_hadir}%</td>
        <td class="c">${m.status_kehadiran==='warning'?'⚠ Kurang':'✓ Aman'}</td>
      </tr>`).join('')
    openPrint('Rekap Kehadiran', `
      <h2>REKAP KEHADIRAN MAHASISWA</h2>
      <h1>${kelas.mata_kuliah_nama||'—'}</h1>
      <div class="sub">Kelas ${kelas.kode_kelas||'—'} — ${kelas.semester_akademik||'—'}</div>
      <hr class="thick">
      <div class="info-grid">
        <span><b>Mata Kuliah</b>: ${kelas.mata_kuliah_nama||'—'}</span>
        <span><b>Kelas</b>: ${kelas.kode_kelas||'—'}</span>
        <span><b>Dosen Pengampu</b>: ${kelas.dosen_nama||'—'}</span>
        <span><b>Semester</b>: ${kelas.semester_akademik||'—'}</span>
        <span><b>Jumlah Mahasiswa</b>: ${state.rekapData.length} orang</span>
        <span><b>Tanggal Cetak</b>: ${tgl}</span>
      </div>
      <table>
        <thead><tr>
          <th class="c" style="width:30px">No</th>
          <th class="c" style="width:90px">NIM</th>
          <th>Nama Mahasiswa</th>
          <th class="c" style="width:45px">Total</th>
          <th class="c" style="width:45px">H</th>
          <th class="c" style="width:40px">I</th>
          <th class="c" style="width:40px">S</th>
          <th class="c" style="width:45px">A</th>
          <th class="c" style="width:55px">%</th>
          <th class="c" style="width:70px">Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="small" style="margin-top:8px">H=Hadir · I=Izin · S=Sakit · A=Alpha · Batas kehadiran minimal: 75%</div>
      <div class="footer"><div class="ttd">
        <div>Dosen Pengampu,</div>
        <div class="line">${kelas.dosen_nama||'—'}</div>
      </div></div>`)
  }

  // Cetak Berita Acara Perkuliahan
  const cetakBA = async () => {
    const kelasId = state.sesiKelasId
    if (!kelasId) return UI.toast('Pilih kelas di tab Sesi Kuliah terlebih dahulu', 'warning')
    try {
      const res = await API.get(`/presensi/sesi?kelas_id=${kelasId}&per_page=100`)
      const list = (res.data||[]).sort((a,b) => a.pertemuan_ke - b.pertemuan_ke)
      const kelas = state.kelasList.find(k => k.id === kelasId) || {}
      const total = kelas.jumlah_pertemuan || 16
      const tgl = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      const rows = Array.from({length: total}, (_, i) => {
        const s = list.find(x => x.pertemuan_ke === i+1)
        return s ? `
          <tr>
            <td class="c">${i+1}</td>
            <td class="c">${s.tanggal}</td>
            <td>${s.topik||'—'}</td>
            <td>${s.dibuat_oleh_nama||kelas.dosen_nama||'—'}</td>
            <td class="c">${{aktif:'Berlangsung',selesai:'Selesai',belum_mulai:'Belum Mulai'}[s.status]||s.status}</td>
            <td class="c"></td>
          </tr>` : `
          <tr>
            <td class="c">${i+1}</td>
            <td></td><td></td><td></td><td class="small c">Belum dilaksanakan</td>
            <td class="c"></td>
          </tr>`
      }).join('')
      openPrint('Berita Acara Perkuliahan', `
        <h2>BERITA ACARA PERKULIAHAN</h2>
        <h1>${kelas.mata_kuliah_nama||'—'}</h1>
        <div class="sub">Kelas ${kelas.kode_kelas||'—'} — ${kelas.semester_akademik||'—'}</div>
        <hr class="thick">
        <div class="info-grid">
          <span><b>Mata Kuliah</b>: ${kelas.mata_kuliah_nama||'—'} (${kelas.mata_kuliah_kode||'—'})</span>
          <span><b>Kelas</b>: ${kelas.kode_kelas||'—'}</span>
          <span><b>Dosen Pengampu</b>: ${kelas.dosen_nama||'—'}</span>
          <span><b>Semester</b>: ${kelas.semester_akademik||'—'}</span>
          <span><b>SKS</b>: ${kelas.sks||'—'}</span>
          <span><b>Realisasi</b>: ${list.length}/${total} pertemuan</span>
          <span><b>Tanggal Cetak</b>: ${tgl}</span>
        </div>
        <table>
          <thead><tr>
            <th class="c" style="width:50px">Pertemuan</th>
            <th style="width:90px">Tanggal</th>
            <th>Topik / Materi</th>
            <th style="width:130px">Dosen / Pengajar</th>
            <th style="width:90px">Status</th>
            <th style="width:80px">Paraf Mhs</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer" style="gap:40px">
          <div class="ttd">
            <div>Mengetahui,<br>Kaprodi</div>
            <div class="line">___________________________</div>
          </div>
          <div class="ttd">
            <div>Dosen Pengampu</div>
            <div class="line">${kelas.dosen_nama||'—'}</div>
          </div>
        </div>`)
    } catch(e) { UI.toast(e.message, 'error') }
  }

  return {
    render, switchTab,
    // sesi
    openSesiModal, closeSesiModal, submitSesi,
    mulaiSesi, selesaiSesi, selesaiSesiById, perpanjangQR,
    closeQRModal, openScan,
    onSesiFilter, goSesiPage,
    // manual
    openManualForSesi, closeManualModal, submitManual,
    // presensi
    openEdit, closeEditModal, submitEdit,
    onPrsSearch, onPrsFilter, goPage,
    // rekap
    onRekapFilter,
    // cetak
    cetakAbsensi, cetakBA,
  }
})()
