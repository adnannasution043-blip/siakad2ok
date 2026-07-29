// Perpustakaan Module
const PerpustakaanModule = (() => {
  const API = '/api/v1/perpustakaan'
  let activeTab = 'koleksi'
  let currentKoleksiId = null
  let currentPinjamId = null

  // ── Helpers ────────────────────────────────────────────────────────────────

  const statusBadge = (s) => {
    const map = {
      dipinjam: 'bg-yellow-100 text-yellow-800',
      dikembalikan: 'bg-green-100 text-green-800',
      terlambat: 'bg-red-100 text-red-800',
    }
    const label = { dipinjam: 'Dipinjam', dikembalikan: 'Dikembalikan', terlambat: 'Terlambat' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || 'bg-slate-100 text-slate-700'}">${label[s] || s}</span>`
  }

  const stokBadge = (tersedia, total) => {
    const cls = tersedia === 0 ? 'bg-red-100 text-red-700' : tersedia <= 1 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${cls}">${tersedia}/${total}</span>`
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
  const fmtRupiah = (v) => 'Rp ' + Number(v || 0).toLocaleString('id-ID')

  const isTerlambat = (tgl_estimasi) => {
    if (!tgl_estimasi) return false
    return new Date(tgl_estimasi) < new Date()
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const loadStats = async () => {
    try {
      const r = await fetch(`${API}/stats`)
      const j = await r.json()
      const d = j.data || {}
      document.getElementById('perp-stat-koleksi').textContent = d.total_koleksi ?? 0
      document.getElementById('perp-stat-eksemplar').textContent = d.total_eksemplar ?? 0
      document.getElementById('perp-stat-tersedia').textContent = d.tersedia ?? 0
      document.getElementById('perp-stat-dipinjam').textContent = d.sedang_dipinjam ?? 0
      document.getElementById('perp-stat-terlambat').textContent = d.terlambat_kembali ?? 0
      document.getElementById('perp-stat-denda').textContent = fmtRupiah(d.total_denda)
    } catch (e) { console.error(e) }
  }

  // ── Koleksi Tab ────────────────────────────────────────────────────────────

  const loadKoleksi = async (params = {}) => {
    const tbody = document.getElementById('perp-koleksi-tbody')
    if (!tbody) return
    try {
      const qs = new URLSearchParams({ per_page: 50, ...params }).toString()
      const r = await fetch(`${API}/koleksi?${qs}`)
      const j = await r.json()
      const items = j.data || []
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-slate-400">Belum ada koleksi</td></tr>'
        return
      }
      tbody.innerHTML = items.map(b => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30">
          <td class="px-4 py-3 font-mono text-xs text-slate-500">${b.isbn || '-'}</td>
          <td class="px-4 py-3">
            <div class="font-medium text-sm">${b.judul}</div>
            <div class="text-xs text-slate-400">${b.penulis}</div>
          </td>
          <td class="px-4 py-3 text-sm">${b.penerbit}</td>
          <td class="px-4 py-3 text-sm">${b.tahun}</td>
          <td class="px-4 py-3 text-sm">${b.kategori || '-'}</td>
          <td class="px-4 py-3 text-sm">${b.lokasi_rak || '-'}</td>
          <td class="px-4 py-3">${stokBadge(b.stok_tersedia, b.stok_total)}</td>
          <td class="px-4 py-3">
            <div class="flex gap-1">
              <button onclick="PerpustakaanModule.openEditKoleksi('${b.id}')" class="px-2 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded">Edit</button>
              <button onclick="PerpustakaanModule.hapusKoleksi('${b.id}','${b.judul.replace(/'/g,"\\'")}') " class="px-2 py-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded">Hapus</button>
            </div>
          </td>
        </tr>`).join('')
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-red-400">Gagal memuat data</td></tr>'
    }
  }

  const openAddKoleksi = () => {
    currentKoleksiId = null
    document.getElementById('kol-form-title').textContent = 'Tambah Koleksi'
    document.getElementById('kol-form').reset()
    document.getElementById('kol-form-modal')?.classList.remove('hidden')
  }

  const openEditKoleksi = async (id) => {
    const r = await fetch(`${API}/koleksi/${id}`)
    const j = await r.json()
    const b = j.data
    if (!b) return
    currentKoleksiId = id
    document.getElementById('kol-form-title').textContent = 'Edit Koleksi'
    const fields = ['isbn', 'judul', 'penulis', 'penerbit', 'tahun', 'kategori', 'stok_total', 'stok_tersedia', 'lokasi_rak']
    fields.forEach(f => { const el = document.getElementById(`kolf-${f}`); if (el) el.value = b[f] || '' })
    document.getElementById('kol-form-modal')?.classList.remove('hidden')
  }

  const submitKoleksiForm = async (e) => {
    e.preventDefault()
    const body = {
      isbn: document.getElementById('kolf-isbn')?.value,
      judul: document.getElementById('kolf-judul')?.value,
      penulis: document.getElementById('kolf-penulis')?.value,
      penerbit: document.getElementById('kolf-penerbit')?.value,
      tahun: document.getElementById('kolf-tahun')?.value,
      kategori: document.getElementById('kolf-kategori')?.value,
      stok_total: document.getElementById('kolf-stok_total')?.value,
      stok_tersedia: document.getElementById('kolf-stok_tersedia')?.value,
      lokasi_rak: document.getElementById('kolf-lokasi_rak')?.value,
    }
    try {
      const url = currentKoleksiId ? `${API}/koleksi/${currentKoleksiId}` : `${API}/koleksi`
      const method = currentKoleksiId ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (!j.success) { UI.toast(j.message || 'Gagal', 'error'); return }
      UI.toast(j.message || 'Berhasil', 'success')
      document.getElementById('kol-form-modal')?.classList.add('hidden')
      loadKoleksi()
      loadStats()
    } catch (err) { UI.toast('Error: ' + err.message, 'error') }
  }

  const hapusKoleksi = async (id, judul) => {
    if (!confirm(`Hapus koleksi "${judul}"?`)) return
    const r = await fetch(`${API}/koleksi/${id}`, { method: 'DELETE' })
    const j = await r.json()
    UI.toast(j.message || 'Dihapus', j.success ? 'success' : 'error')
    if (j.success) { loadKoleksi(); loadStats() }
  }

  // ── Peminjaman Tab ─────────────────────────────────────────────────────────

  const loadPeminjaman = async (params = {}) => {
    const tbody = document.getElementById('perp-pinjam-tbody')
    if (!tbody) return
    try {
      const qs = new URLSearchParams({ per_page: 50, ...params }).toString()
      const r = await fetch(`${API}/peminjaman?${qs}`)
      const j = await r.json()
      const items = j.data || []
      const today = new Date().toISOString().split('T')[0]
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-slate-400">Belum ada data peminjaman</td></tr>'
        return
      }
      tbody.innerHTML = items.map(p => {
        const terlambat = p.status === 'dipinjam' && p.tgl_kembali_estimasi < today
        const statusLabel = terlambat ? 'terlambat' : p.status
        return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 ${terlambat ? 'bg-red-50/50 dark:bg-red-900/10' : ''}">
          <td class="px-4 py-3">
            <div class="font-medium text-sm">${p.judul_buku}</div>
          </td>
          <td class="px-4 py-3">
            <div class="text-sm">${p.mahasiswa_nama}</div>
            <div class="text-xs text-slate-400 font-mono">${p.mahasiswa_nim}</div>
          </td>
          <td class="px-4 py-3 text-sm">${fmtDate(p.tgl_pinjam)}</td>
          <td class="px-4 py-3 text-sm ${terlambat ? 'text-red-600 font-medium' : ''}">${fmtDate(p.tgl_kembali_estimasi)}</td>
          <td class="px-4 py-3 text-sm">${p.tgl_kembali_aktual ? fmtDate(p.tgl_kembali_aktual) : '-'}</td>
          <td class="px-4 py-3">${statusBadge(statusLabel)}</td>
          <td class="px-4 py-3 text-sm ${p.denda ? 'text-red-600 font-medium' : ''}">${p.denda ? fmtRupiah(p.denda) : '-'}</td>
          <td class="px-4 py-3">
            ${p.status === 'dipinjam' ? `<button onclick="PerpustakaanModule.kembalikanBuku('${p.id}','${p.judul_buku.replace(/'/g,"\\'")}') " class="px-2 py-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 rounded">Kembalikan</button>` : '<span class="text-xs text-slate-400">Selesai</span>'}
          </td>
        </tr>`
      }).join('')
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-red-400">Gagal memuat data</td></tr>'
    }
  }

  const openAddPeminjaman = () => {
    currentPinjamId = null
    document.getElementById('pjm-form').reset()
    const today = new Date().toISOString().split('T')[0]
    const tglEl = document.getElementById('pjmf-tgl_pinjam')
    if (tglEl) tglEl.value = today
    document.getElementById('pjm-form-modal')?.classList.remove('hidden')
  }

  const submitPinjamForm = async (e) => {
    e.preventDefault()
    const body = {
      buku_id: document.getElementById('pjmf-buku_id')?.value,
      mahasiswa_id: document.getElementById('pjmf-mahasiswa_id')?.value,
      mahasiswa_nama: document.getElementById('pjmf-mahasiswa_nama')?.value,
      mahasiswa_nim: document.getElementById('pjmf-mahasiswa_nim')?.value,
      tgl_pinjam: document.getElementById('pjmf-tgl_pinjam')?.value,
    }
    try {
      const r = await fetch(`${API}/peminjaman`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (!j.success) { UI.toast(j.message || 'Gagal', 'error'); return }
      UI.toast(j.message || 'Peminjaman dicatat', 'success')
      document.getElementById('pjm-form-modal')?.classList.add('hidden')
      loadPeminjaman()
      loadKoleksi()
      loadStats()
    } catch (err) { UI.toast('Error: ' + err.message, 'error') }
  }

  const kembalikanBuku = async (id, judul) => {
    if (!confirm(`Kembalikan buku "${judul}"?`)) return
    const today = new Date().toISOString().split('T')[0]
    const r = await fetch(`${API}/peminjaman/${id}/kembali`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tgl_kembali_aktual: today })
    })
    const j = await r.json()
    UI.toast(j.message || 'Dikembalikan', j.success ? 'success' : 'error')
    if (j.success) { loadPeminjaman(); loadKoleksi(); loadStats() }
  }

  // ── Tab Switching ───────────────────────────────────────────────────────────

  const switchTab = (tab) => {
    activeTab = tab
    const tabs = ['koleksi', 'peminjaman']
    tabs.forEach(t => {
      const btn = document.getElementById(`perp-tab-${t}`)
      const pane = document.getElementById(`perp-pane-${t}`)
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
    document.getElementById('perp-btn-add-koleksi')?.classList.toggle('hidden', tab !== 'koleksi')
    document.getElementById('perp-btn-add-pinjam')?.classList.toggle('hidden', tab !== 'peminjaman')
    if (tab === 'koleksi') loadKoleksi()
    if (tab === 'peminjaman') loadPeminjaman()
  }

  const doSearch = () => {
    const search = document.getElementById('perp-search')?.value
    const kategori = document.getElementById('perp-filter-kategori')?.value
    const tersedia = document.getElementById('perp-filter-tersedia')?.value
    const params = { search }
    if (kategori) params.kategori = kategori
    if (tersedia === 'ya') params.tersedia = true
    if (tersedia === 'tidak') params.tersedia = false
    loadKoleksi(params)
  }

  const doSearchPinjam = () => {
    const search = document.getElementById('perp-search-pinjam')?.value
    const status = document.getElementById('perp-filter-status-pinjam')?.value
    loadPeminjaman({ search, status })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const render = () => {
    const el = document.getElementById('page-content')
    Router.setPageMeta('Perpustakaan', 'Manajemen koleksi dan peminjaman buku')
    if (!el) return
    el.innerHTML = `
    <div class="p-6 space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">Perpustakaan</h1>
          <p class="text-sm text-slate-500 mt-0.5">Manajemen koleksi buku dan peminjaman</p>
        </div>
        <div class="flex gap-2">
          <button id="perp-btn-add-koleksi" onclick="PerpustakaanModule.openAddKoleksi()" class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">+ Tambah Koleksi</button>
          <button id="perp-btn-add-pinjam" onclick="PerpustakaanModule.openAddPeminjaman()" class="hidden px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium">+ Catat Peminjaman</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        ${[
          ['perp-stat-koleksi', 'Total Koleksi', '📚'],
          ['perp-stat-eksemplar', 'Total Eksemplar', '📖'],
          ['perp-stat-tersedia', 'Tersedia', '✅'],
          ['perp-stat-dipinjam', 'Dipinjam', '🔖'],
          ['perp-stat-terlambat', 'Terlambat', '⚠️'],
          ['perp-stat-denda', 'Total Denda', '💰'],
        ].map(([id, label, icon]) => `
          <div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
            <div class="text-2xl mb-1">${icon}</div>
            <div id="${id}" class="text-xl font-bold text-slate-800 dark:text-slate-100">-</div>
            <div class="text-xs text-slate-500 mt-0.5">${label}</div>
          </div>`).join('')}
      </div>

      <!-- Tabs -->
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div class="flex border-b border-slate-200 dark:border-slate-700 px-4">
          <button id="perp-tab-koleksi" onclick="PerpustakaanModule.switchTab('koleksi')"
            class="py-3 px-4 text-sm font-medium border-b-2 border-blue-600 text-blue-600 -mb-px">Koleksi Buku</button>
          <button id="perp-tab-peminjaman" onclick="PerpustakaanModule.switchTab('peminjaman')"
            class="py-3 px-4 text-sm font-medium text-slate-500 hover:text-slate-700 -mb-px">Peminjaman</button>
        </div>

        <!-- Koleksi Pane -->
        <div id="perp-pane-koleksi" class="p-4">
          <div class="flex flex-wrap gap-2 mb-4">
            <input id="perp-search" type="text" placeholder="Cari judul / penulis / ISBN..."
              class="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm w-64"
              oninput="PerpustakaanModule.doSearch()">
            <select id="perp-filter-kategori" onchange="PerpustakaanModule.doSearch()"
              class="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
              <option value="">Semua Kategori</option>
              <option>Teknologi</option><option>Matematika</option><option>Ekonomi</option>
              <option>Hukum</option><option>Sosial</option><option>Umum</option>
            </select>
            <select id="perp-filter-tersedia" onchange="PerpustakaanModule.doSearch()"
              class="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
              <option value="">Semua Stok</option>
              <option value="ya">Tersedia</option>
              <option value="tidak">Habis</option>
            </select>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">ISBN</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Judul / Penulis</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Penerbit</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Tahun</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Kategori</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Rak</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Stok</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Aksi</th>
                </tr>
              </thead>
              <tbody id="perp-koleksi-tbody" class="divide-y divide-slate-100 dark:divide-slate-700">
                <tr><td colspan="8" class="text-center py-10 text-slate-400">Memuat data...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Peminjaman Pane -->
        <div id="perp-pane-peminjaman" class="p-4 hidden">
          <div class="flex flex-wrap gap-2 mb-4">
            <input id="perp-search-pinjam" type="text" placeholder="Cari judul / nama / NIM..."
              class="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm w-64"
              oninput="PerpustakaanModule.doSearchPinjam()">
            <select id="perp-filter-status-pinjam" onchange="PerpustakaanModule.doSearchPinjam()"
              class="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
              <option value="">Semua Status</option>
              <option value="dipinjam">Dipinjam</option>
              <option value="dikembalikan">Dikembalikan</option>
            </select>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Judul Buku</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Peminjam</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Tgl Pinjam</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Est. Kembali</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Tgl Kembali</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Status</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Denda</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-300">Aksi</th>
                </tr>
              </thead>
              <tbody id="perp-pinjam-tbody" class="divide-y divide-slate-100 dark:divide-slate-700">
                <tr><td colspan="8" class="text-center py-10 text-slate-400">Memuat data...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Koleksi Form Modal -->
    <div id="kol-form-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h3 id="kol-form-title" class="text-lg font-semibold">Tambah Koleksi</h3>
          <button onclick="document.getElementById('kol-form-modal').classList.add('hidden')"
            class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form id="kol-form" onsubmit="PerpustakaanModule.submitKoleksiForm(event)" class="p-5 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ISBN</label>
              <input id="kolf-isbn" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tahun *</label>
              <input id="kolf-tahun" required type="number" min="1900" max="2030" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Judul *</label>
              <input id="kolf-judul" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Penulis *</label>
              <input id="kolf-penulis" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Penerbit *</label>
              <input id="kolf-penerbit" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kategori</label>
              <select id="kolf-kategori" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
                <option value="Umum">Umum</option>
                <option value="Teknologi">Teknologi</option>
                <option value="Matematika">Matematika</option>
                <option value="Ekonomi">Ekonomi</option>
                <option value="Hukum">Hukum</option>
                <option value="Sosial">Sosial</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Lokasi Rak</label>
              <input id="kolf-lokasi_rak" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm" placeholder="Rak A-1">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stok Total</label>
              <input id="kolf-stok_total" type="number" min="1" value="1" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stok Tersedia</label>
              <input id="kolf-stok_tersedia" type="number" min="0" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="document.getElementById('kol-form-modal').classList.add('hidden')"
              class="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">Batal</button>
            <button type="submit" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Simpan</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Peminjaman Form Modal -->
    <div id="pjm-form-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold">Catat Peminjaman</h3>
          <button onclick="document.getElementById('pjm-form-modal').classList.add('hidden')"
            class="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form id="pjm-form" onsubmit="PerpustakaanModule.submitPinjamForm(event)" class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ID Buku *</label>
            <input id="pjmf-buku_id" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm" placeholder="buku-xxxx">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mahasiswa ID *</label>
            <input id="pjmf-mahasiswa_id" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm" placeholder="mhs-xxxx">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Peminjam *</label>
            <input id="pjmf-mahasiswa_nama" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">NIM *</label>
            <input id="pjmf-mahasiswa_nim" required class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tanggal Pinjam *</label>
            <input id="pjmf-tgl_pinjam" required type="date" class="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-sm">
          </div>
          <p class="text-xs text-slate-400">Batas pengembalian otomatis 14 hari. Denda keterlambatan Rp 1.000/hari.</p>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="document.getElementById('pjm-form-modal').classList.add('hidden')"
              class="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">Batal</button>
            <button type="submit" class="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Catat Peminjaman</button>
          </div>
        </form>
      </div>
    </div>
    `
    loadStats()
    loadKoleksi()
  }

  return {
    render, switchTab, doSearch, doSearchPinjam,
    openAddKoleksi, openEditKoleksi, submitKoleksiForm, hapusKoleksi,
    openAddPeminjaman, submitPinjamForm, kembalikanBuku,
  }
})()
