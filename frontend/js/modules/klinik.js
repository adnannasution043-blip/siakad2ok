// Klinik & Kesehatan Module
const KlinikModule = (() => {
  const API = '/api/v1/klinik'
  let currentId = null

  // ── Helpers ────────────────────────────────────────────────────────────────

  const statusBadge = (s) => {
    const map = {
      selesai: 'bg-green-100 text-green-800',
      dirujuk: 'bg-orange-100 text-orange-800',
      dalam_perawatan: 'bg-blue-100 text-blue-800',
    }
    const label = { selesai: 'Selesai', dirujuk: 'Dirujuk', dalam_perawatan: 'Dalam Perawatan' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || 'bg-slate-100 text-slate-700'}">${label[s] || s}</span>`
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

  // ── Stats ──────────────────────────────────────────────────────────────────

  const loadStats = async () => {
    try {
      const r = await fetch(`${API}/stats`)
      const j = await r.json()
      const d = j.data || {}
      document.getElementById('kli-stat-total').textContent = d.total_kunjungan ?? 0
      document.getElementById('kli-stat-selesai').textContent = d.selesai ?? 0
      document.getElementById('kli-stat-dirujuk').textContent = d.dirujuk ?? 0
      document.getElementById('kli-stat-pasien').textContent = d.total_pasien_unik ?? 0
      document.getElementById('kli-stat-diagnosa').textContent = d.jenis_diagnosa ?? 0
    } catch (e) { console.error(e) }
  }

  // ── List ───────────────────────────────────────────────────────────────────

  const loadData = async (params = {}) => {
    const tbody = document.getElementById('kli-tbody')
    if (!tbody) return
    try {
      const qs = new URLSearchParams({ per_page: 50, ...params }).toString()
      const r = await fetch(`${API}?${qs}`)
      const j = await r.json()
      const items = j.data || []
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-10 text-slate-400">Belum ada data kunjungan</td></tr>'
        return
      }
      tbody.innerHTML = items.map(k => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30">
          <td class="px-4 py-3 text-sm">${fmtDate(k.tanggal)}</td>
          <td class="px-4 py-3">
            <div class="font-medium text-sm">${k.nama_pasien}</div>
            <div class="text-xs text-slate-400 font-mono">${k.nim}</div>
          </td>
          <td class="px-4 py-3 text-sm">${k.keluhan}</td>
          <td class="px-4 py-3 text-sm">${k.diagnosa || '-'}</td>
          <td class="px-4 py-3 text-sm">${k.petugas}</td>
          <td class="px-4 py-3">${statusBadge(k.status)}</td>
          <td class="px-4 py-3">
            <div class="flex gap-1">
              <button onclick="KlinikModule.openDetail('${k.id}')" class="px-2 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded">Detail</button>
              <button onclick="KlinikModule.openEdit('${k.id}')" class="px-2 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded">Edit</button>
              <button onclick="KlinikModule.hapus('${k.id}','${k.nama_pasien}')" class="px-2 py-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded">Hapus</button>
            </div>
          </td>
        </tr>`).join('')
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-10 text-red-400">Gagal memuat data</td></tr>'
    }
  }

  const doSearch = () => {
    const search = document.getElementById('kli-search')?.value
    const status = document.getElementById('kli-filter-status')?.value
    loadData({ search, status })
  }

  // ── Detail Modal ───────────────────────────────────────────────────────────

  const openDetail = async (id) => {
    const r = await fetch(`${API}/${id}`)
    const j = await r.json()
    const k = j.data
    if (!k) return
    const body = document.getElementById('kli-detail-body')
    if (body) body.innerHTML = `
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><span class="text-slate-500">Tanggal</span><p class="font-medium">${fmtDate(k.tanggal)}</p></div>
        <div><span class="text-slate-500">Status</span><p class="mt-0.5">${statusBadge(k.status)}</p></div>
        <div><span class="text-slate-500">Nama Pasien</span><p class="font-medium">${k.nama_pasien}</p></div>
        <div><span class="text-slate-500">NIM</span><p class="font-mono">${k.nim}</p></div>
        <div class="col-span-2"><span class="text-slate-500">Keluhan</span><p>${k.keluhan}</p></div>
        <div class="col-span-2"><span class="text-slate-500">Diagnosa</span><p class="font-medium">${k.diagnosa || '-'}</p></div>
        <div class="col-span-2"><span class="text-slate-500">Tindakan</span><p>${k.tindakan || '-'}</p></div>
        <div><span class="text-slate-500">Petugas</span><p>${k.petugas}</p></div>
        <div class="col-span-2"><span class="text-slate-500">Catatan</span><p class="text-slate-600 dark:text-slate-300">${k.catatan || '-'}</p></div>
      </div>`
    document.getElementById('kli-detail-modal')?.classList.remove('hidden')
  }

  // ── Form Modal ─────────────────────────────────────────────────────────────

  const openAdd = () => {
    currentId = null
    document.getElementById('kli-form-title').textContent = 'Catat Kunjungan'
    document.getElementById('kli-form').reset()
    const today = new Date().toISOString().split('T')[0]
    const tglEl = document.getElementById('kf-tanggal')
    if (tglEl) tglEl.value = today
    document.getElementById('kli-form-modal')?.classList.remove('hidden')
  }

  const openEdit = async (id) => {
    const r = await fetch(`${API}/${id}`)
    const j = await r.json()
    const k = j.data
    if (!k) return
    currentId = id
    document.getElementById('kli-form-title').textContent = 'Edit Kunjungan'
    const fields = ['nim', 'nama_pasien', 'mahasiswa_id', 'tanggal', 'keluhan', 'diagnosa', 'tindakan', 'petugas', 'status', 'catatan']
    fields.forEach(f => { const el = document.getElementById(`kf-${f}`); if (el) el.value = k[f] || '' })
    document.getElementById('kli-form-modal')?.classList.remove('hidden')
  }

  const submitForm = async (e) => {
    e.preventDefault()
    const body = {
      mahasiswa_id: document.getElementById('kf-mahasiswa_id')?.value,
      nim: document.getElementById('kf-nim')?.value,
      nama_pasien: document.getElementById('kf-nama_pasien')?.value,
      tanggal: document.getElementById('kf-tanggal')?.value,
      keluhan: document.getElementById('kf-keluhan')?.value,
      diagnosa: document.getElementById('kf-diagnosa')?.value,
      tindakan: document.getElementById('kf-tindakan')?.value,
      petugas: document.getElementById('kf-petugas')?.value,
      status: document.getElementById('kf-status')?.value,
      catatan: document.getElementById('kf-catatan')?.value,
    }
    try {
      const url = currentId ? `${API}/${currentId}` : API
      const method = currentId ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (!j.success) { UI.toast(j.message || 'Gagal', 'error'); return }
      UI.toast(j.message || 'Berhasil', 'success')
      document.getElementById('kli-form-modal')?.classList.add('hidden')
      loadData()
      loadStats()
    } catch (err) {
      UI.toast('Error: ' + err.message, 'error')
    }
  }

  const hapus = async (id, nama) => {
    if (!confirm(`Hapus data kunjungan "${nama}"?`)) return
    const r = await fetch(`${API}/${id}`, { method: 'DELETE' })
    const j = await r.json()
    UI.toast(j.message || 'Dihapus', j.success ? 'success' : 'error')
    if (j.success) { loadData(); loadStats() }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const render = () => {
    const el = document.getElementById('page-content')
    Router.setPageMeta('Klinik & Kesehatan', 'Layanan kesehatan dan kunjungan klinik')
    if (!el) return
    el.innerHTML = `
    <div class="p-6 space-y-6">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">Klinik & Kesehatan</h1>
          <p class="text-sm text-slate-500 mt-0.5">Rekam medis dan kunjungan klinik kampus</p>
        </div>
        <button onclick="KlinikModule.openAdd()" class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">+ Catat Kunjungan</button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
        ${[
          ['kli-stat-total', 'Total Kunjungan', '🏥', 'blue'],
          ['kli-stat-selesai', 'Selesai', '✅', 'green'],
          ['kli-stat-dirujuk', 'Dirujuk', '🚑', 'orange'],
          ['kli-stat-pasien', 'Pasien Unik', '👤', 'purple'],
          ['kli-stat-diagnosa', 'Jenis Diagnosa', '📋', 'teal'],
        ].map(([id, label, icon]) => `
          <div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
            <div class="text-2xl mb-1">${icon}</div>
            <div id="${id}" class="text-2xl font-bold text-slate-800 dark:text-slate-100">-</div>
            <div class="text-xs text-slate-500 mt-0.5">${label}</div>
          </div>`).join('')}
      </div>

      <!-- Table -->
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div class="flex flex-wrap gap-2 p-4 border-b border-slate-100 dark:border-slate-700">
          <input id="kli-search" type="text" placeholder="Cari nama / NIM / keluhan..."
            class="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm w-64"
            oninput="KlinikModule.doSearch()">
          <select id="kli-filter-status" onchange="KlinikModule.doSearch()"
            class="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            <option value="">Semua Status</option>
            <option value="selesai">Selesai</option>
            <option value="dirujuk">Dirujuk</option>
            <option value="dalam_perawatan">Dalam Perawatan</option>
          </select>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Tanggal</th>
                <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Pasien</th>
                <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Keluhan</th>
                <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Diagnosa</th>
                <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Petugas</th>
                <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Status</th>
                <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Aksi</th>
              </tr>
            </thead>
            <tbody id="kli-tbody" class="divide-y divide-slate-100 dark:divide-slate-700">
              <tr><td colspan="7" class="text-center py-10 text-slate-400">Memuat data...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div id="kli-detail-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold">Detail Kunjungan</h3>
          <button onclick="document.getElementById('kli-detail-modal').classList.add('hidden')"
            class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div id="kli-detail-body" class="p-5"></div>
      </div>
    </div>

    <!-- Form Modal -->
    <div id="kli-form-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h3 id="kli-form-title" class="text-lg font-semibold">Catat Kunjungan</h3>
          <button onclick="document.getElementById('kli-form-modal').classList.add('hidden')"
            class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form id="kli-form" onsubmit="KlinikModule.submitForm(event)" class="p-5 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">NIM *</label>
              <input id="kf-nim" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Pasien *</label>
              <input id="kf-nama_pasien" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mahasiswa ID</label>
              <input id="kf-mahasiswa_id" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm" placeholder="mhs-xxxx">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tanggal *</label>
              <input id="kf-tanggal" required type="date" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Keluhan *</label>
            <textarea id="kf-keluhan" required rows="2" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Diagnosa</label>
            <input id="kf-diagnosa" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tindakan</label>
            <textarea id="kf-tindakan" rows="2" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Petugas *</label>
              <input id="kf-petugas" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm" placeholder="dr. / Ns.">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
              <select id="kf-status" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
                <option value="selesai">Selesai</option>
                <option value="dirujuk">Dirujuk</option>
                <option value="dalam_perawatan">Dalam Perawatan</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Catatan</label>
            <textarea id="kf-catatan" rows="2" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm"></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="document.getElementById('kli-form-modal').classList.add('hidden')"
              class="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">Batal</button>
            <button type="submit" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Simpan</button>
          </div>
        </form>
      </div>
    </div>
    `
    loadStats()
    loadData()
  }

  return { render, doSearch, openDetail, openAdd, openEdit, submitForm, hapus }
})()
