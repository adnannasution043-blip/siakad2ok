// ============================================================
// KHS.JS — Kartu Hasil Studi & Transkrip Nilai
// ============================================================
const KHSModule = (() => {

  let state = {
    tab: 'khs',       // 'khs' | 'transkrip'
    mahasiswa_id: '',
    semester_akademik: '',
    mahasiswaList: [],
    semesters: [],
    data: null,       // KHS or Transkrip response data
  }

  const nilaiColor = (huruf) => {
    const map = {
      'A': 'text-green-700', 'B+': 'text-teal-700', 'B': 'text-blue-700',
      'C+': 'text-indigo-700', 'C': 'text-yellow-700', 'D': 'text-orange-700', 'E': 'text-red-700',
    }
    return map[huruf] || 'text-slate-600'
  }

  const ipColor = (ip) => {
    if (ip >= 3.5) return 'text-green-600'
    if (ip >= 3.0) return 'text-blue-600'
    if (ip >= 2.5) return 'text-indigo-600'
    if (ip >= 2.0) return 'text-yellow-600'
    return 'text-red-600'
  }

  // ── FETCH DATA ─────────────────────────────────────────────
  const fetchMahasiswa = async () => {
    if (state.mahasiswaList.length) return
    const res = await API.get('/mahasiswa', { per_page: 500 })
    state.mahasiswaList = res.data || []
  }

  const fetchSemesters = async () => {
    if (state.semesters.length) return
    const res = await API.get('/nilai/semesters')
    state.semesters = res.data || []
    if (!state.semester_akademik && state.semesters.length)
      state.semester_akademik = state.semesters[0]
  }

  const fetchKHS = async () => {
    if (!state.mahasiswa_id || !state.semester_akademik) { state.data = null; renderResult(); return }
    try {
      const res = await API.get('/nilai/khs', {
        mahasiswa_id: state.mahasiswa_id,
        semester_akademik: state.semester_akademik,
      })
      state.data = res.data
    } catch(e) {
      state.data = null
      UI.toast(e.message || 'Gagal memuat KHS', 'error')
    }
    renderResult()
  }

  const fetchTranskrip = async () => {
    if (!state.mahasiswa_id) { state.data = null; renderResult(); return }
    try {
      const res = await API.get('/nilai/transkrip', { mahasiswa_id: state.mahasiswa_id })
      state.data = res.data
    } catch(e) {
      state.data = null
      UI.toast(e.message || 'Gagal memuat transkrip', 'error')
    }
    renderResult()
  }

  // ── MAIN RENDER ────────────────────────────────────────────
  const render = async () => {
    Router.setPageMeta('KHS & Transkrip', 'Kartu Hasil Studi dan transkrip nilai mahasiswa')
    await Promise.all([fetchMahasiswa(), fetchSemesters()])

    document.getElementById('page-content').innerHTML = `
      <!-- Tab -->
      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-5">
        <button id="tab-khs" onclick="KHSModule.switchTab('khs')"
          class="tab-btn px-5 py-2 rounded-lg text-sm font-medium transition-all ${state.tab==='khs' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}">
          Kartu Hasil Studi (KHS)
        </button>
        <button id="tab-transkrip" onclick="KHSModule.switchTab('transkrip')"
          class="tab-btn px-5 py-2 rounded-lg text-sm font-medium transition-all ${state.tab==='transkrip' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}">
          Transkrip Nilai
        </button>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-wrap items-end gap-3 mb-5">
        <div class="flex-1 min-w-64">
          <label class="block text-xs font-medium text-slate-500 mb-1">Mahasiswa</label>
          <select onchange="KHSModule.onMhsChange(this.value)"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
            <option value="">— Pilih Mahasiswa —</option>
            ${state.mahasiswaList.map(m =>
              `<option value="${m.id}" ${state.mahasiswa_id===m.id?'selected':''}>${m.nama_lengkap} (${m.nim})</option>`
            ).join('')}
          </select>
        </div>
        <div id="sem-filter-wrap" class="${state.tab==='transkrip' ? 'hidden' : ''}">
          <label class="block text-xs font-medium text-slate-500 mb-1">Semester</label>
          <select onchange="KHSModule.onSemChange(this.value)"
            class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
            <option value="">— Pilih Semester —</option>
            ${state.semesters.map(s =>
              `<option value="${s}" ${state.semester_akademik===s?'selected':''}>${s}</option>`
            ).join('')}
          </select>
        </div>
        <button id="khs-print-btn" onclick="KHSModule.print()" class="hidden
          px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
          </svg>
          Cetak / Simpan PDF
        </button>
      </div>

      <!-- Result area -->
      <div id="khs-result"></div>

      <!-- Print area (hidden on screen, shown when printing) -->
      <div id="khs-printable" class="hidden"></div>
    `

    // Auto-fetch if selections already exist
    if (state.mahasiswa_id) {
      state.tab === 'khs' ? await fetchKHS() : await fetchTranskrip()
    }
  }

  // ── TAB SWITCH ─────────────────────────────────────────────
  const switchTab = (tab) => {
    state.tab = tab
    state.data = null
    document.getElementById('tab-khs').className =
      `tab-btn px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab==='khs' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`
    document.getElementById('tab-transkrip').className =
      `tab-btn px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab==='transkrip' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`
    document.getElementById('sem-filter-wrap').classList.toggle('hidden', tab === 'transkrip')
    document.getElementById('khs-print-btn').classList.add('hidden')
    renderResult()
    if (state.mahasiswa_id) {
      tab === 'khs' ? fetchKHS() : fetchTranskrip()
    }
  }

  // ── FILTER HANDLERS ────────────────────────────────────────
  const onMhsChange = (id) => {
    state.mahasiswa_id = id
    state.data = null
    document.getElementById('khs-print-btn').classList.add('hidden')
    renderResult()
    if (id) { state.tab === 'khs' ? fetchKHS() : fetchTranskrip() }
  }

  const onSemChange = (sem) => {
    state.semester_akademik = sem
    state.data = null
    document.getElementById('khs-print-btn').classList.add('hidden')
    renderResult()
    if (state.mahasiswa_id && sem) fetchKHS()
  }

  // ── RENDER RESULT ──────────────────────────────────────────
  const renderResult = () => {
    const el = document.getElementById('khs-result')
    if (!state.data) {
      el.innerHTML = `
        <div class="text-center py-16 text-slate-400">
          <svg class="w-14 h-14 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p class="text-sm">Pilih mahasiswa${state.tab==='khs'?' dan semester':''} untuk menampilkan ${state.tab==='khs'?'KHS':'transkrip'}</p>
        </div>`
      return
    }
    if (state.tab === 'khs') renderKHS()
    else renderTranskrip()
  }

  // ── RENDER KHS ─────────────────────────────────────────────
  const khsTableRows = (nilaiList) => nilaiList.map((n, i) => `
    <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}">
      <td class="px-4 py-2.5 text-sm text-slate-500 text-center">${i + 1}</td>
      <td class="px-4 py-2.5 text-sm font-mono text-slate-600">${n.mata_kuliah_kode || '—'}</td>
      <td class="px-4 py-2.5 text-sm text-slate-800">${n.mata_kuliah_nama}</td>
      <td class="px-4 py-2.5 text-sm text-center text-slate-600">${n.sks}</td>
      <td class="px-4 py-2.5 text-sm text-center text-slate-600">${typeof n.nilai_uts   === 'number' ? n.nilai_uts.toFixed(1)   : '—'}</td>
      <td class="px-4 py-2.5 text-sm text-center text-slate-600">${typeof n.nilai_uas   === 'number' ? n.nilai_uas.toFixed(1)   : '—'}</td>
      <td class="px-4 py-2.5 text-sm text-center text-slate-600">${typeof n.nilai_tugas === 'number' ? n.nilai_tugas.toFixed(1) : '—'}</td>
      <td class="px-4 py-2.5 text-sm text-center font-semibold text-slate-800">${typeof n.nilai_akhir === 'number' ? n.nilai_akhir.toFixed(2) : '—'}</td>
      <td class="px-4 py-2.5 text-sm text-center font-bold ${nilaiColor(n.nilai_huruf)}">${n.nilai_huruf || '—'}</td>
      <td class="px-4 py-2.5 text-sm text-center text-slate-600">${n.bobot?.toFixed(1) ?? '—'}</td>
      <td class="px-4 py-2.5 text-center">
        ${n.locked
          ? `<span class="text-xs text-slate-400">Terkunci</span>`
          : `<span class="text-xs text-amber-500">Draft</span>`}
      </td>
    </tr>`).join('')

  const renderKHS = () => {
    const d = state.data
    const mhs = d.mahasiswa
    document.getElementById('khs-print-btn').classList.remove('hidden')
    document.getElementById('khs-result').innerHTML = `
      ${UI.card(`
        <!-- Header mahasiswa -->
        <div class="flex flex-wrap items-start justify-between gap-4 mb-5 pb-4 border-b">
          <div>
            <h2 class="text-lg font-bold text-slate-800">${mhs.nama_lengkap}</h2>
            <div class="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm text-slate-500">
              <span>NIM: <span class="font-medium text-slate-700">${mhs.nim}</span></span>
              <span>Prodi: <span class="font-medium text-slate-700">${mhs.program_studi_nama || '—'}</span></span>
              <span>Angkatan: <span class="font-medium text-slate-700">${mhs.angkatan || '—'}</span></span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs text-slate-400 uppercase tracking-wide">Semester</div>
            <div class="text-base font-semibold text-slate-700">${d.semester_akademik}</div>
          </div>
        </div>

        <!-- Stat pills -->
        <div class="flex flex-wrap gap-3 mb-5">
          <div class="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl">
            <span class="text-xs text-slate-500">Total SKS</span>
            <span class="text-lg font-bold text-slate-700">${d.total_sks}</span>
          </div>
          <div class="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl">
            <span class="text-xs text-slate-500">SKS Lulus</span>
            <span class="text-lg font-bold text-green-600">${d.sks_lulus}</span>
          </div>
          <div class="flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-xl">
            <span class="text-xs text-slate-500">IPS</span>
            <span class="text-lg font-bold ${ipColor(d.ip)}">${d.ip.toFixed(2)}</span>
          </div>
        </div>

        <!-- Tabel nilai -->
        ${d.nilai.length === 0
          ? `<p class="text-sm text-slate-400 py-4 text-center">Belum ada nilai untuk semester ini</p>`
          : `<div class="overflow-x-auto -mx-5 px-5">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="border-b border-slate-200">
                    <th class="px-4 py-3 text-xs font-semibold text-slate-500 text-center w-8">No</th>
                    <th class="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Kode MK</th>
                    <th class="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Mata Kuliah</th>
                    <th class="px-4 py-3 text-xs font-semibold text-slate-500 text-center">SKS</th>
                    <th class="px-4 py-3 text-xs font-semibold text-slate-500 text-center">UTS</th>
                    <th class="px-4 py-3 text-xs font-semibold text-slate-500 text-center">UAS</th>
                    <th class="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Tugas</th>
                    <th class="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Akhir</th>
                    <th class="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Nilai</th>
                    <th class="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Bobot</th>
                    <th class="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${khsTableRows(d.nilai)}
                </tbody>
              </table>
            </div>`}
      `)}
    `

    // Prepare printable version
    buildPrintKHS(d)
  }

  // ── RENDER TRANSKRIP ───────────────────────────────────────
  const renderTranskrip = () => {
    const d = state.data
    const mhs = d.mahasiswa
    document.getElementById('khs-print-btn').classList.remove('hidden')

    const semHtml = d.semesters.map(sem => `
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-slate-700">${sem.semester_akademik}</h3>
          <div class="flex gap-3 text-xs text-slate-500">
            <span>SKS: <span class="font-semibold text-slate-700">${sem.total_sks}</span></span>
            <span>Lulus: <span class="font-semibold text-green-600">${sem.sks_lulus}</span></span>
            <span>IPS: <span class="font-semibold ${ipColor(sem.ip)}">${sem.ip.toFixed(2)}</span></span>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="border-b border-slate-200">
                <th class="px-3 py-2 text-xs font-semibold text-slate-500 text-center w-8">No</th>
                <th class="px-3 py-2 text-xs font-semibold text-slate-500 text-left">Kode</th>
                <th class="px-3 py-2 text-xs font-semibold text-slate-500 text-left">Mata Kuliah</th>
                <th class="px-3 py-2 text-xs font-semibold text-slate-500 text-center">SKS</th>
                <th class="px-3 py-2 text-xs font-semibold text-slate-500 text-center">Nilai</th>
                <th class="px-3 py-2 text-xs font-semibold text-slate-500 text-center">Bobot</th>
                <th class="px-3 py-2 text-xs font-semibold text-slate-500 text-center">Mutu</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${sem.nilai.map((n, i) => `
                <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}">
                  <td class="px-3 py-2 text-center text-slate-400">${i+1}</td>
                  <td class="px-3 py-2 font-mono text-slate-600">${n.mata_kuliah_kode || '—'}</td>
                  <td class="px-3 py-2 text-slate-800">${n.mata_kuliah_nama}</td>
                  <td class="px-3 py-2 text-center text-slate-600">${n.sks}</td>
                  <td class="px-3 py-2 text-center font-bold ${nilaiColor(n.nilai_huruf)}">${n.nilai_huruf || '—'}</td>
                  <td class="px-3 py-2 text-center text-slate-600">${n.bobot?.toFixed(1) ?? '—'}</td>
                  <td class="px-3 py-2 text-center text-slate-600">${((n.bobot || 0) * (n.sks || 0)).toFixed(2)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`).join('')

    document.getElementById('khs-result').innerHTML = `
      ${UI.card(`
        <!-- Header -->
        <div class="flex flex-wrap items-start justify-between gap-4 mb-5 pb-4 border-b">
          <div>
            <h2 class="text-lg font-bold text-slate-800">${mhs.nama_lengkap}</h2>
            <div class="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm text-slate-500">
              <span>NIM: <span class="font-medium text-slate-700">${mhs.nim}</span></span>
              <span>Prodi: <span class="font-medium text-slate-700">${mhs.program_studi_nama || '—'}</span></span>
              <span>Angkatan: <span class="font-medium text-slate-700">${mhs.angkatan || '—'}</span></span>
              <span>Status: <span class="font-medium text-slate-700">${mhs.status || '—'}</span></span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs text-slate-400 uppercase tracking-wide">IPK</div>
            <div class="text-3xl font-bold ${ipColor(d.ipk)}">${d.ipk.toFixed(2)}</div>
          </div>
        </div>

        <!-- Summary pills -->
        <div class="flex flex-wrap gap-3 mb-6">
          <div class="px-4 py-2 bg-slate-50 rounded-xl">
            <div class="text-xs text-slate-400">Total SKS Tempuh</div>
            <div class="text-xl font-bold text-slate-700">${d.total_sks_tempuh}</div>
          </div>
          <div class="px-4 py-2 bg-green-50 rounded-xl">
            <div class="text-xs text-slate-400">SKS Lulus</div>
            <div class="text-xl font-bold text-green-600">${d.total_sks_lulus}</div>
          </div>
          <div class="px-4 py-2 bg-primary-50 rounded-xl">
            <div class="text-xs text-slate-400">IPK</div>
            <div class="text-xl font-bold ${ipColor(d.ipk)}">${d.ipk.toFixed(2)}</div>
          </div>
          <div class="px-4 py-2 bg-slate-50 rounded-xl">
            <div class="text-xs text-slate-400">Semester Ditempuh</div>
            <div class="text-xl font-bold text-slate-700">${d.semesters.length}</div>
          </div>
        </div>

        <!-- Per semester -->
        ${d.semesters.length === 0
          ? `<p class="text-sm text-slate-400 text-center py-4">Belum ada data nilai</p>`
          : semHtml}
      `)}
    `

    buildPrintTranskrip(d)
  }

  // ── PRINT ──────────────────────────────────────────────────
  const buildPrintKHS = (d) => {
    const mhs = d.mahasiswa
    document.getElementById('khs-printable').innerHTML = `
      <div class="print-doc">
        <div class="print-header">
          <div class="print-logo">🎓</div>
          <div>
            <h1>KARTU HASIL STUDI (KHS)</h1>
            <p>Sistem Informasi Akademik</p>
          </div>
        </div>
        <div class="print-info">
          <table>
            <tr><td>Nama</td><td>: ${mhs.nama_lengkap}</td><td>Semester</td><td>: ${d.semester_akademik}</td></tr>
            <tr><td>NIM</td><td>: ${mhs.nim}</td><td>Program Studi</td><td>: ${mhs.program_studi_nama || '—'}</td></tr>
            <tr><td>Angkatan</td><td>: ${mhs.angkatan || '—'}</td><td>Dosen PA</td><td>: ${mhs.dosen_wali_nama || '—'}</td></tr>
          </table>
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th>No</th><th>Kode MK</th><th>Mata Kuliah</th><th>SKS</th>
              <th>UTS</th><th>UAS</th><th>Tugas</th><th>Nilai Akhir</th><th>Nilai</th><th>Bobot</th>
            </tr>
          </thead>
          <tbody>
            ${d.nilai.map((n, i) => `
              <tr>
                <td>${i+1}</td>
                <td>${n.mata_kuliah_kode || '—'}</td>
                <td>${n.mata_kuliah_nama}</td>
                <td>${n.sks}</td>
                <td>${n.nilai_uts?.toFixed(1) ?? '—'}</td>
                <td>${n.nilai_uas?.toFixed(1) ?? '—'}</td>
                <td>${n.nilai_tugas?.toFixed(1) ?? '—'}</td>
                <td>${n.nilai_akhir?.toFixed(2) ?? '—'}</td>
                <td><b>${n.nilai_huruf || '—'}</b></td>
                <td>${n.bobot?.toFixed(1) ?? '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <div class="print-summary">
          <span>Total SKS: <b>${d.total_sks}</b></span>
          <span>SKS Lulus: <b>${d.sks_lulus}</b></span>
          <span>IPS: <b>${d.ip.toFixed(2)}</b></span>
        </div>
        <div class="print-footer">
          <div>
            <p>Mengetahui,</p>
            <br/><br/><br/>
            <p style="border-top:1px solid #666;padding-top:4px">Dosen Pembimbing Akademik</p>
            <p>${mhs.dosen_wali_nama || '.........................'}</p>
          </div>
          <div class="text-right">
            <p>Dicetak: ${new Date().toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})}</p>
          </div>
        </div>
      </div>`
  }

  const buildPrintTranskrip = (d) => {
    const mhs = d.mahasiswa
    const semRows = d.semesters.map(sem => `
      <tr style="background:#f1f5f9">
        <td colspan="5" style="font-weight:600;padding:6px 8px">${sem.semester_akademik}
          — IPS: ${sem.ip.toFixed(2)} | SKS: ${sem.total_sks} | Lulus: ${sem.sks_lulus}
        </td>
      </tr>
      ${sem.nilai.map((n, i) => `
        <tr>
          <td>${i+1}</td>
          <td>${n.mata_kuliah_kode || '—'}</td>
          <td>${n.mata_kuliah_nama}</td>
          <td>${n.sks}</td>
          <td><b>${n.nilai_huruf || '—'}</b></td>
          <td>${n.bobot?.toFixed(1) ?? '—'}</td>
          <td>${((n.bobot||0)*(n.sks||0)).toFixed(2)}</td>
        </tr>`).join('')}
    `).join('')

    document.getElementById('khs-printable').innerHTML = `
      <div class="print-doc">
        <div class="print-header">
          <div class="print-logo">🎓</div>
          <div>
            <h1>TRANSKRIP NILAI</h1>
            <p>Sistem Informasi Akademik</p>
          </div>
        </div>
        <div class="print-info">
          <table>
            <tr><td>Nama</td><td>: ${mhs.nama_lengkap}</td><td>Program Studi</td><td>: ${mhs.program_studi_nama || '—'}</td></tr>
            <tr><td>NIM</td><td>: ${mhs.nim}</td><td>Angkatan</td><td>: ${mhs.angkatan || '—'}</td></tr>
            <tr><td>Status</td><td>: ${mhs.status || '—'}</td><td>IPK</td><td>: <b>${d.ipk.toFixed(2)}</b></td></tr>
          </table>
        </div>
        <table class="print-table">
          <thead>
            <tr><th>No</th><th>Kode MK</th><th>Mata Kuliah</th><th>SKS</th><th>Nilai</th><th>Bobot</th><th>Mutu</th></tr>
          </thead>
          <tbody>${semRows}</tbody>
        </table>
        <div class="print-summary">
          <span>Total SKS Tempuh: <b>${d.total_sks_tempuh}</b></span>
          <span>SKS Lulus: <b>${d.total_sks_lulus}</b></span>
          <span>IPK: <b>${d.ipk.toFixed(2)}</b></span>
          <span>Semester Ditempuh: <b>${d.semesters.length}</b></span>
        </div>
        <div class="print-footer">
          <div>
            <p>Mengetahui,</p>
            <br/><br/><br/>
            <p style="border-top:1px solid #666;padding-top:4px">Ketua Program Studi</p>
            <p>${mhs.program_studi_nama || '.........................'}</p>
          </div>
          <div class="text-right">
            <p>Dicetak: ${new Date().toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})}</p>
          </div>
        </div>
      </div>`
  }

  const print = () => {
    const printable = document.getElementById('khs-printable')
    if (!printable || !printable.innerHTML.trim()) {
      UI.toast('Tidak ada data untuk dicetak', 'error')
      return
    }
    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>${state.tab === 'khs' ? 'KHS' : 'Transkrip'}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }
      .print-doc { max-width: 800px; margin: 0 auto; }
      .print-header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 14px; }
      .print-logo { font-size: 36px; }
      .print-header h1 { font-size: 16px; font-weight: 700; }
      .print-header p { font-size: 11px; color: #555; }
      .print-info table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
      .print-info td { padding: 2px 8px; width: 25%; }
      .print-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10.5px; }
      .print-table th { background: #334155; color: #fff; padding: 6px 8px; text-align: left; font-weight: 600; }
      .print-table td { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; }
      .print-table tr:nth-child(even) { background: #f8fafc; }
      .print-summary { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; display: flex; gap: 24px; flex-wrap: wrap; }
      .print-summary span b { color: #1e40af; }
      .print-footer { display: flex; justify-content: space-between; margin-top: 30px; font-size: 11px; }
      @media print { body { padding: 10mm; } }
    </style></head><body>${printable.innerHTML}</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 400)
  }

  return {
    render, switchTab,
    onMhsChange, onSemChange,
    print,
  }
})()
