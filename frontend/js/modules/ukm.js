// ============================================================
// UKM MODULE — Unit Kegiatan Mahasiswa / Organisasi
// ============================================================
const UKMModule = (() => {

  let currentTab = 'ukm'
  let ukmPage = 1; let anggotaPage = 1; let kegiatanPage = 1
  let ukmFilter = { kategori: '', status: '', search: '' }
  let anggotaFilter = { ukm_id: '', search: '' }
  let kegiatanFilter = { ukm_id: '', jenis: '', status: '' }

  // ── Render ────────────────────────────────────────────────
  const render = () => {
    const main = document.getElementById('page-content')
    main.innerHTML = `
      <div class="p-4 md:p-6 space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">UKM & Organisasi</h1>
          <p class="text-sm text-gray-500">Unit Kegiatan Mahasiswa dan Organisasi Kemahasiswaan</p>
        </div>

        <!-- Stats -->
        <div id="ukm-stats" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"></div>

        <!-- Tabs -->
        <div class="border-b border-gray-200">
          <nav class="flex gap-1 -mb-px">
            ${[['ukm','Daftar UKM'],['anggota','Anggota'],['kegiatan','Kegiatan']].map(([id, label]) => `
              <button onclick="UKMModule.switchTab('${id}')"
                id="ukm-tab-${id}"
                class="ukm-tab px-4 py-2 text-sm font-medium border-b-2 transition-colors ${id === currentTab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}">
                ${label}
              </button>
            `).join('')}
          </nav>
        </div>

        <div id="ukm-tab-content"></div>
      </div>

      ${modalHtml()}
    `
    loadStats()
    renderTab()
  }

  const switchTab = (tab) => {
    currentTab = tab
    document.querySelectorAll('.ukm-tab').forEach(b => {
      const id = b.id.replace('ukm-tab-', '')
      b.className = `ukm-tab px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        id === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`
    })
    renderTab()
  }

  const renderTab = () => {
    if (currentTab === 'ukm') renderUKMTab()
    else if (currentTab === 'anggota') renderAnggotaTab()
    else renderKegiatanTab()
  }

  // ── Stats ─────────────────────────────────────────────────
  const loadStats = async () => {
    try {
      const r = await API.get('/ukm/stats')
      const d = r.data
      const el = document.getElementById('ukm-stats')
      if (!el) return
      el.innerHTML = [
        { label: 'Total UKM', value: d.total_ukm, color: 'blue' },
        { label: 'UKM Aktif', value: d.ukm_aktif, color: 'green' },
        { label: 'Total Anggota', value: d.total_anggota, color: 'purple' },
        { label: 'Total Kegiatan', value: d.total_kegiatan, color: 'yellow' },
        { label: 'Kegiatan Selesai', value: d.kegiatan_selesai, color: 'emerald' },
        { label: 'Kategori', value: d.per_kategori?.length || 0, color: 'orange' },
      ].map(s => `
        <div class="bg-white rounded-xl border p-4 flex flex-col gap-1">
          <span class="text-xs text-gray-500">${s.label}</span>
          <span class="text-2xl font-bold text-${s.color}-600">${s.value}</span>
        </div>
      `).join('')
    } catch {}
  }

  // ── UKM Tab ───────────────────────────────────────────────
  const renderUKMTab = () => {
    document.getElementById('ukm-tab-content').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-wrap gap-2 items-center">
          <input type="text" placeholder="Cari UKM..."
            value="${ukmFilter.search}"
            class="border rounded-lg px-3 py-2 text-sm w-52 focus:ring-2 focus:ring-blue-500"
            oninput="UKMModule.setUKMFilter('search', this.value)">
          <select onchange="UKMModule.setUKMFilter('kategori', this.value)"
            class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
            <option value="">Semua Kategori</option>
            ${['olahraga','seni','penalaran','bela_negara','kerohanian','lainnya'].map(k =>
              `<option value="${k}" ${ukmFilter.kategori===k?'selected':''}>${kategoriLabel(k)}</option>`
            ).join('')}
          </select>
          <select onchange="UKMModule.setUKMFilter('status', this.value)"
            class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
            <option value="">Semua Status</option>
            <option value="aktif" ${ukmFilter.status==='aktif'?'selected':''}>Aktif</option>
            <option value="nonaktif" ${ukmFilter.status==='nonaktif'?'selected':''}>Nonaktif</option>
          </select>
          <button onclick="UKMModule.openCreateUKM()"
            class="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Tambah UKM
          </button>
        </div>

        <div id="ukm-table" class="bg-white rounded-xl border overflow-hidden">
          <div class="flex justify-center py-10 text-gray-400 text-sm">Memuat...</div>
        </div>
        <div id="ukm-pagination" class="flex justify-center gap-2"></div>
      </div>
    `
    loadUKM()
  }

  const setUKMFilter = (key, val) => {
    ukmFilter[key] = val; ukmPage = 1; loadUKM()
  }

  const loadUKM = async () => {
    const el = document.getElementById('ukm-table')
    if (!el) return
    try {
      const params = new URLSearchParams({ page: ukmPage, per_page: 10 })
      if (ukmFilter.kategori) params.set('kategori', ukmFilter.kategori)
      if (ukmFilter.status) params.set('status', ukmFilter.status)
      if (ukmFilter.search) params.set('search', ukmFilter.search)
      const r = await API.get('/ukm?' + params)
      const { data: items, meta } = r
      if (!items?.length) {
        el.innerHTML = '<div class="py-12 text-center text-gray-400 text-sm">Tidak ada UKM</div>'
        document.getElementById('ukm-pagination').innerHTML = ''
        return
      }
      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>${['Nama UKM','Singkatan','Kategori','Ketua','Pembina','Berdiri','Anggota','Status','Aksi'].map(h =>
                `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">${h}</th>`
              ).join('')}</tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${items.map(u => `
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium text-gray-900">${u.nama}</td>
                  <td class="px-4 py-3 text-xs font-mono">${u.singkatan || '—'}</td>
                  <td class="px-4 py-3">${kategoriLabel(u.kategori)}</td>
                  <td class="px-4 py-3 text-xs">${u.ketua_nama || '—'}</td>
                  <td class="px-4 py-3 text-xs">${u.pembina_nama || '—'}</td>
                  <td class="px-4 py-3 text-center">${u.tahun_berdiri || '—'}</td>
                  <td class="px-4 py-3 text-center font-medium text-blue-600">${u.jumlah_anggota}</td>
                  <td class="px-4 py-3">${statusBadge(u.status)}</td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1 flex-wrap">
                      <button onclick="UKMModule.editUKM('${u.id}')"
                        class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200">Edit</button>
                      <button onclick="UKMModule.lihatAnggota('${u.id}')"
                        class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200">Anggota</button>
                      <button onclick="UKMModule.lihatKegiatan('${u.id}')"
                        class="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded hover:bg-purple-200">Kegiatan</button>
                      <button onclick="UKMModule.hapusUKM('${u.id}', '${u.nama}')"
                        class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200">Hapus</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
      renderPagination('ukm-pagination', meta, (p) => { ukmPage = p; loadUKM() })
    } catch (e) {
      el.innerHTML = `<div class="py-8 text-center text-red-500 text-sm">${e.message}</div>`
    }
  }

  // ── Anggota Tab ───────────────────────────────────────────
  const renderAnggotaTab = () => {
    document.getElementById('ukm-tab-content').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-wrap gap-2 items-center">
          <input type="text" placeholder="Cari nama / NIM..."
            value="${anggotaFilter.search}"
            class="border rounded-lg px-3 py-2 text-sm w-52 focus:ring-2 focus:ring-blue-500"
            oninput="UKMModule.setAnggotaFilter('search', this.value)">
          <div id="ukm-select-wrapper"></div>
          <button onclick="UKMModule.openDaftarAnggota()"
            class="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
            </svg>
            Tambah Anggota
          </button>
        </div>
        <div id="anggota-table" class="bg-white rounded-xl border overflow-hidden">
          <div class="flex justify-center py-10 text-gray-400 text-sm">Memuat...</div>
        </div>
        <div id="anggota-pagination" class="flex justify-center gap-2"></div>
      </div>
    `
    loadUKMSelectFilter('ukm-select-wrapper', 'anggota')
    loadAnggota()
  }

  const loadUKMSelectFilter = async (wrapperId, tab) => {
    const el = document.getElementById(wrapperId)
    if (!el) return
    try {
      const r = await API.get('/ukm?per_page=100')
      const items = r.data || []
      const filter = tab === 'anggota' ? anggotaFilter : kegiatanFilter
      el.innerHTML = `
        <select onchange="UKMModule.set${tab === 'anggota' ? 'Anggota' : 'Kegiatan'}Filter('ukm_id', this.value)"
          class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
          <option value="">Semua UKM</option>
          ${items.map(u => `<option value="${u.id}" ${filter.ukm_id===u.id?'selected':''}>${u.nama}</option>`).join('')}
        </select>
      `
    } catch {}
  }

  const setAnggotaFilter = (key, val) => {
    anggotaFilter[key] = val; anggotaPage = 1; loadAnggota()
  }

  const loadAnggota = async () => {
    const el = document.getElementById('anggota-table')
    if (!el) return
    try {
      const params = new URLSearchParams({ page: anggotaPage, per_page: 15 })
      if (anggotaFilter.ukm_id) params.set('ukm_id', anggotaFilter.ukm_id)
      if (anggotaFilter.search) params.set('search', anggotaFilter.search)
      const r = await API.get('/ukm/anggota/list?' + params)
      const { data: items, meta } = r
      if (!items?.length) {
        el.innerHTML = '<div class="py-12 text-center text-gray-400 text-sm">Tidak ada anggota</div>'
        document.getElementById('anggota-pagination').innerHTML = ''
        return
      }
      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>${['NIM','Nama','UKM','Jabatan','Semester','Status','Aksi'].map(h =>
                `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">${h}</th>`
              ).join('')}</tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${items.map(a => `
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-mono text-xs">${a.mahasiswa_nim}</td>
                  <td class="px-4 py-3 font-medium">${a.mahasiswa_nama}</td>
                  <td class="px-4 py-3 text-xs">${a.ukm_nama}</td>
                  <td class="px-4 py-3">${a.jabatan || 'Anggota'}</td>
                  <td class="px-4 py-3 text-xs">${a.semester_aktif || '—'}</td>
                  <td class="px-4 py-3">${anggotaBadge(a.status)}</td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      <button onclick="UKMModule.editAnggota('${a.id}', '${a.jabatan}', '${a.status}')"
                        class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200">Edit</button>
                      <button onclick="UKMModule.hapusAnggota('${a.id}', '${a.mahasiswa_nama}')"
                        class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200">Hapus</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
      renderPagination('anggota-pagination', meta, (p) => { anggotaPage = p; loadAnggota() })
    } catch (e) {
      el.innerHTML = `<div class="py-8 text-center text-red-500 text-sm">${e.message}</div>`
    }
  }

  // ── Kegiatan Tab ──────────────────────────────────────────
  const renderKegiatanTab = () => {
    document.getElementById('ukm-tab-content').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-wrap gap-2 items-center">
          <input type="text" placeholder="Cari kegiatan..."
            value="${kegiatanFilter.search || ''}"
            class="border rounded-lg px-3 py-2 text-sm w-52 focus:ring-2 focus:ring-blue-500"
            oninput="UKMModule.setKegiatanFilter('search', this.value)">
          <div id="ukm-select-wrapper-k"></div>
          <select onchange="UKMModule.setKegiatanFilter('jenis', this.value)"
            class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
            <option value="">Semua Jenis</option>
            ${['lomba','latihan','seminar','sosial','rapat','pentas'].map(j =>
              `<option value="${j}" ${kegiatanFilter.jenis===j?'selected':''}>${jenisLabel(j)}</option>`
            ).join('')}
          </select>
          <select onchange="UKMModule.setKegiatanFilter('status', this.value)"
            class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
            <option value="">Semua Status</option>
            <option value="akan_datang" ${kegiatanFilter.status==='akan_datang'?'selected':''}>Akan Datang</option>
            <option value="selesai" ${kegiatanFilter.status==='selesai'?'selected':''}>Selesai</option>
            <option value="dibatalkan" ${kegiatanFilter.status==='dibatalkan'?'selected':''}>Dibatalkan</option>
          </select>
          <button onclick="UKMModule.openCreateKegiatan()"
            class="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Tambah Kegiatan
          </button>
        </div>
        <div id="kegiatan-table" class="bg-white rounded-xl border overflow-hidden">
          <div class="flex justify-center py-10 text-gray-400 text-sm">Memuat...</div>
        </div>
        <div id="kegiatan-pagination" class="flex justify-center gap-2"></div>
      </div>
    `
    loadUKMSelectFilter('ukm-select-wrapper-k', 'kegiatan')
    loadKegiatan()
  }

  const setKegiatanFilter = (key, val) => {
    kegiatanFilter[key] = val; kegiatanPage = 1; loadKegiatan()
  }

  const loadKegiatan = async () => {
    const el = document.getElementById('kegiatan-table')
    if (!el) return
    try {
      const params = new URLSearchParams({ page: kegiatanPage, per_page: 15 })
      if (kegiatanFilter.ukm_id) params.set('ukm_id', kegiatanFilter.ukm_id)
      if (kegiatanFilter.jenis) params.set('jenis', kegiatanFilter.jenis)
      if (kegiatanFilter.status) params.set('status', kegiatanFilter.status)
      if (kegiatanFilter.search) params.set('search', kegiatanFilter.search)
      const r = await API.get('/ukm/kegiatan/list?' + params)
      const { data: items, meta } = r
      if (!items?.length) {
        el.innerHTML = '<div class="py-12 text-center text-gray-400 text-sm">Tidak ada kegiatan</div>'
        document.getElementById('kegiatan-pagination').innerHTML = ''
        return
      }
      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>${['Nama Kegiatan','UKM','Jenis','Tanggal','Lokasi','Peserta','Status','Aksi'].map(h =>
                `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">${h}</th>`
              ).join('')}</tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${items.map(k => `
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium">${k.nama}</td>
                  <td class="px-4 py-3 text-xs">${k.ukm_nama}</td>
                  <td class="px-4 py-3">${jenisLabel(k.jenis)}</td>
                  <td class="px-4 py-3 text-xs">${k.tanggal ? new Date(k.tanggal).toLocaleDateString('id-ID') : '—'}</td>
                  <td class="px-4 py-3 text-xs">${k.lokasi || '—'}</td>
                  <td class="px-4 py-3 text-center text-xs">
                    ${k.peserta_hadir}/${k.peserta_target}
                  </td>
                  <td class="px-4 py-3">${kegiatanBadge(k.status)}</td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      <button onclick="UKMModule.editKegiatan('${k.id}')"
                        class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200">Edit</button>
                      <button onclick="UKMModule.hapusKegiatan('${k.id}', '${k.nama}')"
                        class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200">Hapus</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
      renderPagination('kegiatan-pagination', meta, (p) => { kegiatanPage = p; loadKegiatan() })
    } catch (e) {
      el.innerHTML = `<div class="py-8 text-center text-red-500 text-sm">${e.message}</div>`
    }
  }

  // ── Quick filter helpers ───────────────────────────────────
  const lihatAnggota = (ukmId) => {
    anggotaFilter.ukm_id = ukmId; anggotaPage = 1
    switchTab('anggota')
  }
  const lihatKegiatan = (ukmId) => {
    kegiatanFilter.ukm_id = ukmId; kegiatanPage = 1
    switchTab('kegiatan')
  }

  // ── Actions ───────────────────────────────────────────────
  const hapusUKM = async (id, nama) => {
    if (!confirm(`Hapus UKM "${nama}"?`)) return
    try {
      await API.delete(`/ukm/${id}`)
      UI.toast('UKM dihapus', 'success')
      loadStats(); loadUKM()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const hapusAnggota = async (id, nama) => {
    if (!confirm(`Hapus ${nama} dari UKM?`)) return
    try {
      await API.delete(`/ukm/anggota/${id}`)
      UI.toast('Anggota dihapus', 'success')
      loadStats(); loadAnggota()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const hapusKegiatan = async (id, nama) => {
    if (!confirm(`Hapus kegiatan "${nama}"?`)) return
    try {
      await API.delete(`/ukm/kegiatan/${id}`)
      UI.toast('Kegiatan dihapus', 'success')
      loadStats(); loadKegiatan()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  // ── Modals ────────────────────────────────────────────────
  const modalHtml = () => `
    <!-- Modal UKM -->
    <div id="modal-ukm" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h3 id="modal-ukm-title" class="font-semibold text-gray-800">UKM</h3>
          <button onclick="UKMModule.closeModal('modal-ukm')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama UKM <span class="text-red-500">*</span></label>
            <input id="ukm-nama" type="text" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Singkatan</label>
              <input id="ukm-singkatan" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="BEM, MAPALA...">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <select id="ukm-kategori" class="w-full border rounded-lg px-3 py-2 text-sm">
                ${['olahraga','seni','penalaran','bela_negara','kerohanian','lainnya'].map(k =>
                  `<option value="${k}">${kategoriLabel(k)}</option>`
                ).join('')}
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Ketua</label>
              <input id="ukm-ketua" type="text" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tahun Berdiri</label>
              <input id="ukm-tahun" type="number" min="1950" max="2030" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="2024">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Pembina</label>
            <input id="ukm-pembina" type="text" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
            <textarea id="ukm-deskripsi" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm"></textarea>
          </div>
          <div id="ukm-status-row" class="hidden">
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select id="ukm-status" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t">
          <button onclick="UKMModule.closeModal('modal-ukm')" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
          <button id="ukm-save-btn" onclick="UKMModule.saveUKM()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Simpan</button>
        </div>
      </div>
    </div>

    <!-- Modal Anggota -->
    <div id="modal-anggota" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between px-6 py-4 border-b">
          <h3 id="modal-anggota-title" class="font-semibold text-gray-800">Tambah Anggota</h3>
          <button onclick="UKMModule.closeModal('modal-anggota')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">UKM <span class="text-red-500">*</span></label>
            <select id="anggota-ukm-id" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih UKM --</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Mahasiswa <span class="text-red-500">*</span></label>
            <select id="anggota-mhs-id" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih mahasiswa --</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Jabatan</label>
              <select id="anggota-jabatan" class="w-full border rounded-lg px-3 py-2 text-sm">
                ${['Ketua','Wakil Ketua','Sekretaris','Bendahara','Anggota'].map(j =>
                  `<option value="${j}">${j}</option>`
                ).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Semester</label>
              <input id="anggota-semester" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="2024/2025-1">
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t">
          <button onclick="UKMModule.closeModal('modal-anggota')" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
          <button id="anggota-save-btn" onclick="UKMModule.saveAnggota()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Daftarkan</button>
        </div>
      </div>
    </div>

    <!-- Modal Edit Anggota -->
    <div id="modal-edit-anggota" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div class="flex items-center justify-between px-6 py-4 border-b">
          <h3 class="font-semibold text-gray-800">Edit Anggota</h3>
          <button onclick="UKMModule.closeModal('modal-edit-anggota')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-6 space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Jabatan</label>
            <select id="edit-anggota-jabatan" class="w-full border rounded-lg px-3 py-2 text-sm">
              ${['Ketua','Wakil Ketua','Sekretaris','Bendahara','Anggota'].map(j =>
                `<option value="${j}">${j}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select id="edit-anggota-status" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t">
          <button onclick="UKMModule.closeModal('modal-edit-anggota')" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
          <button onclick="UKMModule.submitEditAnggota()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Simpan</button>
        </div>
      </div>
    </div>

    <!-- Modal Kegiatan -->
    <div id="modal-kegiatan" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h3 id="modal-kegiatan-title" class="font-semibold text-gray-800">Kegiatan</h3>
          <button onclick="UKMModule.closeModal('modal-kegiatan')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">UKM <span class="text-red-500">*</span></label>
            <select id="keg-ukm-id" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih UKM --</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Kegiatan <span class="text-red-500">*</span></label>
            <input id="keg-nama" type="text" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Jenis</label>
              <select id="keg-jenis" class="w-full border rounded-lg px-3 py-2 text-sm">
                ${['lomba','latihan','seminar','sosial','rapat','pentas'].map(j =>
                  `<option value="${j}">${jenisLabel(j)}</option>`
                ).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tanggal <span class="text-red-500">*</span></label>
              <input id="keg-tanggal" type="date" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
            <input id="keg-lokasi" type="text" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Target Peserta</label>
              <input id="keg-target" type="number" min="0" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
            <div id="keg-hadir-row" class="hidden">
              <label class="block text-sm font-medium text-gray-700 mb-1">Peserta Hadir</label>
              <input id="keg-hadir" type="number" min="0" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div id="keg-status-row" class="hidden">
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select id="keg-status" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="akan_datang">Akan Datang</option>
              <option value="selesai">Selesai</option>
              <option value="dibatalkan">Dibatalkan</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
            <textarea id="keg-deskripsi" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm"></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t">
          <button onclick="UKMModule.closeModal('modal-kegiatan')" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
          <button id="keg-save-btn" onclick="UKMModule.saveKegiatan()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Simpan</button>
        </div>
      </div>
    </div>
  `

  let editingUKMId = null
  let editingAnggotaId = null
  let editingKegiatanId = null

  const openCreateUKM = () => {
    editingUKMId = null
    document.getElementById('modal-ukm-title').textContent = 'Tambah UKM'
    document.getElementById('ukm-status-row').classList.add('hidden')
    ;['ukm-nama','ukm-singkatan','ukm-ketua','ukm-pembina','ukm-deskripsi','ukm-tahun'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value = ''
    })
    document.getElementById('ukm-kategori').value = 'penalaran'
    openModal('modal-ukm')
  }

  const editUKM = async (id) => {
    try {
      const r = await API.get(`/ukm/${id}`)
      const u = r.data
      editingUKMId = id
      document.getElementById('modal-ukm-title').textContent = 'Edit UKM'
      document.getElementById('ukm-status-row').classList.remove('hidden')
      document.getElementById('ukm-nama').value = u.nama || ''
      document.getElementById('ukm-singkatan').value = u.singkatan || ''
      document.getElementById('ukm-kategori').value = u.kategori || 'penalaran'
      document.getElementById('ukm-ketua').value = u.ketua_nama || ''
      document.getElementById('ukm-pembina').value = u.pembina_nama || ''
      document.getElementById('ukm-tahun').value = u.tahun_berdiri || ''
      document.getElementById('ukm-deskripsi').value = u.deskripsi || ''
      document.getElementById('ukm-status').value = u.status || 'aktif'
      openModal('modal-ukm')
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const saveUKM = async () => {
    const nama = document.getElementById('ukm-nama').value.trim()
    if (!nama) return UI.toast('Nama UKM wajib diisi', 'error')
    const btn = document.getElementById('ukm-save-btn')
    btn.disabled = true; btn.textContent = 'Menyimpan...'
    try {
      const payload = {
        nama,
        singkatan: document.getElementById('ukm-singkatan').value.trim(),
        kategori: document.getElementById('ukm-kategori').value,
        ketua_nama: document.getElementById('ukm-ketua').value.trim(),
        pembina_nama: document.getElementById('ukm-pembina').value.trim(),
        tahun_berdiri: parseInt(document.getElementById('ukm-tahun').value) || null,
        deskripsi: document.getElementById('ukm-deskripsi').value.trim(),
        ...(editingUKMId ? { status: document.getElementById('ukm-status').value } : {}),
      }
      if (editingUKMId) {
        await API.put(`/ukm/${editingUKMId}`, payload)
        UI.toast('UKM diperbarui', 'success')
      } else {
        await API.post('/ukm', payload)
        UI.toast('UKM berhasil dibuat', 'success')
      }
      closeModal('modal-ukm')
      loadStats(); loadUKM()
    } catch (e) { UI.toast(e.message, 'error') }
    finally { btn.disabled = false; btn.textContent = 'Simpan' }
  }

  const openDaftarAnggota = async () => {
    editingAnggotaId = null
    try {
      const [ukmR, mhsR] = await Promise.all([
        API.get('/ukm?status=aktif&per_page=100'),
        API.get('/mahasiswa?per_page=200'),
      ])
      const uSelect = document.getElementById('anggota-ukm-id')
      uSelect.innerHTML = '<option value="">-- Pilih UKM --</option>' +
        (ukmR.data || []).map(u => `<option value="${u.id}">${u.nama}</option>`).join('')
      const mSelect = document.getElementById('anggota-mhs-id')
      mSelect.innerHTML = '<option value="">-- Pilih mahasiswa --</option>' +
        (mhsR.data || []).map(m => `<option value="${m.id}">${m.nim} — ${m.nama_lengkap}</option>`).join('')
      document.getElementById('anggota-jabatan').value = 'Anggota'
      document.getElementById('anggota-semester').value = ''
      document.getElementById('modal-anggota-title').textContent = 'Tambah Anggota'
      openModal('modal-anggota')
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const saveAnggota = async () => {
    const ukm_id = document.getElementById('anggota-ukm-id').value
    const mahasiswa_id = document.getElementById('anggota-mhs-id').value
    if (!ukm_id) return UI.toast('Pilih UKM', 'error')
    if (!mahasiswa_id) return UI.toast('Pilih mahasiswa', 'error')
    const btn = document.getElementById('anggota-save-btn')
    btn.disabled = true; btn.textContent = 'Menyimpan...'
    try {
      await API.post(`/ukm/${ukm_id}/daftar`, {
        mahasiswa_id,
        jabatan: document.getElementById('anggota-jabatan').value,
        semester_aktif: document.getElementById('anggota-semester').value.trim(),
      })
      UI.toast('Anggota berhasil didaftarkan', 'success')
      closeModal('modal-anggota')
      loadStats(); loadAnggota()
    } catch (e) { UI.toast(e.message, 'error') }
    finally { btn.disabled = false; btn.textContent = 'Daftarkan' }
  }

  const editAnggota = (id, jabatan, status) => {
    editingAnggotaId = id
    document.getElementById('edit-anggota-jabatan').value = jabatan || 'Anggota'
    document.getElementById('edit-anggota-status').value = status || 'aktif'
    openModal('modal-edit-anggota')
  }

  const submitEditAnggota = async () => {
    try {
      await API.put(`/ukm/anggota/${editingAnggotaId}`, {
        jabatan: document.getElementById('edit-anggota-jabatan').value,
        status: document.getElementById('edit-anggota-status').value,
      })
      UI.toast('Data anggota diperbarui', 'success')
      closeModal('modal-edit-anggota')
      loadAnggota()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const openCreateKegiatan = async () => {
    editingKegiatanId = null
    document.getElementById('modal-kegiatan-title').textContent = 'Tambah Kegiatan'
    document.getElementById('keg-status-row').classList.add('hidden')
    document.getElementById('keg-hadir-row').classList.add('hidden')
    try {
      const r = await API.get('/ukm?status=aktif&per_page=100')
      const sel = document.getElementById('keg-ukm-id')
      sel.innerHTML = '<option value="">-- Pilih UKM --</option>' +
        (r.data || []).map(u => `<option value="${u.id}">${u.nama}</option>`).join('')
    } catch {}
    ;['keg-nama','keg-tanggal','keg-lokasi','keg-deskripsi'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value = ''
    })
    document.getElementById('keg-target').value = ''
    document.getElementById('keg-jenis').value = 'latihan'
    openModal('modal-kegiatan')
  }

  const editKegiatan = async (id) => {
    try {
      const allK = await API.get('/ukm/kegiatan/list?per_page=200')
      const k = (allK.data || []).find(x => x.id === id)
      if (!k) return UI.toast('Data tidak ditemukan', 'error')
      editingKegiatanId = id
      document.getElementById('modal-kegiatan-title').textContent = 'Edit Kegiatan'
      document.getElementById('keg-status-row').classList.remove('hidden')
      document.getElementById('keg-hadir-row').classList.remove('hidden')
      const ukmR = await API.get('/ukm?per_page=100')
      const sel = document.getElementById('keg-ukm-id')
      sel.innerHTML = '<option value="">-- Pilih UKM --</option>' +
        (ukmR.data || []).map(u => `<option value="${u.id}" ${u.id===k.ukm_id?'selected':''}>${u.nama}</option>`).join('')
      document.getElementById('keg-nama').value = k.nama || ''
      document.getElementById('keg-jenis').value = k.jenis || 'latihan'
      document.getElementById('keg-tanggal').value = k.tanggal || ''
      document.getElementById('keg-lokasi').value = k.lokasi || ''
      document.getElementById('keg-target').value = k.peserta_target || ''
      document.getElementById('keg-hadir').value = k.peserta_hadir || ''
      document.getElementById('keg-status').value = k.status || 'akan_datang'
      document.getElementById('keg-deskripsi').value = k.deskripsi || ''
      openModal('modal-kegiatan')
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const saveKegiatan = async () => {
    const ukm_id = document.getElementById('keg-ukm-id').value
    const nama = document.getElementById('keg-nama').value.trim()
    const tanggal = document.getElementById('keg-tanggal').value
    if (!ukm_id) return UI.toast('Pilih UKM', 'error')
    if (!nama) return UI.toast('Nama kegiatan wajib diisi', 'error')
    if (!tanggal) return UI.toast('Tanggal wajib diisi', 'error')
    const btn = document.getElementById('keg-save-btn')
    btn.disabled = true; btn.textContent = 'Menyimpan...'
    try {
      const payload = {
        nama,
        jenis: document.getElementById('keg-jenis').value,
        tanggal,
        lokasi: document.getElementById('keg-lokasi').value.trim(),
        peserta_target: parseInt(document.getElementById('keg-target').value) || 0,
        deskripsi: document.getElementById('keg-deskripsi').value.trim(),
        ...(editingKegiatanId ? {
          peserta_hadir: parseInt(document.getElementById('keg-hadir').value) || 0,
          status: document.getElementById('keg-status').value,
        } : {}),
      }
      if (editingKegiatanId) {
        await API.put(`/ukm/kegiatan/${editingKegiatanId}`, payload)
        UI.toast('Kegiatan diperbarui', 'success')
      } else {
        await API.post(`/ukm/${ukm_id}/kegiatan`, payload)
        UI.toast('Kegiatan berhasil dibuat', 'success')
      }
      closeModal('modal-kegiatan')
      loadStats(); loadKegiatan()
    } catch (e) { UI.toast(e.message, 'error') }
    finally { btn.disabled = false; btn.textContent = 'Simpan' }
  }

  // ── Helpers ───────────────────────────────────────────────
  const openModal = (id) => document.getElementById(id)?.classList.remove('hidden')
  const closeModal = (id) => document.getElementById(id)?.classList.add('hidden')

  const kategoriLabel = (k) => ({
    olahraga: 'Olahraga', seni: 'Seni', penalaran: 'Penalaran',
    bela_negara: 'Bela Negara', kerohanian: 'Kerohanian', lainnya: 'Lainnya',
  })[k] || k

  const jenisLabel = (j) => ({
    lomba: 'Lomba', latihan: 'Latihan', seminar: 'Seminar',
    sosial: 'Sosial', rapat: 'Rapat', pentas: 'Pentas Seni',
  })[j] || j

  const statusBadge = (s) => {
    const map = { aktif: 'bg-green-100 text-green-800', nonaktif: 'bg-gray-100 text-gray-600' }
    const label = { aktif: 'Aktif', nonaktif: 'Nonaktif' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${label[s]||s}</span>`
  }

  const anggotaBadge = (s) => {
    const map = { aktif: 'bg-green-100 text-green-800', nonaktif: 'bg-gray-100 text-gray-600' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${s}</span>`
  }

  const kegiatanBadge = (s) => {
    const map = {
      akan_datang: 'bg-blue-100 text-blue-800',
      selesai: 'bg-emerald-100 text-emerald-800',
      dibatalkan: 'bg-red-100 text-red-800',
    }
    const label = { akan_datang: 'Akan Datang', selesai: 'Selesai', dibatalkan: 'Dibatalkan' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${label[s]||s}</span>`
  }

  const renderPagination = (containerId, meta, onPage) => {
    const el = document.getElementById(containerId)
    if (!el || !meta || meta.total_pages <= 1) { if(el) el.innerHTML = ''; return }
    const cur = meta.page; const total = meta.total_pages
    let pages = []
    if (cur > 1) pages.push(`<button onclick="(${onPage.toString()})(${cur-1})" class="px-3 py-1 text-sm border rounded hover:bg-gray-100">‹</button>`)
    for (let p = Math.max(1, cur-2); p <= Math.min(total, cur+2); p++) {
      pages.push(`<button onclick="(${onPage.toString()})(${p})" class="px-3 py-1 text-sm border rounded ${p===cur?'bg-blue-600 text-white':'hover:bg-gray-100'}">${p}</button>`)
    }
    if (cur < total) pages.push(`<button onclick="(${onPage.toString()})(${cur+1})" class="px-3 py-1 text-sm border rounded hover:bg-gray-100">›</button>`)
    el.innerHTML = pages.join('')
  }

  return {
    render, switchTab,
    setUKMFilter, setAnggotaFilter, setKegiatanFilter,
    openCreateUKM, editUKM, saveUKM, hapusUKM,
    lihatAnggota, lihatKegiatan,
    openDaftarAnggota, saveAnggota, editAnggota, submitEditAnggota, hapusAnggota,
    openCreateKegiatan, editKegiatan, saveKegiatan, hapusKegiatan,
    closeModal,
  }
})()
