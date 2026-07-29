// ============================================================
// TA MODULE — Tugas Akhir: Pengajuan, Bimbingan, Sidang
// ============================================================
const TAModule = (() => {

  let currentTab = 'daftar'
  let taPage = 1; let sidangPage = 1
  let taFilter = {}; let sidangFilter = {}
  let editingTaId = null; let editingSidangId = null
  let selectedTaId = null  // for bimbingan tab
  let dosen_list = []

  // ── render ─────────────────────────────────────────────────
  const render = async () => {
    const main = document.getElementById('page-content')
    Router.setPageMeta('Tugas Akhir', 'Manajemen tugas akhir mahasiswa')
    main.innerHTML = `
      <div class="p-4 md:p-6 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Tugas Akhir</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">Kelola pengajuan, bimbingan, dan sidang TA</p>
          </div>
        </div>

        <!-- Stats -->
        <div id="ta-stats" class="grid grid-cols-2 md:grid-cols-4 gap-3"></div>

        <!-- Tabs -->
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="flex gap-1">
            ${['daftar','bimbingan','sidang'].map(t => `
              <button onclick="TAModule.switchTab('${t}')"
                id="ta-tab-${t}"
                class="tab-btn px-4 py-2 text-sm font-medium border-b-2 transition-colors
                  ${currentTab === t
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}">
                ${t === 'daftar' ? 'Daftar TA' : t === 'bimbingan' ? 'Bimbingan' : 'Sidang'}
              </button>`).join('')}
          </nav>
        </div>

        <div id="ta-panel-daftar"   class="${currentTab === 'daftar'    ? '' : 'hidden'}"></div>
        <div id="ta-panel-bimbingan" class="${currentTab === 'bimbingan' ? '' : 'hidden'}"></div>
        <div id="ta-panel-sidang"    class="${currentTab === 'sidang'    ? '' : 'hidden'}"></div>
      </div>

      ${modalAjukanTA()}
      ${modalStatusTA()}
      ${modalTolakTA()}
      ${modalBimbingan()}
      ${modalSidangJadwal()}
      ${modalSidangNilai()}
    `

    try {
      const r = await API.get('/dosen?per_page=200')
      dosen_list = r.data || []
    } catch (e) {}

    await loadStats()
    await renderActiveTab()
  }

  const switchTab = async (tab) => {
    currentTab = tab
    ;['daftar','bimbingan','sidang'].forEach(t => {
      const btn = document.getElementById(`ta-tab-${t}`)
      const panel = document.getElementById(`ta-panel-${t}`)
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
    if (currentTab === 'daftar')    await renderDaftar()
    else if (currentTab === 'bimbingan') await renderBimbingan()
    else await renderSidang()
  }

  // ── stats ──────────────────────────────────────────────────
  const loadStats = async () => {
    try {
      const res = await API.get('/ta/stats/ringkasan')
      const d = res.data || {}
      const el = document.getElementById('ta-stats')
      if (!el) return
      const pengajuan = (d.by_status?.pengajuan || 0)
      el.innerHTML = [
        { label: 'Total TA', val: d.total_ta, sub: 'Semua status', color: 'blue' },
        { label: 'Menunggu Approval', val: pengajuan, sub: 'Pengajuan baru', color: 'amber' },
        { label: 'Sidang Terjadwal', val: d.sidang_terjadwal, sub: `${d.sidang_selesai} selesai`, color: 'purple' },
        { label: 'Rata-rata Nilai', val: d.rata_nilai ?? '-', sub: 'Sidang TA', color: 'green' },
      ].map(s => `
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-2xl font-bold text-${s.color}-600 dark:text-${s.color}-400">${s.val}</div>
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300">${s.label}</div>
          <div class="text-xs text-gray-400 mt-1">${s.sub}</div>
        </div>`).join('')
    } catch (e) {}
  }

  // ── DAFTAR TA ──────────────────────────────────────────────
  const STATUS_LABELS = {
    pengajuan: { label: 'Pengajuan', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
    approved:  { label: 'Disetujui', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    seminar_proposal: { label: 'Seminar Proposal', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' },
    bimbingan: { label: 'Bimbingan', cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' },
    penulisan: { label: 'Penulisan', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300' },
    sidang:    { label: 'Sidang', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
    revisi:    { label: 'Revisi', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
    selesai:   { label: 'Selesai', cls: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  }

  const statusBadge = (s) => {
    const m = STATUS_LABELS[s] || { label: s, cls: 'bg-gray-100 text-gray-700' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}">${m.label}</span>`
  }

  const renderDaftar = async () => {
    const panel = document.getElementById('ta-panel-daftar')
    const params = new URLSearchParams({ page: taPage, per_page: 20, ...taFilter })
    let data = [], meta = {}
    try {
      const res = await API.get(`/ta?${params}`)
      data = res.data || []; meta = res.meta || {}
    } catch (e) {}

    panel.innerHTML = `
      <div class="flex flex-wrap gap-2 mb-4">
        <select id="ta-f-status" onchange="TAModule.filterDaftar()"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">Semua Status</option>
          ${Object.entries(STATUS_LABELS).map(([v, {label}]) => `<option value="${v}" ${taFilter.status===v?'selected':''}>${label}</option>`).join('')}
        </select>
        <input id="ta-f-search" type="text" placeholder="Cari judul / nama / NIM…"
          value="${taFilter.search || ''}"
          oninput="TAModule.filterDaftar()"
          class="flex-1 min-w-[200px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
        <button onclick="TAModule.openAjukanModal()"
          class="ml-auto px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + Ajukan TA
        </button>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 text-left">
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Mahasiswa</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Judul TA</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Pembimbing</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Nilai</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0
              ? `<tr><td colspan="6" class="text-center py-10 text-gray-400">Belum ada data TA</td></tr>`
              : data.map(t => `
              <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                <td class="px-4 py-3">
                  <div class="font-medium dark:text-white">${t.mahasiswa_nama}</div>
                  <div class="text-xs text-gray-400">${t.mahasiswa_nim}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium dark:text-white max-w-xs">${t.judul}</div>
                  <div class="text-xs text-gray-400">${t.bidang || '-'}</div>
                </td>
                <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                  <div>${t.pembimbing1_nama || '-'}</div>
                  ${t.pembimbing2_nama ? `<div class="text-gray-400">${t.pembimbing2_nama}</div>` : ''}
                </td>
                <td class="px-4 py-3">${statusBadge(t.status)}</td>
                <td class="px-4 py-3 font-medium dark:text-white">${t.nilai_sidang ?? '-'}</td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    ${t.status === 'pengajuan' ? `
                    <button onclick="TAModule.setujuiTA('${t.id}')"
                      class="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded">Setujui</button>
                    <button onclick="TAModule.openTolakModal('${t.id}')"
                      class="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded">Tolak</button>` : ''}
                    ${t.status !== 'pengajuan' && t.status !== 'selesai' ? `
                    <button onclick="TAModule.openStatusModal('${t.id}', '${t.status}')"
                      class="px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded">Status</button>` : ''}
                    <button onclick="TAModule.bukaTabBimbingan('${t.id}')"
                      class="px-2 py-1 text-xs bg-cyan-100 text-cyan-700 hover:bg-cyan-200 rounded">Bimbingan</button>
                    ${['penulisan','bimbingan','sidang'].includes(t.status) ? `
                    <button onclick="TAModule.openJadwalSidang('${t.id}')"
                      class="px-2 py-1 text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 rounded">Sidang</button>` : ''}
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(meta, 'TAModule.gotoTaPage')}
    `
  }

  const filterDaftar = () => {
    taFilter = {}
    const s = document.getElementById('ta-f-status')?.value
    const q = document.getElementById('ta-f-search')?.value.trim()
    if (s) taFilter.status = s
    if (q) taFilter.search = q
    taPage = 1; renderDaftar()
  }

  const gotoTaPage = (p) => { taPage = p; renderDaftar() }

  // ── AKSI TA ────────────────────────────────────────────────
  const setujuiTA = async (id) => {
    if (!confirm('Setujui pengajuan TA ini?')) return
    try {
      await API.post(`/ta/${id}/setujui`, {})
      await loadStats(); await renderDaftar()
      UI.toast('Pengajuan TA disetujui', 'success')
    } catch (e) { UI.toast(e.message || 'Gagal', 'error') }
  }

  // ── MODAL Ajukan TA ────────────────────────────────────────
  const modalAjukanTA = () => `
    <div id="modal-ajukan-ta" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h3 class="text-lg font-semibold dark:text-white">Ajukan Tugas Akhir</h3>
          <button onclick="document.getElementById('modal-ajukan-ta').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NIM Mahasiswa</label>
            <input id="ta-nim" type="text" placeholder="Ketik NIM lalu Enter"
              onblur="TAModule.lookupMhs()"
              class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
            <div id="ta-mhs-info" class="mt-1 text-xs text-green-600 dark:text-green-400 hidden"></div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Judul TA</label>
            <textarea id="ta-judul" rows="2" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" placeholder="Judul penelitian"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bidang</label>
            <input id="ta-bidang" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" placeholder="Kecerdasan Buatan, IoT, Sistem Informasi, dll">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pembimbing 1</label>
            <select id="ta-pb1" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
              <option value="">-- Pilih Dosen --</option>
              ${dosen_list.map(d => `<option value="${d.id}">${d.nama_lengkap}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pembimbing 2 (Opsional)</label>
            <select id="ta-pb2" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
              <option value="">-- Pilih Dosen --</option>
              ${dosen_list.map(d => `<option value="${d.id}">${d.nama_lengkap}</option>`).join('')}
            </select>
          </div>
          <div id="modal-ajukan-err" class="hidden text-sm text-red-600 dark:text-red-400"></div>
          <input id="ta-mhs-id" type="hidden">
        </div>
        <div class="flex justify-end gap-2 px-5 pb-5">
          <button onclick="document.getElementById('modal-ajukan-ta').classList.add('hidden')"
            class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Batal</button>
          <button id="btn-save-ta" onclick="TAModule.saveAjukanTA()"
            class="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium">Ajukan</button>
        </div>
      </div>
    </div>`

  const openAjukanModal = () => {
    document.getElementById('modal-ajukan-ta').classList.remove('hidden')
    document.getElementById('modal-ajukan-err').classList.add('hidden')
    document.getElementById('ta-nim').value = ''
    document.getElementById('ta-judul').value = ''
    document.getElementById('ta-bidang').value = ''
    document.getElementById('ta-pb1').value = ''
    document.getElementById('ta-pb2').value = ''
    document.getElementById('ta-mhs-id').value = ''
    document.getElementById('ta-mhs-info').classList.add('hidden')
  }

  const lookupMhs = async () => {
    const nim = document.getElementById('ta-nim').value.trim()
    if (!nim) return
    try {
      const res = await API.get(`/mahasiswa?search=${nim}&per_page=1`)
      const mhs = res.data?.[0]
      if (mhs && mhs.nim === nim) {
        document.getElementById('ta-mhs-id').value = mhs.id
        const infoEl = document.getElementById('ta-mhs-info')
        infoEl.textContent = `✓ ${mhs.nama_lengkap} – ${mhs.status}`
        infoEl.classList.remove('hidden')
      }
    } catch (e) {}
  }

  const saveAjukanTA = async () => {
    const btn = document.getElementById('btn-save-ta')
    const errEl = document.getElementById('modal-ajukan-err')
    btn.disabled = true; btn.textContent = 'Menyimpan...'
    errEl.classList.add('hidden')
    try {
      const mhsId = document.getElementById('ta-mhs-id').value
      if (!mhsId) throw new Error('Mahasiswa belum ditemukan. Masukkan NIM yang benar.')
      await API.post('/ta', {
        mahasiswa_id: mhsId,
        judul: document.getElementById('ta-judul').value.trim(),
        bidang: document.getElementById('ta-bidang').value.trim(),
        pembimbing1_id: document.getElementById('ta-pb1').value || null,
        pembimbing2_id: document.getElementById('ta-pb2').value || null,
      })
      document.getElementById('modal-ajukan-ta').classList.add('hidden')
      await loadStats(); await renderDaftar()
      UI.toast('TA berhasil diajukan', 'success')
    } catch (e) {
      errEl.textContent = e.message || 'Gagal mengajukan TA'
      errEl.classList.remove('hidden')
    } finally {
      btn.disabled = false; btn.textContent = 'Ajukan'
    }
  }

  // ── MODAL Update Status ────────────────────────────────────
  const modalStatusTA = () => `
    <div id="modal-status-ta" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
        <div class="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h3 class="text-lg font-semibold dark:text-white">Update Status TA</h3>
          <button onclick="document.getElementById('modal-status-ta').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status Baru</label>
            <select id="ta-new-status" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
              ${Object.entries(STATUS_LABELS).map(([v,{label}]) => `<option value="${v}">${label}</option>`).join('')}
            </select>
          </div>
          <div id="modal-status-err" class="hidden text-sm text-red-600 dark:text-red-400"></div>
        </div>
        <div class="flex justify-end gap-2 px-5 pb-5">
          <button onclick="document.getElementById('modal-status-ta').classList.add('hidden')"
            class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Batal</button>
          <button id="btn-save-status" onclick="TAModule.saveStatus()"
            class="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium">Simpan</button>
        </div>
      </div>
    </div>`

  const openStatusModal = (taId, currentStatus) => {
    editingTaId = taId
    document.getElementById('modal-status-ta').classList.remove('hidden')
    document.getElementById('ta-new-status').value = currentStatus
    document.getElementById('modal-status-err').classList.add('hidden')
  }

  const saveStatus = async () => {
    const btn = document.getElementById('btn-save-status')
    const errEl = document.getElementById('modal-status-err')
    btn.disabled = true; btn.textContent = 'Menyimpan...'
    errEl.classList.add('hidden')
    try {
      await API.post(`/ta/${editingTaId}/status`, {
        status: document.getElementById('ta-new-status').value
      })
      document.getElementById('modal-status-ta').classList.add('hidden')
      await loadStats(); await renderDaftar()
      UI.toast('Status TA diperbarui', 'success')
    } catch (e) {
      errEl.textContent = e.message || 'Gagal'
      errEl.classList.remove('hidden')
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan'
    }
  }

  // ── MODAL Tolak ────────────────────────────────────────────
  const modalTolakTA = () => `
    <div id="modal-tolak-ta" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
        <div class="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h3 class="text-lg font-semibold dark:text-white">Tolak Pengajuan TA</h3>
          <button onclick="document.getElementById('modal-tolak-ta').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alasan Penolakan</label>
            <textarea id="ta-alasan-tolak" rows="3" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" placeholder="Jelaskan alasan penolakan..."></textarea>
          </div>
          <div id="modal-tolak-err" class="hidden text-sm text-red-600 dark:text-red-400"></div>
        </div>
        <div class="flex justify-end gap-2 px-5 pb-5">
          <button onclick="document.getElementById('modal-tolak-ta').classList.add('hidden')"
            class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Batal</button>
          <button id="btn-tolak" onclick="TAModule.saveTolak()"
            class="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium">Tolak</button>
        </div>
      </div>
    </div>`

  const openTolakModal = (taId) => {
    editingTaId = taId
    document.getElementById('modal-tolak-ta').classList.remove('hidden')
    document.getElementById('ta-alasan-tolak').value = ''
    document.getElementById('modal-tolak-err').classList.add('hidden')
  }

  const saveTolak = async () => {
    const btn = document.getElementById('btn-tolak')
    const errEl = document.getElementById('modal-tolak-err')
    btn.disabled = true; btn.textContent = 'Menolak...'
    errEl.classList.add('hidden')
    try {
      await API.post(`/ta/${editingTaId}/tolak`, {
        alasan: document.getElementById('ta-alasan-tolak').value.trim()
      })
      document.getElementById('modal-tolak-ta').classList.add('hidden')
      await loadStats(); await renderDaftar()
      UI.toast('Pengajuan TA ditolak', 'success')
    } catch (e) {
      errEl.textContent = e.message || 'Gagal'
      errEl.classList.remove('hidden')
    } finally {
      btn.disabled = false; btn.textContent = 'Tolak'
    }
  }

  // ── BIMBINGAN tab ──────────────────────────────────────────
  const renderBimbingan = async () => {
    const panel = document.getElementById('ta-panel-bimbingan')
    // Load TA list untuk dropdown pilih mahasiswa
    let taData = []
    try {
      const res = await API.get('/ta?per_page=100')
      taData = res.data || []
    } catch (e) {}

    panel.innerHTML = `
      <div class="flex flex-wrap gap-3 mb-4 items-center">
        <select id="bimb-ta-select" onchange="TAModule.loadBimbingan()"
          class="flex-1 min-w-[200px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">-- Pilih Mahasiswa TA --</option>
          ${taData.map(t => `<option value="${t.id}" ${selectedTaId===t.id?'selected':''}>${t.mahasiswa_nim} · ${t.mahasiswa_nama} (${STATUS_LABELS[t.status]?.label || t.status})</option>`).join('')}
        </select>
        <button onclick="TAModule.openBimbinganModal()"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 ${selectedTaId ? '' : 'opacity-50 pointer-events-none'}">
          + Tambah Bimbingan
        </button>
      </div>
      <div id="bimb-list" class="space-y-3">
        ${selectedTaId ? '<div class="text-center py-4 text-gray-400">Memuat...</div>' : '<div class="text-center py-12 text-gray-400">Pilih mahasiswa TA untuk melihat log bimbingan</div>'}
      </div>
    `
    if (selectedTaId) await loadBimbingan()
  }

  const loadBimbingan = async () => {
    const sel = document.getElementById('bimb-ta-select')
    if (sel) selectedTaId = sel.value || selectedTaId
    if (!selectedTaId) return

    const container = document.getElementById('bimb-list')
    if (!container) return
    try {
      const res = await API.get(`/ta/${selectedTaId}/bimbingan`)
      const data = res.data || []
      if (data.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-gray-400">Belum ada log bimbingan</div>'
        return
      }
      container.innerHTML = data.map(b => `
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">${b.ke}</span>
                <span class="font-medium text-gray-900 dark:text-white">${b.topik}</span>
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 ml-9">
                ${new Date(b.tanggal).toLocaleDateString('id-ID', {weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                · ${b.dosen_nama}
              </div>
              ${b.catatan_dosen ? `
              <div class="mt-2 ml-9 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded p-2">
                <span class="font-medium">Catatan:</span> ${b.catatan_dosen}
              </div>` : ''}
            </div>
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${
              b.status === 'disetujui' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : b.status === 'menunggu' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
              : 'bg-gray-100 text-gray-700'}">${b.status}</span>
          </div>
        </div>`).join('')
    } catch (e) {
      container.innerHTML = '<div class="text-center py-8 text-red-400">Gagal memuat data bimbingan</div>'
    }
  }

  const bukaTabBimbingan = async (taId) => {
    selectedTaId = taId
    await switchTab('bimbingan')
  }

  // ── MODAL Bimbingan ────────────────────────────────────────
  const modalBimbingan = () => `
    <div id="modal-bimbingan" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h3 class="text-lg font-semibold dark:text-white">Tambah Log Bimbingan</h3>
          <button onclick="document.getElementById('modal-bimbingan').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Bimbingan</label>
            <input id="bimb-tanggal" type="date" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topik / Materi</label>
            <textarea id="bimb-topik" rows="2" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" placeholder="Topik bimbingan..."></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan Dosen</label>
            <textarea id="bimb-catatan" rows="2" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" placeholder="Masukan atau revisi dari dosen..."></textarea>
          </div>
          <div id="modal-bimb-err" class="hidden text-sm text-red-600 dark:text-red-400"></div>
        </div>
        <div class="flex justify-end gap-2 px-5 pb-5">
          <button onclick="document.getElementById('modal-bimbingan').classList.add('hidden')"
            class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Batal</button>
          <button id="btn-save-bimb" onclick="TAModule.saveBimbingan()"
            class="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium">Simpan</button>
        </div>
      </div>
    </div>`

  const openBimbinganModal = () => {
    document.getElementById('modal-bimbingan').classList.remove('hidden')
    document.getElementById('modal-bimb-err').classList.add('hidden')
    document.getElementById('bimb-tanggal').value = new Date().toISOString().slice(0,10)
    document.getElementById('bimb-topik').value = ''
    document.getElementById('bimb-catatan').value = ''
  }

  const saveBimbingan = async () => {
    const btn = document.getElementById('btn-save-bimb')
    const errEl = document.getElementById('modal-bimb-err')
    btn.disabled = true; btn.textContent = 'Menyimpan...'
    errEl.classList.add('hidden')
    try {
      await API.post(`/ta/${selectedTaId}/bimbingan`, {
        tanggal:       document.getElementById('bimb-tanggal').value,
        topik:         document.getElementById('bimb-topik').value.trim(),
        catatan_dosen: document.getElementById('bimb-catatan').value.trim(),
      })
      document.getElementById('modal-bimbingan').classList.add('hidden')
      await loadBimbingan()
      UI.toast('Log bimbingan ditambahkan', 'success')
    } catch (e) {
      errEl.textContent = e.message || 'Gagal'
      errEl.classList.remove('hidden')
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan'
    }
  }

  // ── SIDANG tab ─────────────────────────────────────────────
  const renderSidang = async () => {
    const panel = document.getElementById('ta-panel-sidang')
    const params = new URLSearchParams({ page: sidangPage, per_page: 20, ...sidangFilter })
    let data = [], meta = {}
    try {
      const res = await API.get(`/ta/sidang/list?${params}`)
      data = res.data || []; meta = res.meta || {}
    } catch (e) {}

    const statusMap = {
      terjadwal: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
      selesai: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      dibatalkan: 'bg-red-100 text-red-700',
    }

    panel.innerHTML = `
      <div class="flex flex-wrap gap-2 mb-4">
        <select id="sidang-f-status" onchange="TAModule.filterSidang()"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">Semua Status</option>
          <option value="terjadwal">Terjadwal</option>
          <option value="selesai">Selesai</option>
        </select>
        <input id="sidang-f-search" type="text" placeholder="Cari nama / NIM / judul…"
          value="${sidangFilter.search || ''}"
          oninput="TAModule.filterSidang()"
          class="flex-1 min-w-[200px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 text-left">
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Mahasiswa</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Judul TA</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Tanggal</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Ruang</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Nilai</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0
              ? `<tr><td colspan="7" class="text-center py-10 text-gray-400">Belum ada jadwal sidang</td></tr>`
              : data.map(s => `
              <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                <td class="px-4 py-3">
                  <div class="font-medium dark:text-white">${s.mahasiswa_nama}</div>
                  <div class="text-xs text-gray-400">${s.mahasiswa_nim}</div>
                </td>
                <td class="px-4 py-3 max-w-xs">
                  <div class="dark:text-white">${s.judul}</div>
                </td>
                <td class="px-4 py-3 text-sm dark:text-gray-300">
                  <div>${new Date(s.tanggal).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</div>
                  <div class="text-xs text-gray-400">${s.jam_mulai} – ${s.jam_selesai}</div>
                </td>
                <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">${s.ruang || '-'}</td>
                <td class="px-4 py-3">
                  <div class="font-medium dark:text-white">${s.nilai_sidang ?? '-'}</div>
                  ${s.hasil ? `<div class="text-xs ${s.hasil==='lulus'?'text-green-500':'text-red-500'}">${s.hasil}</div>` : ''}
                </td>
                <td class="px-4 py-3">
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusMap[s.status] || 'bg-gray-100 text-gray-700'}">${s.status}</span>
                </td>
                <td class="px-4 py-3">
                  ${s.status === 'terjadwal' ? `
                  <button onclick="TAModule.openNilaiModal('${s.id}')"
                    class="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded">Input Nilai</button>` : ''}
                  <button onclick="TAModule.openEditSidang('${s.id}')"
                    class="px-2 py-1 text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 rounded">Edit</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(meta, 'TAModule.gotoSidangPage')}
    `
  }

  const filterSidang = () => {
    sidangFilter = {}
    const s = document.getElementById('sidang-f-status')?.value
    const q = document.getElementById('sidang-f-search')?.value.trim()
    if (s) sidangFilter.status = s
    if (q) sidangFilter.search = q
    sidangPage = 1; renderSidang()
  }
  const gotoSidangPage = (p) => { sidangPage = p; renderSidang() }

  // ── MODAL Jadwal Sidang ────────────────────────────────────
  const modalSidangJadwal = () => `
    <div id="modal-sidang-jadwal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h3 id="modal-sidang-title" class="text-lg font-semibold dark:text-white">Jadwalkan Sidang</h3>
          <button onclick="document.getElementById('modal-sidang-jadwal').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal</label>
            <input id="sidang-tanggal" type="date" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Mulai</label>
              <input id="sidang-jam-mulai" type="time" value="09:00" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Selesai</label>
              <input id="sidang-jam-selesai" type="time" value="11:00" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ruang</label>
            <input id="sidang-ruang" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" placeholder="Ruang Sidang A">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Penguji 1</label>
            <input id="sidang-penguji1" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Penguji 2</label>
              <input id="sidang-penguji2" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Penguji 3</label>
              <input id="sidang-penguji3" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
            </div>
          </div>
          <div id="modal-sidang-err" class="hidden text-sm text-red-600 dark:text-red-400"></div>
        </div>
        <div class="flex justify-end gap-2 px-5 pb-5">
          <button onclick="document.getElementById('modal-sidang-jadwal').classList.add('hidden')"
            class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Batal</button>
          <button id="btn-save-sidang" onclick="TAModule.saveSidangJadwal()"
            class="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium">Simpan</button>
        </div>
      </div>
    </div>`

  const openJadwalSidang = async (taId) => {
    editingTaId = taId
    editingSidangId = null
    document.getElementById('modal-sidang-jadwal').classList.remove('hidden')
    document.getElementById('modal-sidang-title').textContent = 'Jadwalkan Sidang'
    document.getElementById('modal-sidang-err').classList.add('hidden')
    try {
      const res = await API.get(`/ta/${taId}`)
      const ta = res.data
      document.getElementById('sidang-penguji1').value = ta.pembimbing1_nama || ''
    } catch (e) {}
    document.getElementById('sidang-tanggal').value = ''
    document.getElementById('sidang-ruang').value = 'Ruang Sidang A'
  }

  const openEditSidang = async (sidangId) => {
    editingSidangId = sidangId
    editingTaId = null
    document.getElementById('modal-sidang-jadwal').classList.remove('hidden')
    document.getElementById('modal-sidang-title').textContent = 'Edit Jadwal Sidang'
    document.getElementById('modal-sidang-err').classList.add('hidden')
    try {
      const res = await API.get('/ta/sidang/list?per_page=200')
      const sidang = (res.data || []).find(s => s.id === sidangId)
      if (sidang) {
        document.getElementById('sidang-tanggal').value   = sidang.tanggal || ''
        document.getElementById('sidang-jam-mulai').value = sidang.jam_mulai || '09:00'
        document.getElementById('sidang-jam-selesai').value = sidang.jam_selesai || '11:00'
        document.getElementById('sidang-ruang').value     = sidang.ruang || ''
        document.getElementById('sidang-penguji1').value  = sidang.penguji1 || ''
        document.getElementById('sidang-penguji2').value  = sidang.penguji2 || ''
        document.getElementById('sidang-penguji3').value  = sidang.penguji3 || ''
      }
    } catch (e) {}
  }

  const saveSidangJadwal = async () => {
    const btn = document.getElementById('btn-save-sidang')
    const errEl = document.getElementById('modal-sidang-err')
    btn.disabled = true; btn.textContent = 'Menyimpan...'
    errEl.classList.add('hidden')
    try {
      const body = {
        tanggal:    document.getElementById('sidang-tanggal').value,
        jam_mulai:  document.getElementById('sidang-jam-mulai').value,
        jam_selesai:document.getElementById('sidang-jam-selesai').value,
        ruang:      document.getElementById('sidang-ruang').value.trim(),
        penguji1:   document.getElementById('sidang-penguji1').value.trim(),
        penguji2:   document.getElementById('sidang-penguji2').value.trim(),
        penguji3:   document.getElementById('sidang-penguji3').value.trim(),
      }
      if (editingSidangId) {
        await API.put(`/ta/sidang/${editingSidangId}`, body)
      } else {
        await API.post(`/ta/${editingTaId}/sidang`, body)
      }
      document.getElementById('modal-sidang-jadwal').classList.add('hidden')
      await loadStats(); await renderSidang()
      UI.toast('Jadwal sidang disimpan', 'success')
    } catch (e) {
      errEl.textContent = e.message || 'Gagal'
      errEl.classList.remove('hidden')
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan'
    }
  }

  // ── MODAL Input Nilai Sidang ───────────────────────────────
  const modalSidangNilai = () => `
    <div id="modal-sidang-nilai" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
        <div class="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h3 class="text-lg font-semibold dark:text-white">Input Nilai Sidang</h3>
          <button onclick="document.getElementById('modal-sidang-nilai').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div id="sidang-nilai-info" class="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-lg p-3"></div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nilai Sidang (0–100)</label>
            <input id="sidang-nilai-input" type="number" min="0" max="100" step="0.1"
              class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
              oninput="TAModule.previewHasil(this.value)">
            <div id="sidang-nilai-preview" class="mt-1 text-sm font-medium"></div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hasil</label>
            <select id="sidang-hasil-input" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
              <option value="lulus">Lulus</option>
              <option value="tidak_lulus">Tidak Lulus (Revisi)</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
            <textarea id="sidang-catatan-input" rows="2" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"></textarea>
          </div>
          <div id="modal-nilai-err" class="hidden text-sm text-red-600 dark:text-red-400"></div>
        </div>
        <div class="flex justify-end gap-2 px-5 pb-5">
          <button onclick="document.getElementById('modal-sidang-nilai').classList.add('hidden')"
            class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Batal</button>
          <button id="btn-save-nilai" onclick="TAModule.saveNilai()"
            class="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium">Simpan Nilai</button>
        </div>
      </div>
    </div>`

  const openNilaiModal = async (sidangId) => {
    editingSidangId = sidangId
    document.getElementById('modal-sidang-nilai').classList.remove('hidden')
    document.getElementById('modal-nilai-err').classList.add('hidden')
    document.getElementById('sidang-nilai-input').value = ''
    document.getElementById('sidang-nilai-preview').textContent = ''
    try {
      const res = await API.get('/ta/sidang/list?per_page=200')
      const sidang = (res.data || []).find(s => s.id === sidangId)
      if (sidang) {
        document.getElementById('sidang-nilai-info').textContent =
          `${sidang.mahasiswa_nama} (${sidang.mahasiswa_nim}) — ${sidang.judul.slice(0, 60)}…`
      }
    } catch (e) {}
  }

  const previewHasil = (val) => {
    const n = parseFloat(val)
    const el = document.getElementById('sidang-nilai-preview')
    const hasilEl = document.getElementById('sidang-hasil-input')
    if (isNaN(n)) { el.textContent = ''; return }
    const lulus = n >= 70
    el.textContent = lulus ? '✓ Lulus' : '✗ Tidak Lulus'
    el.className = `mt-1 text-sm font-medium ${lulus ? 'text-green-600' : 'text-red-600'}`
    hasilEl.value = lulus ? 'lulus' : 'tidak_lulus'
  }

  const saveNilai = async () => {
    const btn = document.getElementById('btn-save-nilai')
    const errEl = document.getElementById('modal-nilai-err')
    btn.disabled = true; btn.textContent = 'Menyimpan...'
    errEl.classList.add('hidden')
    try {
      const nilai = parseFloat(document.getElementById('sidang-nilai-input').value)
      if (isNaN(nilai) || nilai < 0 || nilai > 100) throw new Error('Nilai harus antara 0–100')
      await API.put(`/ta/sidang/${editingSidangId}`, {
        nilai_sidang: nilai,
        hasil: document.getElementById('sidang-hasil-input').value,
        catatan: document.getElementById('sidang-catatan-input').value.trim(),
      })
      document.getElementById('modal-sidang-nilai').classList.add('hidden')
      await loadStats(); await renderSidang()
      UI.toast('Nilai sidang berhasil disimpan', 'success')
    } catch (e) {
      errEl.textContent = e.message || 'Gagal'
      errEl.classList.remove('hidden')
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan Nilai'
    }
  }

  // ── pagination ─────────────────────────────────────────────
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
    filterDaftar, gotoTaPage,
    openAjukanModal, lookupMhs, saveAjukanTA,
    openStatusModal, saveStatus,
    openTolakModal, saveTolak,
    setujuiTA,
    loadBimbingan, bukaTabBimbingan,
    openBimbinganModal, saveBimbingan,
    filterSidang, gotoSidangPage,
    openJadwalSidang, openEditSidang, saveSidangJadwal,
    openNilaiModal, previewHasil, saveNilai,
  }
})()
