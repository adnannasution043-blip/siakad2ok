// ============================================================
// SEMESTER PENDEK MODULE
// ============================================================
const SPModule = (() => {

  let currentTab = 'program'
  let programPage = 1; let kelasPage = 1; let pesertaPage = 1
  let programFilter = { status: '', search: '' }
  let kelasFilter = { program_sp_id: '', status: '' }
  let pesertaFilter = { program_sp_id: '', kelas_sp_id: '', search: '' }

  // ── Render ────────────────────────────────────────────────
  const render = () => {
    const main = document.getElementById('page-content')
    main.innerHTML = `
      <div class="p-4 md:p-6 space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Semester Pendek</h1>
          <p class="text-sm text-gray-500">Pengelolaan program semester pendek — maks 9 SKS, nilai D/E/C</p>
        </div>

        <!-- Stats -->
        <div id="sp-stats" class="grid grid-cols-2 md:grid-cols-5 gap-3"></div>

        <!-- Tabs -->
        <div class="border-b border-gray-200">
          <nav class="flex gap-1 -mb-px">
            ${[['program','Program SP'],['kelas','Kelas SP'],['peserta','Peserta & Nilai']].map(([id, label]) => `
              <button onclick="SPModule.switchTab('${id}')"
                id="sp-tab-${id}"
                class="sp-tab px-4 py-2 text-sm font-medium border-b-2 transition-colors ${id === currentTab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}">
                ${label}
              </button>
            `).join('')}
          </nav>
        </div>

        <div id="sp-tab-content"></div>
      </div>

      ${modalHtml()}
    `
    loadStats()
    renderTab()
  }

  const switchTab = (tab) => {
    currentTab = tab
    document.querySelectorAll('.sp-tab').forEach(b => {
      const id = b.id.replace('sp-tab-', '')
      b.className = `sp-tab px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        id === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`
    })
    renderTab()
  }

  const renderTab = () => {
    if (currentTab === 'program') renderProgramTab()
    else if (currentTab === 'kelas') renderKelasTab()
    else renderPesertaTab()
  }

  // ── Stats ─────────────────────────────────────────────────
  const loadStats = async () => {
    try {
      const r = await API.get('/semester-pendek/stats')
      const d = r.data
      const el = document.getElementById('sp-stats')
      if (!el) return
      el.innerHTML = [
        { label: 'Total Program', value: d.total_program, color: 'blue' },
        { label: 'Program Aktif', value: d.program_aktif, color: 'green' },
        { label: 'Total Kelas', value: d.total_kelas, color: 'purple' },
        { label: 'Total Peserta', value: d.total_peserta, color: 'yellow' },
        { label: 'Sudah Dinilai', value: d.peserta_selesai, color: 'emerald' },
      ].map(s => `
        <div class="bg-white rounded-xl border p-4 flex flex-col gap-1">
          <span class="text-xs text-gray-500">${s.label}</span>
          <span class="text-2xl font-bold text-${s.color}-600">${s.value}</span>
        </div>
      `).join('')
    } catch {}
  }

  // ── Program Tab ───────────────────────────────────────────
  const renderProgramTab = () => {
    document.getElementById('sp-tab-content').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-wrap gap-2 items-center">
          <input type="text" placeholder="Cari program..."
            value="${programFilter.search}"
            class="border rounded-lg px-3 py-2 text-sm w-52"
            oninput="SPModule.setProgFilter('search', this.value)">
          <select onchange="SPModule.setProgFilter('status', this.value)"
            class="border rounded-lg px-3 py-2 text-sm">
            <option value="">Semua Status</option>
            <option value="draft" ${programFilter.status==='draft'?'selected':''}>Draft</option>
            <option value="aktif" ${programFilter.status==='aktif'?'selected':''}>Aktif</option>
            <option value="selesai" ${programFilter.status==='selesai'?'selected':''}>Selesai</option>
          </select>
          <button onclick="SPModule.openCreateProgram()"
            class="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Buat Program SP
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
    programFilter[key] = val; programPage = 1; loadProgram()
  }

  const loadProgram = async () => {
    const el = document.getElementById('program-table')
    if (!el) return
    try {
      const params = new URLSearchParams({ page: programPage, per_page: 10 })
      if (programFilter.status) params.set('status', programFilter.status)
      if (programFilter.search) params.set('search', programFilter.search)
      const r = await API.get('/semester-pendek?' + params)
      const { data: items, meta } = r
      if (!items?.length) {
        el.innerHTML = '<div class="py-12 text-center text-gray-400 text-sm">Tidak ada program SP</div>'
        document.getElementById('program-pagination').innerHTML = ''
        return
      }
      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>${['Nama Program','Tahun Akademik','Periode','Maks SKS','Min Peserta','Biaya/SKS','Kelas','Peserta','Status','Aksi'].map(h =>
                `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">${h}</th>`
              ).join('')}</tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${items.map(p => `
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-medium text-gray-900">${p.nama}</td>
                  <td class="px-4 py-3 text-xs">${p.tahun_akademik}</td>
                  <td class="px-4 py-3 text-xs whitespace-nowrap">
                    ${p.tanggal_mulai ? new Date(p.tanggal_mulai).toLocaleDateString('id-ID',{day:'numeric',month:'short'}) : '—'}
                    –
                    ${p.tanggal_selesai ? new Date(p.tanggal_selesai).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : '—'}
                  </td>
                  <td class="px-4 py-3 text-center">${p.batas_sks} SKS</td>
                  <td class="px-4 py-3 text-center">${p.min_peserta}</td>
                  <td class="px-4 py-3 text-xs">${p.biaya_per_sks ? 'Rp ' + p.biaya_per_sks.toLocaleString('id-ID') : '—'}</td>
                  <td class="px-4 py-3 text-center font-medium">${p.jumlah_kelas}</td>
                  <td class="px-4 py-3 text-center">${p.jumlah_peserta}</td>
                  <td class="px-4 py-3">${statusBadge(p.status)}</td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1 flex-wrap">
                      <button onclick="SPModule.editProgram('${p.id}')"
                        class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200">Edit</button>
                      <button onclick="SPModule.lihatKelas('${p.id}')"
                        class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200">Kelas</button>
                      <button onclick="SPModule.lihatPeserta('${p.id}')"
                        class="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded hover:bg-purple-200">Peserta</button>
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

  // ── Kelas Tab ─────────────────────────────────────────────
  const renderKelasTab = () => {
    document.getElementById('sp-tab-content').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-wrap gap-2 items-center">
          <div id="sp-prog-select-wrapper"></div>
          <select onchange="SPModule.setKelasFilter('status', this.value)"
            class="border rounded-lg px-3 py-2 text-sm">
            <option value="">Semua Status</option>
            <option value="aktif" ${kelasFilter.status==='aktif'?'selected':''}>Aktif</option>
            <option value="selesai" ${kelasFilter.status==='selesai'?'selected':''}>Selesai</option>
            <option value="batal" ${kelasFilter.status==='batal'?'selected':''}>Batal</option>
          </select>
          <button onclick="SPModule.openCreateKelas()"
            class="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Tambah Kelas
          </button>
        </div>
        <div id="kelas-table" class="bg-white rounded-xl border overflow-hidden">
          <div class="flex justify-center py-10 text-gray-400 text-sm">Memuat...</div>
        </div>
        <div id="kelas-pagination" class="flex justify-center gap-2"></div>
      </div>
    `
    loadSPSelectFilter('sp-prog-select-wrapper', 'kelas')
    loadKelas()
  }

  const loadSPSelectFilter = async (wrapperId, tab) => {
    const el = document.getElementById(wrapperId)
    if (!el) return
    try {
      const r = await API.get('/semester-pendek?per_page=100')
      const filter = tab === 'kelas' ? kelasFilter : pesertaFilter
      el.innerHTML = `
        <select onchange="SPModule.set${tab === 'kelas' ? 'Kelas' : 'Peserta'}Filter('program_sp_id', this.value)"
          class="border rounded-lg px-3 py-2 text-sm">
          <option value="">Semua Program</option>
          ${(r.data||[]).map(p => `<option value="${p.id}" ${filter.program_sp_id===p.id?'selected':''}>${p.nama}</option>`).join('')}
        </select>
      `
    } catch {}
  }

  const setKelasFilter = (key, val) => {
    kelasFilter[key] = val; kelasPage = 1; loadKelas()
  }

  const loadKelas = async () => {
    const el = document.getElementById('kelas-table')
    if (!el) return
    try {
      const params = new URLSearchParams({ page: kelasPage, per_page: 15 })
      if (kelasFilter.program_sp_id) params.set('program_sp_id', kelasFilter.program_sp_id)
      if (kelasFilter.status) params.set('status', kelasFilter.status)
      const r = await API.get('/semester-pendek/kelas/list?' + params)
      const { data: items, meta } = r
      if (!items?.length) {
        el.innerHTML = '<div class="py-12 text-center text-gray-400 text-sm">Tidak ada kelas SP</div>'
        document.getElementById('kelas-pagination').innerHTML = ''
        return
      }
      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>${['Program','Mata Kuliah','SKS','Dosen','Jadwal','Ruang','Peserta/Kuota','Jalan?','Status','Aksi'].map(h =>
                `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">${h}</th>`
              ).join('')}</tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${items.map(k => `
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 text-xs">${k.program_nama}</td>
                  <td class="px-4 py-3 font-medium">${k.mata_kuliah_nama}</td>
                  <td class="px-4 py-3 text-center">${k.sks}</td>
                  <td class="px-4 py-3 text-xs">${k.dosen_nama || '—'}</td>
                  <td class="px-4 py-3 text-xs">${k.jadwal || '—'}</td>
                  <td class="px-4 py-3 text-xs">${k.ruang || '—'}</td>
                  <td class="px-4 py-3 text-center">${k.jumlah_peserta}/${k.kuota}</td>
                  <td class="px-4 py-3">
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium ${k.jalan ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}">
                      ${k.jalan ? 'Jalan' : 'Belum Cukup'}
                    </span>
                  </td>
                  <td class="px-4 py-3">${statusBadge(k.status)}</td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      <button onclick="SPModule.editKelas('${k.id}')"
                        class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200">Edit</button>
                      <button onclick="SPModule.lihatPesertaKelas('${k.id}', '${k.program_sp_id}')"
                        class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200">Peserta</button>
                      <button onclick="SPModule.hapusKelas('${k.id}', '${k.mata_kuliah_nama}')"
                        class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200">Hapus</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
      renderPagination('kelas-pagination', meta, (p) => { kelasPage = p; loadKelas() })
    } catch (e) {
      el.innerHTML = `<div class="py-8 text-center text-red-500 text-sm">${e.message}</div>`
    }
  }

  // ── Peserta Tab ───────────────────────────────────────────
  const renderPesertaTab = () => {
    document.getElementById('sp-tab-content').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-wrap gap-2 items-center">
          <input type="text" placeholder="Cari nama / NIM / MK..."
            value="${pesertaFilter.search}"
            class="border rounded-lg px-3 py-2 text-sm w-52"
            oninput="SPModule.setPesertaFilter('search', this.value)">
          <div id="sp-prog-select-p"></div>
          <div id="sp-kelas-select-p"></div>
          <button onclick="SPModule.openDaftarPeserta()"
            class="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
            </svg>
            Daftarkan Mahasiswa
          </button>
        </div>
        <div id="peserta-table" class="bg-white rounded-xl border overflow-hidden">
          <div class="flex justify-center py-10 text-gray-400 text-sm">Memuat...</div>
        </div>
        <div id="peserta-pagination" class="flex justify-center gap-2"></div>
      </div>
    `
    loadSPSelectFilter('sp-prog-select-p', 'peserta')
    loadPeserta()
  }

  const setPesertaFilter = (key, val) => {
    pesertaFilter[key] = val; pesertaPage = 1; loadPeserta()
  }

  const loadPeserta = async () => {
    const el = document.getElementById('peserta-table')
    if (!el) return
    try {
      const params = new URLSearchParams({ page: pesertaPage, per_page: 20 })
      if (pesertaFilter.program_sp_id) params.set('program_sp_id', pesertaFilter.program_sp_id)
      if (pesertaFilter.kelas_sp_id) params.set('kelas_sp_id', pesertaFilter.kelas_sp_id)
      if (pesertaFilter.search) params.set('search', pesertaFilter.search)
      const r = await API.get('/semester-pendek/peserta/list?' + params)
      const { data: items, meta } = r
      if (!items?.length) {
        el.innerHTML = '<div class="py-12 text-center text-gray-400 text-sm">Tidak ada peserta</div>'
        document.getElementById('peserta-pagination').innerHTML = ''
        return
      }
      el.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>${['NIM','Nama','Mata Kuliah','SKS','Nilai Asal','Nilai SP','Huruf SP','Ket.','Aksi'].map(h =>
                `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">${h}</th>`
              ).join('')}</tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${items.map(ps => `
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 font-mono text-xs">${ps.mahasiswa_nim}</td>
                  <td class="px-4 py-3 font-medium">${ps.mahasiswa_nama}</td>
                  <td class="px-4 py-3 text-xs">${ps.mata_kuliah_nama}</td>
                  <td class="px-4 py-3 text-center">${ps.sks}</td>
                  <td class="px-4 py-3 text-center">
                    <span class="px-2 py-0.5 rounded text-xs font-bold ${nilaiAsalColor(ps.nilai_asal)}">${ps.nilai_asal || '—'}</span>
                  </td>
                  <td class="px-4 py-3 text-center font-medium">${ps.nilai_akhir ?? '—'}</td>
                  <td class="px-4 py-3 text-center">
                    ${ps.nilai_huruf ? `<span class="px-2 py-0.5 rounded text-xs font-bold ${hurufColor(ps.nilai_huruf)}">${ps.nilai_huruf}</span>` : '—'}
                  </td>
                  <td class="px-4 py-3 text-xs text-gray-500">
                    ${ps.nilai_asal === 'C' || ps.nilai_asal === 'C+' ? 'Ambil terbaik' : 'Replace'}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      ${ps.nilai_akhir === null || ps.nilai_akhir === undefined ? `
                        <button onclick="SPModule.openInputNilai('${ps.id}', '${ps.mahasiswa_nama}', '${ps.mata_kuliah_nama}')"
                          class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200">Input Nilai</button>
                        <button onclick="SPModule.hapusPeserta('${ps.id}', '${ps.mahasiswa_nama}')"
                          class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200">Hapus</button>
                      ` : `<span class="text-xs text-gray-400">Selesai</span>`}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
      renderPagination('peserta-pagination', meta, (p) => { pesertaPage = p; loadPeserta() })
    } catch (e) {
      el.innerHTML = `<div class="py-8 text-center text-red-500 text-sm">${e.message}</div>`
    }
  }

  // ── Quick filter helpers ───────────────────────────────────
  const lihatKelas = (spId) => {
    kelasFilter.program_sp_id = spId; kelasPage = 1; switchTab('kelas')
  }
  const lihatPeserta = (spId) => {
    pesertaFilter.program_sp_id = spId; pesertaFilter.kelas_sp_id = ''; pesertaPage = 1; switchTab('peserta')
  }
  const lihatPesertaKelas = (kelasId, spId) => {
    pesertaFilter.kelas_sp_id = kelasId; pesertaFilter.program_sp_id = spId; pesertaPage = 1; switchTab('peserta')
  }

  // ── Actions ───────────────────────────────────────────────
  const hapusKelas = async (id, nama) => {
    if (!confirm(`Hapus kelas "${nama}"?`)) return
    try {
      await API.delete(`/semester-pendek/kelas/${id}`)
      UI.toast('Kelas dihapus', 'success')
      loadStats(); loadKelas()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const hapusPeserta = async (id, nama) => {
    if (!confirm(`Hapus ${nama} dari SP?`)) return
    try {
      await API.delete(`/semester-pendek/peserta/${id}`)
      UI.toast('Peserta dihapus', 'success')
      loadStats(); loadPeserta()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  // ── Modals ────────────────────────────────────────────────
  const modalHtml = () => `
    <!-- Modal Program SP -->
    <div id="modal-sp-program" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div class="flex items-center justify-between px-6 py-4 border-b">
          <h3 id="modal-sp-prog-title" class="font-semibold text-gray-800">Program Semester Pendek</h3>
          <button onclick="SPModule.closeModal('modal-sp-program')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Program <span class="text-red-500">*</span></label>
            <input id="sp-prog-nama" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Semester Pendek 2025">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tahun Akademik</label>
              <input id="sp-prog-tahun" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="2025/2026">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Maks SKS</label>
              <input id="sp-prog-sks" type="number" min="1" max="24" value="9" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
              <input id="sp-prog-mulai" type="date" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tanggal Selesai</label>
              <input id="sp-prog-selesai" type="date" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Min Peserta / Kelas</label>
              <input id="sp-prog-min" type="number" min="1" value="10" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Biaya / SKS (Rp)</label>
              <input id="sp-prog-biaya" type="number" min="0" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0">
            </div>
          </div>
          <div id="sp-prog-status-row" class="hidden">
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select id="sp-prog-status" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="draft">Draft</option>
              <option value="aktif">Aktif</option>
              <option value="selesai">Selesai</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t">
          <button onclick="SPModule.closeModal('modal-sp-program')" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
          <button id="sp-prog-save-btn" onclick="SPModule.saveProgram()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Simpan</button>
        </div>
      </div>
    </div>

    <!-- Modal Kelas SP -->
    <div id="modal-kelas-sp" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div class="flex items-center justify-between px-6 py-4 border-b">
          <h3 id="modal-kelas-sp-title" class="font-semibold text-gray-800">Kelas SP</h3>
          <button onclick="SPModule.closeModal('modal-kelas-sp')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Program SP <span class="text-red-500">*</span></label>
            <select id="kelas-sp-prog-id" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih program --</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Mata Kuliah <span class="text-red-500">*</span></label>
            <select id="kelas-sp-mk-id" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih mata kuliah --</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Dosen</label>
            <select id="kelas-sp-dosen-id" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih dosen --</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Jadwal</label>
              <input id="kelas-sp-jadwal" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Senin & Rabu 08.00-10.30">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Ruang</label>
              <input id="kelas-sp-ruang" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="R.101">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kuota</label>
            <input id="kelas-sp-kuota" type="number" min="1" value="30" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t">
          <button onclick="SPModule.closeModal('modal-kelas-sp')" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
          <button id="kelas-sp-save-btn" onclick="SPModule.saveKelas()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Simpan</button>
        </div>
      </div>
    </div>

    <!-- Modal Daftar Peserta -->
    <div id="modal-daftar-peserta" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between px-6 py-4 border-b">
          <h3 class="font-semibold text-gray-800">Daftarkan Mahasiswa ke SP</h3>
          <button onclick="SPModule.closeModal('modal-daftar-peserta')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kelas SP <span class="text-red-500">*</span></label>
            <select id="daf-kelas-id" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih kelas --</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Mahasiswa <span class="text-red-500">*</span></label>
            <select id="daf-mhs-id" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih mahasiswa --</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nilai Asal (jika tidak terdeteksi)</label>
            <select id="daf-nilai-asal" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Deteksi otomatis --</option>
              <option value="D">D (55–64)</option>
              <option value="E">E (&lt;55)</option>
              <option value="C">C (65–69)</option>
              <option value="C+">C+ (70–74)</option>
            </select>
          </div>
          <p class="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
            Mahasiswa hanya dapat mendaftar SP untuk mata kuliah yang pernah mendapat nilai D, E, atau C.
            Maks total <strong>9 SKS</strong> per program SP.
          </p>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t">
          <button onclick="SPModule.closeModal('modal-daftar-peserta')" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
          <button id="daf-save-btn" onclick="SPModule.savePeserta()" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Daftarkan</button>
        </div>
      </div>
    </div>

    <!-- Modal Input Nilai -->
    <div id="modal-nilai-sp" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div class="flex items-center justify-between px-6 py-4 border-b">
          <h3 class="font-semibold text-gray-800">Input Nilai SP</h3>
          <button onclick="SPModule.closeModal('modal-nilai-sp')" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-6 space-y-3">
          <p class="text-sm text-gray-600" id="nilai-sp-info"></p>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nilai Akhir (0–100) <span class="text-red-500">*</span></label>
            <input id="sp-nilai-input" type="number" step="0.1" min="0" max="100"
              oninput="SPModule.previewNilai(this.value)"
              class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div id="sp-nilai-preview" class="text-sm text-gray-500"></div>
        </div>
        <div class="flex justify-end gap-2 px-6 py-4 border-t">
          <button onclick="SPModule.closeModal('modal-nilai-sp')" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
          <button onclick="SPModule.submitNilai()" class="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Simpan Nilai</button>
        </div>
      </div>
    </div>
  `

  let editingProgId = null
  let editingKelasId = null
  let inputNilaiId = null

  const openCreateProgram = () => {
    editingProgId = null
    document.getElementById('modal-sp-prog-title').textContent = 'Buat Program Semester Pendek'
    document.getElementById('sp-prog-status-row').classList.add('hidden')
    ;['sp-prog-nama','sp-prog-tahun','sp-prog-mulai','sp-prog-selesai'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value = ''
    })
    document.getElementById('sp-prog-sks').value = 9
    document.getElementById('sp-prog-min').value = 10
    document.getElementById('sp-prog-biaya').value = ''
    openModal('modal-sp-program')
  }

  const editProgram = async (id) => {
    try {
      const r = await API.get(`/semester-pendek/${id}`)
      const p = r.data
      editingProgId = id
      document.getElementById('modal-sp-prog-title').textContent = 'Edit Program SP'
      document.getElementById('sp-prog-status-row').classList.remove('hidden')
      document.getElementById('sp-prog-nama').value = p.nama || ''
      document.getElementById('sp-prog-tahun').value = p.tahun_akademik || ''
      document.getElementById('sp-prog-sks').value = p.batas_sks || 9
      document.getElementById('sp-prog-mulai').value = p.tanggal_mulai || ''
      document.getElementById('sp-prog-selesai').value = p.tanggal_selesai || ''
      document.getElementById('sp-prog-min').value = p.min_peserta || 10
      document.getElementById('sp-prog-biaya').value = p.biaya_per_sks || ''
      document.getElementById('sp-prog-status').value = p.status || 'draft'
      openModal('modal-sp-program')
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const saveProgram = async () => {
    const nama = document.getElementById('sp-prog-nama').value.trim()
    if (!nama) return UI.toast('Nama program wajib diisi', 'error')
    const btn = document.getElementById('sp-prog-save-btn')
    btn.disabled = true; btn.textContent = 'Menyimpan...'
    try {
      const payload = {
        nama,
        tahun_akademik: document.getElementById('sp-prog-tahun').value.trim(),
        batas_sks: parseInt(document.getElementById('sp-prog-sks').value) || 9,
        tanggal_mulai: document.getElementById('sp-prog-mulai').value,
        tanggal_selesai: document.getElementById('sp-prog-selesai').value,
        min_peserta: parseInt(document.getElementById('sp-prog-min').value) || 10,
        biaya_per_sks: parseFloat(document.getElementById('sp-prog-biaya').value) || 0,
        ...(editingProgId ? { status: document.getElementById('sp-prog-status').value } : {}),
      }
      if (editingProgId) {
        await API.put(`/semester-pendek/${editingProgId}`, payload)
        UI.toast('Program diperbarui', 'success')
      } else {
        await API.post('/semester-pendek', payload)
        UI.toast('Program SP dibuat', 'success')
      }
      closeModal('modal-sp-program')
      loadStats(); loadProgram()
    } catch (e) { UI.toast(e.message, 'error') }
    finally { btn.disabled = false; btn.textContent = 'Simpan' }
  }

  const openCreateKelas = async () => {
    editingKelasId = null
    document.getElementById('modal-kelas-sp-title').textContent = 'Tambah Kelas SP'
    try {
      const [spR, mkR, dosenR] = await Promise.all([
        API.get('/semester-pendek?status=aktif&per_page=100'),
        API.get('/mata-kuliah?per_page=100'),
        API.get('/dosen?per_page=100'),
      ])
      const spSel = document.getElementById('kelas-sp-prog-id')
      spSel.innerHTML = '<option value="">-- Pilih program --</option>' +
        (spR.data||[]).map(p => `<option value="${p.id}">${p.nama}</option>`).join('')
      const mkSel = document.getElementById('kelas-sp-mk-id')
      mkSel.innerHTML = '<option value="">-- Pilih mata kuliah --</option>' +
        (mkR.data||[]).map(m => `<option value="${m.id}">${m.nama} (${m.sks} SKS)</option>`).join('')
      const dosenSel = document.getElementById('kelas-sp-dosen-id')
      dosenSel.innerHTML = '<option value="">-- Pilih dosen --</option>' +
        (dosenR.data||[]).map(d => `<option value="${d.id}">${d.nama_lengkap}</option>`).join('')
      ;['kelas-sp-jadwal','kelas-sp-ruang'].forEach(id => document.getElementById(id).value = '')
      document.getElementById('kelas-sp-kuota').value = 30
    } catch {}
    openModal('modal-kelas-sp')
  }

  const editKelas = async (id) => {
    editingKelasId = id
    document.getElementById('modal-kelas-sp-title').textContent = 'Edit Kelas SP'
    await openCreateKelas()
    // Re-load data for edit — find kelas from list
    try {
      const r = await API.get(`/semester-pendek/kelas/list?per_page=200`)
      const k = (r.data||[]).find(x => x.id === id)
      if (k) {
        document.getElementById('kelas-sp-prog-id').value = k.program_sp_id || ''
        document.getElementById('kelas-sp-jadwal').value = k.jadwal || ''
        document.getElementById('kelas-sp-ruang').value = k.ruang || ''
        document.getElementById('kelas-sp-kuota').value = k.kuota || 30
      }
    } catch {}
    editingKelasId = id
  }

  const saveKelas = async () => {
    const prog_id = document.getElementById('kelas-sp-prog-id').value
    const mk_id = document.getElementById('kelas-sp-mk-id').value
    const btn = document.getElementById('kelas-sp-save-btn')

    if (!prog_id) return UI.toast('Pilih program SP', 'error')
    if (!mk_id && !editingKelasId) return UI.toast('Pilih mata kuliah', 'error')

    const dosenSel = document.getElementById('kelas-sp-dosen-id')
    const dosenId = dosenSel.value
    const dosenNama = dosenId ? dosenSel.options[dosenSel.selectedIndex].text : ''

    btn.disabled = true; btn.textContent = 'Menyimpan...'
    try {
      const payload = {
        dosen_id: dosenId,
        dosen_nama: dosenNama,
        jadwal: document.getElementById('kelas-sp-jadwal').value.trim(),
        ruang: document.getElementById('kelas-sp-ruang').value.trim(),
        kuota: parseInt(document.getElementById('kelas-sp-kuota').value) || 30,
      }
      if (editingKelasId) {
        await API.put(`/semester-pendek/kelas/${editingKelasId}`, payload)
        UI.toast('Kelas diperbarui', 'success')
      } else {
        await API.post(`/semester-pendek/${prog_id}/kelas`, { ...payload, mata_kuliah_id: mk_id })
        UI.toast('Kelas SP dibuat', 'success')
      }
      closeModal('modal-kelas-sp')
      loadStats(); loadKelas()
    } catch (e) { UI.toast(e.message, 'error') }
    finally { btn.disabled = false; btn.textContent = 'Simpan' }
  }

  const openDaftarPeserta = async () => {
    try {
      const [klsR, mhsR] = await Promise.all([
        API.get('/semester-pendek/kelas/list?per_page=100'),
        API.get('/mahasiswa?per_page=200'),
      ])
      const kSel = document.getElementById('daf-kelas-id')
      kSel.innerHTML = '<option value="">-- Pilih kelas --</option>' +
        (klsR.data||[]).map(k => `<option value="${k.id}">${k.mata_kuliah_nama} — ${k.program_nama || ''}</option>`).join('')
      const mSel = document.getElementById('daf-mhs-id')
      mSel.innerHTML = '<option value="">-- Pilih mahasiswa --</option>' +
        (mhsR.data||[]).map(m => `<option value="${m.id}">${m.nim} — ${m.nama_lengkap}</option>`).join('')
      document.getElementById('daf-nilai-asal').value = ''
      openModal('modal-daftar-peserta')
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const savePeserta = async () => {
    const kelas_id = document.getElementById('daf-kelas-id').value
    const mahasiswa_id = document.getElementById('daf-mhs-id').value
    if (!kelas_id) return UI.toast('Pilih kelas SP', 'error')
    if (!mahasiswa_id) return UI.toast('Pilih mahasiswa', 'error')
    const btn = document.getElementById('daf-save-btn')
    btn.disabled = true; btn.textContent = 'Mendaftarkan...'
    try {
      await API.post(`/semester-pendek/kelas/${kelas_id}/daftar`, {
        mahasiswa_id,
        nilai_asal: document.getElementById('daf-nilai-asal').value,
      })
      UI.toast('Mahasiswa berhasil didaftarkan', 'success')
      closeModal('modal-daftar-peserta')
      loadStats(); loadPeserta()
    } catch (e) { UI.toast(e.message, 'error') }
    finally { btn.disabled = false; btn.textContent = 'Daftarkan' }
  }

  const openInputNilai = (id, nama, mk) => {
    inputNilaiId = id
    document.getElementById('nilai-sp-info').textContent = `${nama} — ${mk}`
    document.getElementById('sp-nilai-input').value = ''
    document.getElementById('sp-nilai-preview').textContent = ''
    openModal('modal-nilai-sp')
  }

  const previewNilai = (val) => {
    const el = document.getElementById('sp-nilai-preview')
    if (!el) return
    const n = parseFloat(val)
    if (isNaN(n) || n < 0 || n > 100) { el.textContent = ''; return }
    const huruf = n >= 85 ? 'A' : n >= 80 ? 'B+' : n >= 75 ? 'B' : n >= 70 ? 'C+' : n >= 65 ? 'C' : n >= 55 ? 'D' : 'E'
    el.innerHTML = `Nilai huruf: <strong class="${hurufColor(huruf)} px-2 py-0.5 rounded text-xs">${huruf}</strong>`
  }

  const submitNilai = async () => {
    const nilai = document.getElementById('sp-nilai-input').value
    if (!nilai) return UI.toast('Nilai wajib diisi', 'error')
    try {
      await API.post(`/semester-pendek/peserta/${inputNilaiId}/nilai`, { nilai_akhir: parseFloat(nilai) })
      UI.toast('Nilai SP berhasil disimpan', 'success')
      closeModal('modal-nilai-sp')
      loadStats(); loadPeserta()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  // ── Helpers ───────────────────────────────────────────────
  const openModal = (id) => document.getElementById(id)?.classList.remove('hidden')
  const closeModal = (id) => document.getElementById(id)?.classList.add('hidden')

  const statusBadge = (s) => {
    const map = {
      draft: 'bg-gray-100 text-gray-600',
      aktif: 'bg-green-100 text-green-800',
      selesai: 'bg-blue-100 text-blue-800',
      batal: 'bg-red-100 text-red-700',
    }
    const label = { draft: 'Draft', aktif: 'Aktif', selesai: 'Selesai', batal: 'Batal' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${label[s]||s}</span>`
  }

  const nilaiAsalColor = (h) => ({
    D: 'bg-orange-100 text-orange-800',
    E: 'bg-red-100 text-red-800',
    C: 'bg-yellow-100 text-yellow-800',
    'C+': 'bg-yellow-100 text-yellow-700',
  })[h] || 'bg-gray-100 text-gray-600'

  const hurufColor = (h) => ({
    A: 'bg-emerald-100 text-emerald-800',
    'B+': 'bg-green-100 text-green-800',
    B: 'bg-blue-100 text-blue-800',
    'C+': 'bg-yellow-100 text-yellow-700',
    C: 'bg-yellow-100 text-yellow-800',
    D: 'bg-orange-100 text-orange-800',
    E: 'bg-red-100 text-red-800',
  })[h] || 'bg-gray-100 text-gray-600'

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
    setProgFilter, setKelasFilter, setPesertaFilter,
    lihatKelas, lihatPeserta, lihatPesertaKelas,
    openCreateProgram, editProgram, saveProgram,
    openCreateKelas, editKelas, saveKelas, hapusKelas,
    openDaftarPeserta, savePeserta, hapusPeserta,
    openInputNilai, previewNilai, submitNilai,
    closeModal,
  }
})()
