// ============================================================
// MAGANG MODULE — Pengajuan, Persetujuan, Nilai Magang/PKL
// ============================================================
const MagangModule = (() => {

  let currentTab = 'daftar'
  let page = 1; let filter = {}
  let dosen_list = []; let mhs_list = []
  let editingId = null

  const render = async () => {
    const main = document.getElementById('page-content')
    main.innerHTML = `
      <div class="p-4 md:p-6 space-y-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Magang / PKL</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">Kelola pengajuan dan penilaian magang / PKL mahasiswa</p>
        </div>

        <div id="magang-stats" class="grid grid-cols-2 md:grid-cols-4 gap-3"></div>

        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="flex gap-1">
            ${['daftar','laporan'].map(t => `
              <button onclick="MagangModule.switchTab('${t}')" id="mg-tab-${t}"
                class="tab-btn px-4 py-2 text-sm font-medium border-b-2 transition-colors
                  ${currentTab === t ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}">
                ${t === 'daftar' ? 'Daftar Magang' : 'Laporan & Instansi'}
              </button>`).join('')}
          </nav>
        </div>

        <div id="mg-panel-daftar"  class="${currentTab === 'daftar'   ? '' : 'hidden'}"></div>
        <div id="mg-panel-laporan" class="${currentTab === 'laporan'  ? '' : 'hidden'}"></div>
      </div>

      ${modalAjukan()}
      ${modalSelesai()}
      ${modalTolak()}
    `

    try {
      const [r1, r2] = await Promise.all([
        API.get('/dosen?per_page=200'),
        API.get('/mahasiswa?per_page=500&status=aktif'),
      ])
      dosen_list = r1.data || []
      mhs_list = r2.data || []
    } catch (e) {}

    await loadStats()
    await renderActiveTab()
  }

  const switchTab = async (tab) => {
    currentTab = tab
    ;['daftar','laporan'].forEach(t => {
      const btn = document.getElementById(`mg-tab-${t}`)
      const panel = document.getElementById(`mg-panel-${t}`)
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
    if (currentTab === 'daftar') await renderDaftar()
    else await renderLaporan()
  }

  const loadStats = async () => {
    try {
      const res = await API.get('/magang/stats')
      const d = res.data || {}
      const el = document.getElementById('magang-stats')
      if (!el) return
      el.innerHTML = [
        { label: 'Total Magang', val: d.total, sub: 'Semua status', color: 'blue' },
        { label: 'Menunggu', val: d.pending, sub: 'Perlu disetujui', color: 'amber' },
        { label: 'Sedang Berjalan', val: d.berjalan, sub: 'Aktif magang', color: 'cyan' },
        { label: 'Rata Nilai', val: d.rata_nilai ?? '-', sub: `${d.selesai} selesai`, color: 'green' },
      ].map(s => `
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="text-2xl font-bold text-${s.color}-600 dark:text-${s.color}-400">${s.val}</div>
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300">${s.label}</div>
          <div class="text-xs text-gray-400 mt-1">${s.sub}</div>
        </div>`).join('')
    } catch (e) {}
  }

  // ── STATUS BADGE ───────────────────────────────────────────
  const statusBadge = (s) => {
    const map = {
      pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
      berjalan: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      selesai:  'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || 'bg-gray-100 text-gray-700'}">${s}</span>`
  }

  // ── DAFTAR tab ─────────────────────────────────────────────
  const renderDaftar = async () => {
    const panel = document.getElementById('mg-panel-daftar')
    const params = new URLSearchParams({ page, per_page: 20, ...filter })
    let data = [], meta = {}
    try {
      const res = await API.get(`/magang?${params}`)
      data = res.data || []; meta = res.meta || {}
    } catch (e) {}

    const fmtTgl = (s) => s ? new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'

    panel.innerHTML = `
      <div class="flex flex-wrap gap-2 mb-4">
        <select id="mg-f-status" onchange="MagangModule.applyFilter()"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">Semua Status</option>
          <option value="pending" ${filter.status==='pending'?'selected':''}>Pending</option>
          <option value="berjalan" ${filter.status==='berjalan'?'selected':''}>Berjalan</option>
          <option value="selesai" ${filter.status==='selesai'?'selected':''}>Selesai</option>
        </select>
        <input id="mg-f-search" type="text" placeholder="Cari nama / NIM / instansi…"
          value="${filter.search || ''}" oninput="MagangModule.applyFilter()"
          class="flex-1 min-w-[200px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white">
        <button onclick="MagangModule.openAjukan()"
          class="ml-auto px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + Ajukan Magang
        </button>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 text-left">
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Mahasiswa</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Instansi & Proyek</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Pembimbing</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Periode</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Nilai</th>
              <th class="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${data.length === 0
              ? `<tr><td colspan="7" class="text-center py-10 text-gray-400">Belum ada data magang</td></tr>`
              : data.map(m => `
              <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                <td class="px-4 py-3">
                  <div class="font-medium dark:text-white">${m.mahasiswa_nama}</div>
                  <div class="text-xs text-gray-400">${m.mahasiswa_nim}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium dark:text-white">${m.instansi}</div>
                  <div class="text-xs text-gray-400 max-w-xs">${m.judul_proyek || '-'}</div>
                </td>
                <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">${m.dosen_pembimbing_nama || '-'}</td>
                <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                  <div>${fmtTgl(m.tgl_mulai)}</div>
                  <div>s/d ${fmtTgl(m.tgl_selesai)}</div>
                </td>
                <td class="px-4 py-3">${statusBadge(m.status)}</td>
                <td class="px-4 py-3 font-medium dark:text-white">${m.nilai_akhir ?? '-'}</td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    ${m.status === 'pending' ? `
                    <button onclick="MagangModule.setujui('${m.id}')"
                      class="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded">Setujui</button>
                    <button onclick="MagangModule.openTolak('${m.id}')"
                      class="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded">Tolak</button>` : ''}
                    ${m.status === 'berjalan' ? `
                    <button onclick="MagangModule.openSelesai('${m.id}')"
                      class="px-2 py-1 text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 rounded">Selesaikan</button>` : ''}
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(meta, 'MagangModule.gotoPage')}
    `
  }

  const applyFilter = () => {
    filter = {}
    const s = document.getElementById('mg-f-status')?.value
    const q = document.getElementById('mg-f-search')?.value.trim()
    if (s) filter.status = s
    if (q) filter.search = q
    page = 1; renderDaftar()
  }
  const gotoPage = (p) => { page = p; renderDaftar() }

  const setujui = async (id) => {
    if (!confirm('Setujui pengajuan magang ini?')) return
    try {
      await API.post(`/magang/${id}/setujui`, {})
      await loadStats(); await renderDaftar()
      UI.toast('Magang disetujui', 'success')
    } catch (e) { UI.toast(e.message || 'Gagal', 'error') }
  }

  // ── LAPORAN tab ────────────────────────────────────────────
  const renderLaporan = async () => {
    const panel = document.getElementById('mg-panel-laporan')
    try {
      const res = await API.get('/magang/stats')
      const d = res.data || {}
      panel.innerHTML = `
        <div class="grid md:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Distribusi Status</h3>
            <div class="space-y-3">
              ${[
                { label: 'Pending', val: d.pending, total: d.total, color: 'amber' },
                { label: 'Berjalan', val: d.berjalan, total: d.total, color: 'blue' },
                { label: 'Selesai', val: d.selesai, total: d.total, color: 'green' },
              ].map(s => `
                <div>
                  <div class="flex justify-between text-sm mb-1">
                    <span class="text-gray-600 dark:text-gray-400">${s.label}</span>
                    <span class="font-medium dark:text-white">${s.val}</span>
                  </div>
                  <div class="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div class="bg-${s.color}-500 h-2 rounded-full" style="width:${s.total ? Math.round(s.val/s.total*100) : 0}%"></div>
                  </div>
                </div>`).join('')}
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Top Instansi Mitra</h3>
            <div class="space-y-2">
              ${(d.top_instansi || []).map((inst, i) => `
                <div class="flex items-center gap-3">
                  <span class="w-6 h-6 flex-shrink-0 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">${i+1}</span>
                  <div class="flex-1">
                    <div class="text-sm font-medium dark:text-white">${inst.instansi}</div>
                  </div>
                  <span class="text-sm font-bold text-blue-600 dark:text-blue-400">${inst.jumlah} mhs</span>
                </div>`).join('')}
            </div>
          </div>
        </div>
      `
    } catch (e) {
      panel.innerHTML = '<div class="text-center py-10 text-red-400">Gagal memuat laporan</div>'
    }
  }

  // ── MODALS ─────────────────────────────────────────────────
  const modalAjukan = () => `
    <div id="modal-ajukan-mg" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h3 class="text-lg font-semibold dark:text-white">Ajukan Magang / PKL</h3>
          <button onclick="document.getElementById('modal-ajukan-mg').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mahasiswa</label>
            <select id="mg-mhs" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
              <option value="">-- Pilih Mahasiswa --</option>
              ${mhs_list.slice(0,100).map(m => `<option value="${m.id}">${m.nim} – ${m.nama_lengkap}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instansi / Perusahaan</label>
            <input id="mg-instansi" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" placeholder="PT Contoh Indonesia">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Judul Proyek</label>
            <input id="mg-proyek" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" placeholder="Pengembangan sistem…">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dosen Pembimbing</label>
            <select id="mg-pb" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
              <option value="">-- Pilih Dosen --</option>
              ${dosen_list.map(d => `<option value="${d.id}">${d.nama_lengkap}</option>`).join('')}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tgl Mulai</label>
              <input id="mg-mulai" type="date" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tgl Selesai</label>
              <input id="mg-selesai" type="date" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
            </div>
          </div>
          <div id="modal-mg-err" class="hidden text-sm text-red-600 dark:text-red-400"></div>
        </div>
        <div class="flex justify-end gap-2 px-5 pb-5">
          <button onclick="document.getElementById('modal-ajukan-mg').classList.add('hidden')"
            class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Batal</button>
          <button id="btn-save-mg" onclick="MagangModule.saveAjukan()"
            class="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium">Ajukan</button>
        </div>
      </div>
    </div>`

  const openAjukan = () => {
    document.getElementById('modal-ajukan-mg').classList.remove('hidden')
    document.getElementById('modal-mg-err').classList.add('hidden')
  }

  const saveAjukan = async () => {
    const btn = document.getElementById('btn-save-mg')
    const errEl = document.getElementById('modal-mg-err')
    btn.disabled = true; btn.textContent = 'Menyimpan...'
    errEl.classList.add('hidden')
    try {
      await API.post('/magang', {
        mahasiswa_id:      document.getElementById('mg-mhs').value,
        instansi:          document.getElementById('mg-instansi').value.trim(),
        judul_proyek:      document.getElementById('mg-proyek').value.trim(),
        dosen_pembimbing_id: document.getElementById('mg-pb').value || null,
        tgl_mulai:         document.getElementById('mg-mulai').value,
        tgl_selesai:       document.getElementById('mg-selesai').value,
      })
      document.getElementById('modal-ajukan-mg').classList.add('hidden')
      await loadStats(); await renderDaftar()
      UI.toast('Pengajuan magang berhasil', 'success')
    } catch (e) {
      errEl.textContent = e.message || 'Gagal'
      errEl.classList.remove('hidden')
    } finally {
      btn.disabled = false; btn.textContent = 'Ajukan'
    }
  }

  const modalSelesai = () => `
    <div id="modal-selesai-mg" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
        <div class="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h3 class="text-lg font-semibold dark:text-white">Input Nilai Magang</h3>
          <button onclick="document.getElementById('modal-selesai-mg').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nilai Akhir (0–100)</label>
            <input id="mg-nilai" type="number" min="0" max="100" step="0.1"
              class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Selesai</label>
            <input id="mg-tgl-selesai" type="date" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
            <textarea id="mg-catatan" rows="2" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"></textarea>
          </div>
          <div id="modal-selesai-err" class="hidden text-sm text-red-600 dark:text-red-400"></div>
        </div>
        <div class="flex justify-end gap-2 px-5 pb-5">
          <button onclick="document.getElementById('modal-selesai-mg').classList.add('hidden')"
            class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Batal</button>
          <button id="btn-selesai" onclick="MagangModule.saveSelesai()"
            class="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium">Simpan Nilai</button>
        </div>
      </div>
    </div>`

  const openSelesai = (id) => {
    editingId = id
    document.getElementById('modal-selesai-mg').classList.remove('hidden')
    document.getElementById('modal-selesai-err').classList.add('hidden')
    document.getElementById('mg-nilai').value = ''
    document.getElementById('mg-tgl-selesai').value = new Date().toISOString().slice(0,10)
    document.getElementById('mg-catatan').value = ''
  }

  const saveSelesai = async () => {
    const btn = document.getElementById('btn-selesai')
    const errEl = document.getElementById('modal-selesai-err')
    btn.disabled = true; btn.textContent = 'Menyimpan...'
    errEl.classList.add('hidden')
    try {
      await API.post(`/magang/${editingId}/selesai`, {
        nilai_akhir: parseFloat(document.getElementById('mg-nilai').value) || null,
        tgl_selesai: document.getElementById('mg-tgl-selesai').value,
        catatan: document.getElementById('mg-catatan').value.trim(),
      })
      document.getElementById('modal-selesai-mg').classList.add('hidden')
      await loadStats(); await renderDaftar()
      UI.toast('Nilai magang berhasil disimpan', 'success')
    } catch (e) {
      errEl.textContent = e.message || 'Gagal'
      errEl.classList.remove('hidden')
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan Nilai'
    }
  }

  const modalTolak = () => `
    <div id="modal-tolak-mg" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm">
        <div class="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h3 class="text-lg font-semibold dark:text-white">Tolak Pengajuan Magang</h3>
          <button onclick="document.getElementById('modal-tolak-mg').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alasan Penolakan</label>
            <textarea id="mg-alasan" rows="3" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white" placeholder="Jelaskan alasan..."></textarea>
          </div>
          <div id="modal-tolak-mg-err" class="hidden text-sm text-red-600 dark:text-red-400"></div>
        </div>
        <div class="flex justify-end gap-2 px-5 pb-5">
          <button onclick="document.getElementById('modal-tolak-mg').classList.add('hidden')"
            class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Batal</button>
          <button id="btn-tolak-mg" onclick="MagangModule.saveTolak()"
            class="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium">Tolak</button>
        </div>
      </div>
    </div>`

  const openTolak = (id) => {
    editingId = id
    document.getElementById('modal-tolak-mg').classList.remove('hidden')
    document.getElementById('modal-tolak-mg-err').classList.add('hidden')
    document.getElementById('mg-alasan').value = ''
  }

  const saveTolak = async () => {
    const btn = document.getElementById('btn-tolak-mg')
    const errEl = document.getElementById('modal-tolak-mg-err')
    btn.disabled = true; btn.textContent = 'Menolak...'
    errEl.classList.add('hidden')
    try {
      await API.post(`/magang/${editingId}/tolak`, {
        alasan: document.getElementById('mg-alasan').value.trim()
      })
      document.getElementById('modal-tolak-mg').classList.add('hidden')
      await loadStats(); await renderDaftar()
      UI.toast('Pengajuan ditolak', 'success')
    } catch (e) {
      errEl.textContent = e.message || 'Gagal'
      errEl.classList.remove('hidden')
    } finally {
      btn.disabled = false; btn.textContent = 'Tolak'
    }
  }

  const renderPagination = (meta, fn) => {
    if (!meta || meta.total_pages <= 1) return ''
    const { page: p, total_pages, total } = meta
    return `
      <div class="flex items-center justify-between mt-4 text-sm text-gray-600 dark:text-gray-400">
        <div>Total: ${total} data</div>
        <div class="flex gap-1">
          ${p > 1 ? `<button onclick="${fn}(${p - 1})" class="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">‹</button>` : ''}
          <span class="px-3 py-1">Hal ${p} / ${total_pages}</span>
          ${p < total_pages ? `<button onclick="${fn}(${p + 1})" class="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">›</button>` : ''}
        </div>
      </div>`
  }

  return {
    render, switchTab,
    applyFilter, gotoPage,
    setujui,
    openAjukan, saveAjukan,
    openSelesai, saveSelesai,
    openTolak, saveTolak,
  }
})()
