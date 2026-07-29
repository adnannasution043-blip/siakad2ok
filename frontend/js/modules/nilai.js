// ============================================================
// NILAI.JS — Penilaian akademik (input, kunci, koreksi)
// ============================================================
const NilaiModule = (() => {

  let state = {
    list: [], meta: null, semesters: [],
    page: 1, search: '', semester_akademik: '', nilai_huruf: '', locked: '',
    rekap: null,
  }

  const HURUF = ['A', 'B+', 'B', 'C+', 'C', 'D', 'E']

  const nilaiColor = (huruf) => {
    const map = {
      'A':  'bg-green-100 text-green-700',
      'B+': 'bg-teal-100 text-teal-700',
      'B':  'bg-blue-100 text-blue-700',
      'C+': 'bg-indigo-100 text-indigo-700',
      'C':  'bg-yellow-100 text-yellow-700',
      'D':  'bg-orange-100 text-orange-700',
      'E':  'bg-red-100 text-red-700',
    }
    return map[huruf] || 'bg-slate-100 text-slate-600'
  }

  // ── CALC PREVIEW ───────────────────────────────────────────
  const calcPreview = () => {
    const uts   = parseFloat(document.getElementById('nlai-uts')?.value) || 0
    const uas   = parseFloat(document.getElementById('nlai-uas')?.value) || 0
    const tugas = parseFloat(document.getElementById('nlai-tugas')?.value) || 0
    const bUts   = parseFloat(document.getElementById('nlai-b-uts')?.value)   || 0.35
    const bUas   = parseFloat(document.getElementById('nlai-b-uas')?.value)   || 0.45
    const bTugas = parseFloat(document.getElementById('nlai-b-tugas')?.value) || 0.20
    const akhir = uts * bUts + uas * bUas + tugas * bTugas
    const huruf = akhir >= 85 ? 'A' : akhir >= 80 ? 'B+' : akhir >= 75 ? 'B' :
                  akhir >= 70 ? 'C+' : akhir >= 65 ? 'C' : akhir >= 55 ? 'D' : 'E'
    const el = document.getElementById('nlai-preview')
    if (el) el.innerHTML = `
      <span class="font-semibold">${akhir.toFixed(2)}</span>
      <span class="badge ml-2 ${nilaiColor(huruf)}">${huruf}</span>`
  }

  // ── FETCH ──────────────────────────────────────────────────
  const fetchSemesters = async () => {
    if (state.semesters.length) return
    const res = await API.get('/nilai/semesters')
    state.semesters = res.data || []
    if (!state.semester_akademik && state.semesters.length)
      state.semester_akademik = state.semesters[0]
  }

  const fetchRekap = async () => {
    const res = await API.get('/nilai/rekap', { semester_akademik: state.semester_akademik })
    state.rekap = res.data
    renderRekap()
  }

  const fetchList = async () => {
    const params = {
      page: state.page, per_page: 20,
      search: state.search,
      semester_akademik: state.semester_akademik,
      nilai_huruf: state.nilai_huruf,
      locked: state.locked,
    }
    if (Auth.hasRole('mahasiswa'))     params.mahasiswa_id = Auth.getEntityId() || ''
    else if (Auth.hasRole('dosen'))    params.dosen_id     = Auth.getEntityId() || ''
    const res = await API.get('/nilai', params)
    state.list = res.data
    state.meta = res.meta
    renderTable()
    renderPagination()
  }

  // ── RENDER MAIN ────────────────────────────────────────────
  const render = async () => {
    Router.setPageMeta('Penilaian', 'Input dan kelola nilai mahasiswa')
    await fetchSemesters()

    document.getElementById('page-content').innerHTML = `
      <div id="nlai-rekap" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5"></div>

      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div class="flex-1 min-w-48">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input id="nlai-search" type="text" placeholder="Cari mahasiswa atau mata kuliah..."
              value="${state.search}"
              class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              oninput="NilaiModule.onSearch(this.value)" />
          </div>
        </div>
        <select onchange="NilaiModule.onFilter('semester_akademik', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Semester</option>
          ${state.semesters.map(s => `<option value="${s}" ${state.semester_akademik===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <select onchange="NilaiModule.onFilter('nilai_huruf', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Nilai</option>
          ${HURUF.map(h => `<option value="${h}" ${state.nilai_huruf===h?'selected':''}>Nilai ${h}</option>`).join('')}
        </select>
        <select onchange="NilaiModule.onFilter('locked', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Status</option>
          <option value="false" ${state.locked==='false'?'selected':''}>Draft</option>
          <option value="true"  ${state.locked==='true'?'selected':''}>Terkunci</option>
        </select>
        <button onclick="NilaiModule.openInput()"
          class="btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Input Nilai
        </button>
      </div>

      ${UI.card(`
        <div id="nlai-table-wrap"></div>
        <div id="nlai-pagination"></div>
      `)}

      <!-- Modal Input/Edit Nilai -->
      <div id="nlai-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" onclick="NilaiModule.closeModal()"></div>
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
          <div class="px-6 py-4 border-b flex items-center justify-between">
            <h3 id="nlai-modal-title" class="text-lg font-semibold text-slate-800">Input Nilai</h3>
            <button onclick="NilaiModule.closeModal()" class="text-slate-400 hover:text-slate-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <form id="nlai-form" onsubmit="NilaiModule.submitForm(event)" class="px-6 py-4 space-y-4">
            <div id="nlai-krs-info" class="hidden p-3 bg-slate-50 rounded-lg text-sm text-slate-700 space-y-1"></div>

            <div id="nlai-krs-wrap">
              <label class="block text-sm font-medium text-slate-700 mb-1">KRS (Mahasiswa – Mata Kuliah)</label>
              <select id="nlai-krs-id" name="krs_id"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                onchange="NilaiModule.onKrsChange(this.value)">
                <option value="">— Pilih KRS —</option>
              </select>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Nilai UTS</label>
                <input id="nlai-uts" name="nilai_uts" type="number" min="0" max="100" step="0.1"
                  placeholder="0–100" oninput="NilaiModule.calcPreview()"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" required/>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Nilai UAS</label>
                <input id="nlai-uas" name="nilai_uas" type="number" min="0" max="100" step="0.1"
                  placeholder="0–100" oninput="NilaiModule.calcPreview()"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" required/>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Nilai Tugas</label>
                <input id="nlai-tugas" name="nilai_tugas" type="number" min="0" max="100" step="0.1"
                  placeholder="0–100" oninput="NilaiModule.calcPreview()"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" required/>
              </div>
            </div>

            <details class="text-sm">
              <summary class="cursor-pointer text-slate-500 hover:text-slate-700">Bobot penilaian (default: UTS 35%, UAS 45%, Tugas 20%)</summary>
              <div class="grid grid-cols-3 gap-3 mt-2">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Bobot UTS</label>
                  <input id="nlai-b-uts" name="bobot_uts" type="number" min="0" max="1" step="0.05"
                    value="0.35" oninput="NilaiModule.calcPreview()"
                    class="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Bobot UAS</label>
                  <input id="nlai-b-uas" name="bobot_uas" type="number" min="0" max="1" step="0.05"
                    value="0.45" oninput="NilaiModule.calcPreview()"
                    class="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Bobot Tugas</label>
                  <input id="nlai-b-tugas" name="bobot_tugas" type="number" min="0" max="1" step="0.05"
                    value="0.20" oninput="NilaiModule.calcPreview()"
                    class="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                </div>
              </div>
            </details>

            <div class="p-3 bg-slate-50 rounded-lg flex items-center gap-3">
              <span class="text-sm text-slate-500">Nilai Akhir:</span>
              <span id="nlai-preview" class="flex items-center text-slate-800">—</span>
            </div>

            <div class="flex gap-3 pt-2">
              <button type="button" onclick="NilaiModule.closeModal()"
                class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                Batal
              </button>
              <button type="submit" id="nlai-submit-btn"
                class="flex-1 btn-primary px-4 py-2 rounded-lg text-sm font-medium">
                Simpan Nilai
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal Koreksi -->
      <div id="nlai-koreksi-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" onclick="NilaiModule.closeKoreksiModal()"></div>
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div class="px-6 py-4 border-b">
            <h3 class="text-lg font-semibold text-slate-800">Buka Nilai untuk Koreksi</h3>
          </div>
          <div class="px-6 py-4 space-y-4">
            <p id="nlai-koreksi-info" class="text-sm text-slate-600"></p>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Alasan Koreksi <span class="text-red-500">*</span></label>
              <textarea id="nlai-koreksi-alasan" rows="3" placeholder="Tuliskan alasan pembukaan nilai..."
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"></textarea>
            </div>
            <div class="flex gap-3">
              <button onclick="NilaiModule.closeKoreksiModal()"
                class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                Batal
              </button>
              <button onclick="NilaiModule.submitKoreksi()"
                class="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">
                Buka untuk Koreksi
              </button>
            </div>
          </div>
        </div>
      </div>
    `

    await Promise.all([fetchRekap(), fetchList()])
  }

  // ── RENDER REKAP ───────────────────────────────────────────
  const renderRekap = () => {
    const r = state.rekap
    if (!r) return
    const cards = [
      { label: 'Total Nilai',  val: r.total,     color: 'text-primary-600',  bg: 'bg-primary-50' },
      { label: 'Draft',        val: r.draft,      color: 'text-amber-600',    bg: 'bg-amber-50'   },
      { label: 'Terkunci',     val: r.terkunci,   color: 'text-green-600',    bg: 'bg-green-50'   },
      { label: 'Rata-rata',    val: r.rata_rata,  color: 'text-indigo-600',   bg: 'bg-indigo-50'  },
    ]
    document.getElementById('nlai-rekap').innerHTML = cards.map(c => `
      <div class="${c.bg} rounded-xl p-4 flex flex-col gap-1">
        <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">${c.label}</span>
        <span class="text-2xl font-bold ${c.color}">${c.val}</span>
      </div>`).join('')
  }

  // ── RENDER TABLE ───────────────────────────────────────────
  const renderTable = () => {
    document.getElementById('nlai-table-wrap').innerHTML = UI.renderTable({
      headers: ['Mahasiswa', 'Mata Kuliah', 'Semester', 'UTS', 'UAS', 'Tugas', 'Akhir', 'Nilai', 'Status', 'Aksi'],
      emptyText: 'Tidak ada data nilai',
      rows: state.list.map(n => {
        const akhir = typeof n.nilai_akhir === 'number' ? n.nilai_akhir.toFixed(2) : '—'
        const uts   = typeof n.nilai_uts   === 'number' ? n.nilai_uts.toFixed(1)   : '—'
        const uas   = typeof n.nilai_uas   === 'number' ? n.nilai_uas.toFixed(1)   : '—'
        const tugas = typeof n.nilai_tugas === 'number' ? n.nilai_tugas.toFixed(1) : '—'
        const isLocked = !!n.locked
        const editBtn = !isLocked ? `
          <button onclick="NilaiModule.openEdit('${n.id}')"
            title="Edit nilai"
            class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>` : ''
        const kunciBtn = !isLocked ? `
          <button onclick="NilaiModule.kunci('${n.id}', '${(n.mahasiswa_nama||'').replace(/'/g,"\\'")}', '${(n.mata_kuliah_nama||'').replace(/'/g,"\\'")}' )"
            title="Kunci nilai"
            class="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </button>` : ''
        const koreksiBtn = isLocked ? `
          <button onclick="NilaiModule.openKoreksi('${n.id}', '${(n.mahasiswa_nama||'').replace(/'/g,"\\'")}', '${(n.mata_kuliah_nama||'').replace(/'/g,"\\'")}' )"
            title="Buka untuk koreksi"
            class="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
            </svg>
          </button>` : ''
        return `
          <td class="px-4 py-3">
            <div class="text-sm font-medium text-slate-800">${n.mahasiswa_nama || '—'}</div>
            <div class="text-xs text-slate-400">${n.mahasiswa_nim || ''}</div>
          </td>
          <td class="px-4 py-3">
            <div class="text-sm text-slate-700">${n.mata_kuliah_nama}</div>
            <div class="text-xs text-slate-400">${n.input_oleh_nama || ''}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">${n.semester_akademik}</td>
          <td class="px-4 py-3 text-sm text-center text-slate-600">${uts}</td>
          <td class="px-4 py-3 text-sm text-center text-slate-600">${uas}</td>
          <td class="px-4 py-3 text-sm text-center text-slate-600">${tugas}</td>
          <td class="px-4 py-3 text-sm text-center font-semibold text-slate-800">${akhir}</td>
          <td class="px-4 py-3 text-center">
            <span class="badge ${nilaiColor(n.nilai_huruf)}">${n.nilai_huruf || '—'}</span>
          </td>
          <td class="px-4 py-3 text-center">
            ${isLocked
              ? `<span class="badge bg-slate-100 text-slate-500 flex items-center gap-1 w-fit mx-auto">
                   <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                       d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                   </svg>Terkunci</span>`
              : `<span class="badge bg-amber-50 text-amber-600">Draft</span>`}
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-center gap-1">
              ${editBtn}${kunciBtn}${koreksiBtn}
            </div>
          </td>`
      })
    })
  }

  const renderPagination = () => {
    document.getElementById('nlai-pagination').innerHTML =
      UI.renderPagination(state.meta, 'NilaiModule.goPage')
  }

  // ── MODAL: INPUT NILAI ─────────────────────────────────────
  let _editId = null  // null = new, string = edit existing

  const openInput = async () => {
    _editId = null
    document.getElementById('nlai-modal-title').textContent = 'Input Nilai'
    document.getElementById('nlai-krs-wrap').classList.remove('hidden')
    document.getElementById('nlai-krs-info').classList.add('hidden')
    document.getElementById('nlai-form').reset()
    document.getElementById('nlai-preview').innerHTML = '—'

    // Load KRS disetujui yang belum ada nilainya
    try {
      const [krsRes, nilaiRes] = await Promise.all([
        API.get('/krs', { status: 'disetujui', per_page: 200,
                          semester_akademik: state.semester_akademik }),
        API.get('/nilai', { per_page: 500, semester_akademik: state.semester_akademik }),
      ])
      const existingKrsIds = new Set((nilaiRes.data || []).map(n => n.krs_id))
      const available = (krsRes.data || []).filter(k => !existingKrsIds.has(k.id))
      const sel = document.getElementById('nlai-krs-id')
      sel.innerHTML = `<option value="">— Pilih KRS —</option>` +
        available.map(k => `<option value="${k.id}">${k.mahasiswa_nama} (${k.mahasiswa_nim}) — ${k.mata_kuliah_nama}</option>`).join('')
    } catch(e) {
      console.error(e)
    }

    document.getElementById('nlai-modal').classList.remove('hidden')
  }

  const openEdit = async (id) => {
    _editId = id
    document.getElementById('nlai-modal-title').textContent = 'Edit Nilai'
    document.getElementById('nlai-krs-wrap').classList.add('hidden')

    try {
      const res = await API.get(`/nilai/${id}`)
      const n = res.data
      const info = document.getElementById('nlai-krs-info')
      info.classList.remove('hidden')
      info.innerHTML = `
        <div class="font-medium">${n.mahasiswa_nama} (${n.mahasiswa_nim || ''})</div>
        <div class="text-slate-500">${n.mata_kuliah_nama} — ${n.semester_akademik}</div>`
      document.getElementById('nlai-uts').value   = n.nilai_uts   ?? ''
      document.getElementById('nlai-uas').value   = n.nilai_uas   ?? ''
      document.getElementById('nlai-tugas').value = n.nilai_tugas ?? ''
    } catch(e) {
      UI.toast('Gagal memuat data nilai', 'error')
      return
    }

    calcPreview()
    document.getElementById('nlai-modal').classList.remove('hidden')
  }

  const closeModal = () => {
    document.getElementById('nlai-modal').classList.add('hidden')
    _editId = null
  }

  const onKrsChange = async (krsId) => {
    if (!krsId) { document.getElementById('nlai-krs-info').classList.add('hidden'); return }
    try {
      const res = await API.get(`/krs/${krsId}`)
      const k = res.data
      const info = document.getElementById('nlai-krs-info')
      info.classList.remove('hidden')
      info.innerHTML = `
        <div class="font-medium">${k.mahasiswa_nama} (${k.mahasiswa_nim})</div>
        <div class="text-slate-500">${k.mata_kuliah_nama} — ${k.sks} SKS — ${k.semester_akademik}</div>`
    } catch(e) { /* ignore */ }
  }

  const submitForm = async (e) => {
    e.preventDefault()
    const btn = document.getElementById('nlai-submit-btn')
    btn.disabled = true
    btn.textContent = 'Menyimpan...'
    try {
      if (_editId) {
        await API.put(`/nilai/${_editId}`, {
          nilai_uts:   parseFloat(document.getElementById('nlai-uts').value),
          nilai_uas:   parseFloat(document.getElementById('nlai-uas').value),
          nilai_tugas: parseFloat(document.getElementById('nlai-tugas').value),
          bobot_uts:   parseFloat(document.getElementById('nlai-b-uts').value)   || 0.35,
          bobot_uas:   parseFloat(document.getElementById('nlai-b-uas').value)   || 0.45,
          bobot_tugas: parseFloat(document.getElementById('nlai-b-tugas').value) || 0.20,
        })
        UI.toast('Nilai berhasil diperbarui', 'success')
      } else {
        const krsId = document.getElementById('nlai-krs-id').value
        if (!krsId) { UI.toast('Pilih KRS terlebih dahulu', 'error'); return }
        await API.post('/nilai', {
          krs_id:      krsId,
          nilai_uts:   parseFloat(document.getElementById('nlai-uts').value),
          nilai_uas:   parseFloat(document.getElementById('nlai-uas').value),
          nilai_tugas: parseFloat(document.getElementById('nlai-tugas').value),
          bobot_uts:   parseFloat(document.getElementById('nlai-b-uts').value)   || 0.35,
          bobot_uas:   parseFloat(document.getElementById('nlai-b-uas').value)   || 0.45,
          bobot_tugas: parseFloat(document.getElementById('nlai-b-tugas').value) || 0.20,
        })
        UI.toast('Nilai berhasil diinput', 'success')
      }
      closeModal()
      await Promise.all([fetchRekap(), fetchList()])
    } catch(err) {
      UI.toast(err.message || 'Gagal menyimpan nilai', 'error')
    } finally {
      btn.disabled = false
      btn.textContent = 'Simpan Nilai'
    }
  }

  // ── KUNCI ──────────────────────────────────────────────────
  const kunci = async (id, nama, mk) => {
    if (!confirm(`Kunci nilai ${mk} untuk ${nama}?\nNilai yang dikunci tidak dapat diedit langsung.`)) return
    try {
      await API.post(`/nilai/${id}/kunci`)
      UI.toast('Nilai berhasil dikunci', 'success')
      await Promise.all([fetchRekap(), fetchList()])
    } catch(err) {
      UI.toast(err.message || 'Gagal mengunci nilai', 'error')
    }
  }

  // ── KOREKSI ────────────────────────────────────────────────
  let _koreksiId = null

  const openKoreksi = (id, nama, mk) => {
    _koreksiId = id
    document.getElementById('nlai-koreksi-info').textContent =
      `Membuka nilai ${mk} untuk ${nama}. Tuliskan alasan koreksi:`
    document.getElementById('nlai-koreksi-alasan').value = ''
    document.getElementById('nlai-koreksi-modal').classList.remove('hidden')
  }

  const closeKoreksiModal = () => {
    document.getElementById('nlai-koreksi-modal').classList.add('hidden')
    _koreksiId = null
  }

  const submitKoreksi = async () => {
    const alasan = document.getElementById('nlai-koreksi-alasan').value.trim()
    if (!alasan) { UI.toast('Alasan koreksi wajib diisi', 'error'); return }
    try {
      await API.post(`/nilai/${_koreksiId}/koreksi`, { alasan })
      UI.toast('Nilai dibuka untuk koreksi', 'success')
      closeKoreksiModal()
      await Promise.all([fetchRekap(), fetchList()])
    } catch(err) {
      UI.toast(err.message || 'Gagal membuka koreksi', 'error')
    }
  }

  // ── FILTER / SEARCH / PAGINATION ───────────────────────────
  let searchTimer = null
  const onSearch = (val) => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      state.search = val; state.page = 1; fetchList()
    }, 400)
  }
  const onFilter = (key, val) => {
    state[key] = val; state.page = 1
    if (key === 'semester_akademik') { state.rekap = null; fetchRekap() }
    fetchList()
  }
  const goPage = (p) => { state.page = p; fetchList() }

  return {
    render, onSearch, onFilter, goPage,
    openInput, openEdit, closeModal, onKrsChange, submitForm, calcPreview,
    kunci, openKoreksi, closeKoreksiModal, submitKoreksi,
  }
})()
