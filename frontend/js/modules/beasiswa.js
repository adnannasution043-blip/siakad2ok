// ============================================================
// BEASISWA MODULE
// ============================================================
const BeasiswaModule = (() => {

  let currentTab = 'program'
  let programPage = 1
  let daftarPage = 1
  let programFilter = { status: '', jenis: '', search: '' }
  let daftarFilter = { beasiswa_id: '', status: '', search: '' }

  // ── Render ────────────────────────────────────────────────
  const render = () => {
    const app = document.getElementById('page-content')
    Router.setPageMeta('Beasiswa', 'Manajemen program beasiswa mahasiswa')
    app.innerHTML = `
      <div class="p-4 md:p-6 space-y-6">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 class="text-2xl font-bold text-gray-800">Beasiswa</h1>
            <p class="text-sm text-gray-500">Manajemen program dan pendaftaran beasiswa</p>
          </div>
        </div>

        <!-- Stats -->
        <div id="beasiswa-stats" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"></div>

        <!-- Tabs -->
        <div class="border-b border-gray-200">
          <nav class="flex gap-1 -mb-px">
            ${[
              ['program', 'Program Beasiswa'],
              ['pendaftar', 'Pendaftar'],
            ].map(([id, label]) => `
              <button onclick="BeasiswaModule.switchTab('${id}')"
                id="tab-btn-${id}"
                class="tab-btn px-4 py-2 text-sm font-medium border-b-2 transition-colors ${id === currentTab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}">
                ${label}
              </button>
            `).join('')}
          </nav>
        </div>

        <div id="tab-content"></div>
      </div>

      ${modalHtml()}
    `
    loadStats()
    renderTab()
  }

  const switchTab = (tab) => {
    currentTab = tab
    document.querySelectorAll('.tab-btn').forEach(b => {
      const id = b.id.replace('tab-btn-', '')
      b.className = `tab-btn px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        id === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`
    })
    renderTab()
  }

  const renderTab = () => {
    if (currentTab === 'program') renderProgram()
    else renderPendaftar()
  }

  // ── Stats ─────────────────────────────────────────────────
  const loadStats = async () => {
    try {
      const r = await API.get('/beasiswa/stats')
      const d = r.data
      const el = document.getElementById('beasiswa-stats')
      if (!el) return
      el.innerHTML = [
        { label: 'Total Program', value: d.total_program, color: 'blue' },
        { label: 'Program Buka', value: d.program_buka, color: 'green' },
        { label: 'Total Pendaftar', value: d.total_pendaftar, color: 'purple' },
        { label: 'Menunggu', value: d.menunggu, color: 'yellow' },
        { label: 'Diterima', value: d.diterima, color: 'emerald' },
        { label: 'Ditolak', value: d.ditolak, color: 'red' },
      ].map(s => `
        <div class="bg-white rounded-xl border p-4 flex flex-col gap-1">
          <span class="text-xs text-gray-500">${s.label}</span>
          <span class="text-2xl font-bold text-${s.color}-600">${s.value}</span>
        </div>
      `).join('')
    } catch {}
  }

  // ── Program Tab ───────────────────────────────────────────
  const renderProgram = () => {
    document.getElementById('tab-content').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-wrap gap-2 items-center">
          <input id="prog-search" type="text" placeholder="Cari nama program..."
            value="${programFilter.search}"
            class="border rounded-lg px-3 py-2 text-sm w-56 focus:ring-2 focus:ring-blue-500"
            oninput="BeasiswaModule.setProgFilter('search', this.value)">
          <select id="prog-status" onchange="BeasiswaModule.setProgFilter('status', this.value)"
            class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
            <option value="">Semua Status</option>
            <option value="buka" ${programFilter.status==='buka'?'selected':''}>Buka</option>
            <option value="tutup" ${programFilter.status==='tutup'?'selected':''}>Tutup</option>
          </select>
          <select id="prog-jenis" onchange="BeasiswaModule.setProgFilter('jenis', this.value)"
            class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
            <option value="">Semua Jenis</option>
            <option value="prestasi" ${programFilter.jenis==='prestasi'?'selected':''}>Prestasi</option>
            <option value="kurang_mampu" ${programFilter.jenis==='kurang_mampu'?'selected':''}>Kurang Mampu</option>
            <option value="umum" ${programFilter.jenis==='umum'?'selected':''}>Umum</option>
          </select>
          <button onclick="BeasiswaModule.openCreateProgram()"
            class="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Tambah Program
          </button>
        </div>
        <div id="program-table" class="bg-white rounded-xl border overflow-hidden">
          <div class="flex justify-center py-10 text-gray-400 text-sm">Memuat...</div>
        </div>
        <div id="program-pagination" class="flex justify-center gap-2"></div>
      </div>
    `
    loadProgram()
  }

  const setProgFilter = (key, val) => {
    programFilter[key] = val
    programPage = 1
    loadProgram()
  }

  const loadProgram = async () => {
    const el = document.getElementById('program-table')
    if (!el) return
    try {
      const params = new URLSearchParams({ page: programPage, per_page: 10 })
      if (programFilter.status) params.set('status', programFilter.status)
      if (programFilter.jenis) params.set('jenis', programFilter.jenis)
      if (programFilter.search) params.set('search', programFilter.search)

      const r = await API.get('/beasiswa?' + params)
      const { data: items, meta } = r
      if (!items?.length) {
        el.innerHTML = '<div class="py-12 text-center text-gray-400 text-sm">Tidak ada program beasiswa</div>'
        document.getElementById('program-pagination').innerHTML = ''
        return
      }
      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>
                ${['Nama Program','Jenis','Kuota','IPK Min','Besaran','Periode','Pendaftar','Diterima','Status','Aksi'].map(h =>
                  `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">${h}</th>`
                ).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${items.map(b => `
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium text-gray-900">${b.nama}</td>
                  <td class="px-4 py-3">${jenisLabel(b.jenis)}</td>
                  <td class="px-4 py-3">${b.kuota || '-'}</td>
                  <td class="px-4 py-3">${b.nilai_min_ipk ?? '-'}</td>
                  <td class="px-4 py-3">${b.besaran ? 'Rp ' + b.besaran.toLocaleString('id-ID') : '-'}</td>
                  <td class="px-4 py-3 text-xs">${b.periode || '-'}</td>
                  <td class="px-4 py-3 text-center">${b.jumlah_pendaftar}</td>
                  <td class="px-4 py-3 text-center text-emerald-600 font-medium">${b.jumlah_diterima}</td>
                  <td class="px-4 py-3">${statusBadge(b.status)}</td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      <button onclick="BeasiswaModule.editProgram('${b.id}')"
                        class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200">Edit</button>
                      <button onclick="BeasiswaModule.toggleStatus('${b.id}', '${b.status}')"
                        class="px-2 py-1 text-xs ${b.status==='buka' ? 'bg-orange-100 text-orange-800 hover:bg-orange-200' : 'bg-green-100 text-green-800 hover:bg-green-200'} rounded">
                        ${b.status==='buka' ? 'Tutup' : 'Buka'}
                      </button>
                      <button onclick="BeasiswaModule.lihatPendaftar('${b.id}')"
                        class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200">Pendaftar</button>
                      <button onclick="BeasiswaModule.hapusProgram('${b.id}', '${b.nama}')"
                        class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200">Hapus</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
      renderPagination('program-pagination', meta, (p) => { programPage = p; loadProgram() })
    } catch (e) {
      el.innerHTML = `<div class="py-8 text-center text-red-500 text-sm">${e.message}</div>`
    }
  }

  // ── Pendaftar Tab ─────────────────────────────────────────
  const renderPendaftar = () => {
    document.getElementById('tab-content').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-wrap gap-2 items-center">
          <input id="daf-search" type="text" placeholder="Cari nama / NIM..."
            value="${daftarFilter.search}"
            class="border rounded-lg px-3 py-2 text-sm w-56 focus:ring-2 focus:ring-blue-500"
            oninput="BeasiswaModule.setDafFilter('search', this.value)">
          <select onchange="BeasiswaModule.setDafFilter('status', this.value)"
            class="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
            <option value="">Semua Status</option>
            <option value="menunggu" ${daftarFilter.status==='menunggu'?'selected':''}>Menunggu</option>
            <option value="diterima" ${daftarFilter.status==='diterima'?'selected':''}>Diterima</option>
            <option value="ditolak" ${daftarFilter.status==='ditolak'?'selected':''}>Ditolak</option>
          </select>
          <button onclick="BeasiswaModule.openDaftar()"
            class="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Daftarkan Mahasiswa
          </button>
        </div>
        <div id="daftar-table" class="bg-white rounded-xl border overflow-hidden">
          <div class="flex justify-center py-10 text-gray-400 text-sm">Memuat...</div>
        </div>
        <div id="daftar-pagination" class="flex justify-center gap-2"></div>
      </div>
    `
    loadDaftar()
  }

  const setDafFilter = (key, val) => {
    daftarFilter[key] = val
    daftarPage = 1
    loadDaftar()
  }

  const loadDaftar = async () => {
    const el = document.getElementById('daftar-table')
    if (!el) return
    try {
      const params = new URLSearchParams({ page: daftarPage, per_page: 15 })
      if (daftarFilter.status) params.set('status', daftarFilter.status)
      if (daftarFilter.beasiswa_id) params.set('beasiswa_id', daftarFilter.beasiswa_id)
      if (daftarFilter.search) params.set('search', daftarFilter.search)

      const r = await API.get('/beasiswa/daftar/list?' + params)
      const { data: items, meta } = r
      if (!items?.length) {
        el.innerHTML = '<div class="py-12 text-center text-gray-400 text-sm">Tidak ada data pendaftar</div>'
        document.getElementById('daftar-pagination').innerHTML = ''
        return
      }
      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>
                ${['NIM','Nama Mahasiswa','Program Beasiswa','IPK','Semester','Tgl Daftar','Status','Aksi'].map(h =>
                  `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">${h}</th>`
                ).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${items.map(d => `
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-mono text-xs">${d.mahasiswa_nim}</td>
                  <td class="px-4 py-3 font-medium">${d.mahasiswa_nama}</td>
                  <td class="px-4 py-3 text-xs">${d.beasiswa_nama}</td>
                  <td class="px-4 py-3 text-center">${d.ipk ?? '-'}</td>
                  <td class="px-4 py-3 text-xs">${d.semester_akademik || '-'}</td>
                  <td class="px-4 py-3 text-xs">${d.tgl_daftar ? new Date(d.tgl_daftar).toLocaleDateString('id-ID') : '-'}</td>
                  <td class="px-4 py-3">${daftarBadge(d.status)}</td>
                  <td class="px-4 py-3">
                    ${d.status === 'menunggu' ? `
                      <div class="flex gap-1">
                        <button onclick="BeasiswaModule.setujuiPendaftar('${d.id}')"
                          class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200">Terima</button>
                        <button onclick="BeasiswaModule.openTolak('${d.id}')"
                          class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200">Tolak</button>
                      </div>
                    ` : `<span class="text-gray-400 text-xs">—</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
      renderPagination('daftar-pagination', meta, (p) => { daftarPage = p; loadDaftar() })
    } catch (e) {
      el.innerHTML = `<div class="py-8 text-center text-red-500 text-sm">${e.message}</div>`
    }
  }

  // ── Actions ───────────────────────────────────────────────
  const lihatPendaftar = (beasiswaId) => {
    daftarFilter.beasiswa_id = beasiswaId
    daftarFilter.status = ''
    daftarPage = 1
    switchTab('pendaftar')
  }

  const toggleStatus = async (id, current) => {
    const next = current === 'buka' ? 'tutup' : 'buka'
    if (!confirm(`Ubah status menjadi "${next}"?`)) return
    try {
      await API.put(`/beasiswa/${id}`, { status: next })
      UI.toast('Status diperbarui', 'success')
      loadStats()
      loadProgram()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const hapusProgram = async (id, nama) => {
    if (!confirm(`Hapus program "${nama}"?`)) return
    try {
      await API.delete(`/beasiswa/${id}`)
      UI.toast('Program dihapus', 'success')
      loadStats()
      loadProgram()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const setujuiPendaftar = async (id) => {
    if (!confirm('Terima pendaftaran ini?')) return
    try {
      await API.post(`/beasiswa/daftar/${id}/setujui`)
      UI.toast('Pendaftaran diterima', 'success')
      loadStats()
      loadDaftar()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  // ── Modals ────────────────────────────────────────────────
  const modalHtml = () => `
    <!-- Modal Program -->
    <div id="modal-program" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div class="flex items-center justify-between px-6 py-4 border-b">
          <h3 id="modal-program-title" class="font-semibold text-gray-800">Program Beasiswa</h3>
          <button onclick="BeasiswaModule.closeModal('modal-program')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Program <span class="text-red-500">*</span></label>
            <input id="prog-nama" type="text" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" placeholder="Nama program beasiswa">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Jenis</label>
              <select id="prog-jenis-input" class="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="umum">Umum</option>
                <option value="prestasi">Prestasi</option>
                <option value="kurang_mampu">Kurang Mampu</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Kuota</label>
              <input id="prog-kuota" type="number" min="0" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0 = unlimited">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">IPK Minimum</label>
              <input id="prog-ipk" type="number" step="0.01" min="0" max="4" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0.00">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Besaran (Rp)</label>
              <input id="prog-besaran" type="number" min="0" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Periode</label>
            <input id="prog-periode" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Contoh: 2024/2025 Ganjil">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Syarat</label>
            <textarea id="prog-syarat" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Deskripsi syarat pendaftaran..."></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t">
          <button onclick="BeasiswaModule.closeModal('modal-program')" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
          <button id="prog-save-btn" onclick="BeasiswaModule.saveProgram()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Simpan</button>
        </div>
      </div>
    </div>

    <!-- Modal Daftar -->
    <div id="modal-daftar" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div class="flex items-center justify-between px-6 py-4 border-b">
          <h3 class="font-semibold text-gray-800">Daftarkan Mahasiswa</h3>
          <button onclick="BeasiswaModule.closeModal('modal-daftar')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Program Beasiswa <span class="text-red-500">*</span></label>
            <select id="daf-beasiswa-id" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih program --</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Mahasiswa <span class="text-red-500">*</span></label>
            <select id="daf-mahasiswa-id" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih mahasiswa --</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Semester Akademik</label>
            <input id="daf-semester" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Contoh: 2024/2025 Ganjil">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Alasan / Motivasi</label>
            <textarea id="daf-alasan" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Alasan mendaftar beasiswa..."></textarea>
          </div>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t">
          <button onclick="BeasiswaModule.closeModal('modal-daftar')" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
          <button onclick="BeasiswaModule.saveDaftar()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Daftarkan</button>
        </div>
      </div>
    </div>

    <!-- Modal Tolak -->
    <div id="modal-tolak" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between px-6 py-4 border-b">
          <h3 class="font-semibold text-gray-800">Tolak Pendaftaran</h3>
          <button onclick="BeasiswaModule.closeModal('modal-tolak')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-6">
          <label class="block text-sm font-medium text-gray-700 mb-1">Alasan Penolakan <span class="text-red-500">*</span></label>
          <textarea id="tolak-alasan" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Tuliskan alasan penolakan..."></textarea>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t">
          <button onclick="BeasiswaModule.closeModal('modal-tolak')" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
          <button onclick="BeasiswaModule.submitTolak()" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Tolak</button>
        </div>
      </div>
    </div>
  `

  let editingProgramId = null
  let tolakDaftarId = null

  const openCreateProgram = () => {
    editingProgramId = null
    document.getElementById('modal-program-title').textContent = 'Tambah Program Beasiswa'
    ;['prog-nama','prog-kuota','prog-ipk','prog-besaran','prog-periode','prog-syarat'].forEach(id => {
      const el = document.getElementById(id)
      if (el) el.value = ''
    })
    document.getElementById('prog-jenis-input').value = 'umum'
    openModal('modal-program')
  }

  const editProgram = async (id) => {
    try {
      const r = await API.get(`/beasiswa/${id}`)
      const b = r.data
      editingProgramId = id
      document.getElementById('modal-program-title').textContent = 'Edit Program Beasiswa'
      document.getElementById('prog-nama').value = b.nama || ''
      document.getElementById('prog-jenis-input').value = b.jenis || 'umum'
      document.getElementById('prog-kuota').value = b.kuota || ''
      document.getElementById('prog-ipk').value = b.nilai_min_ipk || ''
      document.getElementById('prog-besaran').value = b.besaran || ''
      document.getElementById('prog-periode').value = b.periode || ''
      document.getElementById('prog-syarat').value = b.syarat || ''
      openModal('modal-program')
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const saveProgram = async () => {
    const nama = document.getElementById('prog-nama').value.trim()
    if (!nama) return UI.toast('Nama program wajib diisi', 'error')
    const payload = {
      nama,
      jenis: document.getElementById('prog-jenis-input').value,
      kuota: parseInt(document.getElementById('prog-kuota').value) || 0,
      nilai_min_ipk: parseFloat(document.getElementById('prog-ipk').value) || null,
      besaran: parseFloat(document.getElementById('prog-besaran').value) || null,
      periode: document.getElementById('prog-periode').value.trim(),
      syarat: document.getElementById('prog-syarat').value.trim(),
    }
    const btn = document.getElementById('prog-save-btn')
    btn.disabled = true; btn.textContent = 'Menyimpan...'
    try {
      if (editingProgramId) {
        await API.put(`/beasiswa/${editingProgramId}`, payload)
        UI.toast('Program diperbarui', 'success')
      } else {
        await API.post('/beasiswa', payload)
        UI.toast('Program berhasil dibuat', 'success')
      }
      closeModal('modal-program')
      loadStats()
      loadProgram()
    } catch (e) { UI.toast(e.message, 'error') }
    finally { btn.disabled = false; btn.textContent = 'Simpan' }
  }

  const openDaftar = async () => {
    try {
      const [bsw, mhs] = await Promise.all([
        API.get('/beasiswa?status=buka&per_page=100'),
        API.get('/mahasiswa?per_page=200'),
      ])
      const bSelect = document.getElementById('daf-beasiswa-id')
      bSelect.innerHTML = '<option value="">-- Pilih program --</option>' +
        (bsw.data || []).map(b => `<option value="${b.id}">${b.nama}</option>`).join('')
      const mSelect = document.getElementById('daf-mahasiswa-id')
      mSelect.innerHTML = '<option value="">-- Pilih mahasiswa --</option>' +
        (mhs.data || []).map(m => `<option value="${m.id}">${m.nim} — ${m.nama_lengkap}</option>`).join('')
      document.getElementById('daf-semester').value = ''
      document.getElementById('daf-alasan').value = ''
      openModal('modal-daftar')
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const saveDaftar = async () => {
    const beasiswa_id = document.getElementById('daf-beasiswa-id').value
    const mahasiswa_id = document.getElementById('daf-mahasiswa-id').value
    if (!beasiswa_id) return UI.toast('Pilih program beasiswa', 'error')
    if (!mahasiswa_id) return UI.toast('Pilih mahasiswa', 'error')
    try {
      await API.post(`/beasiswa/${beasiswa_id}/daftar`, {
        mahasiswa_id,
        semester_akademik: document.getElementById('daf-semester').value.trim(),
        alasan: document.getElementById('daf-alasan').value.trim(),
      })
      UI.toast('Pendaftaran berhasil', 'success')
      closeModal('modal-daftar')
      loadStats()
      if (currentTab === 'pendaftar') loadDaftar()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const openTolak = (id) => {
    tolakDaftarId = id
    document.getElementById('tolak-alasan').value = ''
    openModal('modal-tolak')
  }

  const submitTolak = async () => {
    const alasan = document.getElementById('tolak-alasan').value.trim()
    if (!alasan) return UI.toast('Alasan wajib diisi', 'error')
    try {
      await API.post(`/beasiswa/daftar/${tolakDaftarId}/tolak`, { alasan })
      UI.toast('Pendaftaran ditolak', 'success')
      closeModal('modal-tolak')
      loadStats()
      loadDaftar()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  // ── Helpers ───────────────────────────────────────────────
  const openModal = (id) => document.getElementById(id)?.classList.remove('hidden')
  const closeModal = (id) => document.getElementById(id)?.classList.add('hidden')

  const jenisLabel = (j) => ({
    prestasi: 'Prestasi', kurang_mampu: 'Kurang Mampu', umum: 'Umum'
  })[j] || j

  const statusBadge = (s) => {
    const map = { buka: 'bg-green-100 text-green-800', tutup: 'bg-gray-100 text-gray-600' }
    const label = { buka: 'Buka', tutup: 'Tutup' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${label[s]||s}</span>`
  }

  const daftarBadge = (s) => {
    const map = {
      menunggu: 'bg-yellow-100 text-yellow-800',
      diterima: 'bg-emerald-100 text-emerald-800',
      ditolak: 'bg-red-100 text-red-800',
    }
    const label = { menunggu: 'Menunggu', diterima: 'Diterima', ditolak: 'Ditolak' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${label[s]||s}</span>`
  }

  const renderPagination = (containerId, meta, onPage) => {
    const el = document.getElementById(containerId)
    if (!el || !meta || meta.total_pages <= 1) { if(el) el.innerHTML = ''; return }
    const cur = meta.page
    const total = meta.total_pages
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
    setProgFilter, setDafFilter,
    openCreateProgram, editProgram, saveProgram,
    toggleStatus, hapusProgram,
    lihatPendaftar,
    openDaftar, saveDaftar,
    setujuiPendaftar, openTolak, submitTolak,
    closeModal,
  }
})()
