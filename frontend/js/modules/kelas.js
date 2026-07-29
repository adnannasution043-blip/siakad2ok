// ============================================================
// KELAS.JS — Kelas & Jadwal
// Dua view: Tabel (CRUD) dan Jadwal (weekly grid)
// ============================================================
const KelasModule = (() => {

  let view = 'tabel'  // 'tabel' | 'jadwal'
  let state = {
    list: [], meta: null,
    mkList: [], dosenList: [], ruangList: [], prodiList: [], semesters: [],
    page: 1, search: '', semester_akademik: '', prodi_id: '', dosen_id: '', hari: '',
    jadwalData: null,
    jadwalSemester: '', jadwalProdi: '',
  }

  const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const HARI_COLOR = {
    Senin: 'bg-blue-50 border-blue-200 text-blue-800',
    Selasa: 'bg-purple-50 border-purple-200 text-purple-800',
    Rabu: 'bg-green-50 border-green-200 text-green-800',
    Kamis: 'bg-orange-50 border-orange-200 text-orange-800',
    Jumat: 'bg-rose-50 border-rose-200 text-rose-800',
    Sabtu: 'bg-slate-50 border-slate-200 text-slate-800',
  }

  // ── Data loaders ──────────────────────────────────────────
  const loadRefs = async () => {
    if (state.mkList.length) return
    const [mk, dosen, ruang, prodi, sems] = await Promise.all([
      API.get('/master/mk', { per_page: 200 }),
      API.get('/dosen', { per_page: 200 }),
      API.get('/master/ruang', { per_page: 200 }),
      API.get('/master/prodi', { per_page: 100 }),
      API.get('/kelas/semesters'),
    ])
    state.mkList     = mk.data || []
    state.dosenList  = dosen.data || []
    state.ruangList  = ruang.data || []
    state.prodiList  = prodi.data || []
    state.semesters  = sems.data || []
    if (!state.semester_akademik && state.semesters.length) {
      state.semester_akademik = state.semesters[0]
      state.jadwalSemester    = state.semesters[0]
    }
  }

  const fetchList = async () => {
    const res = await API.get('/kelas', {
      page: state.page, per_page: 20,
      search: state.search,
      semester_akademik: state.semester_akademik,
      prodi_id: state.prodi_id,
      dosen_id: state.dosen_id,
      hari: state.hari,
    })
    state.list = res.data
    state.meta = res.meta
    renderTable()
    renderPagination()
  }

  const fetchJadwal = async () => {
    const el = document.getElementById('jadwal-grid')
    if (!el) return
    el.innerHTML = `<div class="text-center py-10 text-slate-400">Memuat jadwal…</div>`
    const res = await API.get('/kelas/jadwal', {
      semester_akademik: state.jadwalSemester,
      prodi_id: state.jadwalProdi,
    })
    state.jadwalData = res.data
    renderJadwalGrid()
  }

  // ── Main render ──────────────────────────────────────────
  const render = async () => {
    Router.setPageMeta('Kelas & Jadwal', 'Manajemen kelas dan jadwal kuliah')
    try { await loadRefs() } catch(e) { console.warn('loadRefs failed:', e) }

    document.getElementById('page-content').innerHTML = `
      <!-- View toggle -->
      <div class="flex items-center justify-between mb-5">
        <div class="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
          <button id="view-tabel" onclick="KelasModule.switchView('tabel')"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view==='tabel'?'bg-primary-600 text-white':'text-slate-600 hover:bg-slate-100'}">
            <span class="flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18M10 4v16M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"/></svg>
              Tabel
            </span>
          </button>
          <button id="view-jadwal" onclick="KelasModule.switchView('jadwal')"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view==='jadwal'?'bg-primary-600 text-white':'text-slate-600 hover:bg-slate-100'}">
            <span class="flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              Jadwal Mingguan
            </span>
          </button>
        </div>
        <button onclick="KelasModule.openForm()"
          class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Buat Kelas
        </button>
      </div>
      <div id="view-content"></div>
    `

    if (view === 'tabel') renderTabelView()
    else renderJadwalView()
  }

  const switchView = (v) => {
    view = v
    document.getElementById('view-tabel').className = `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${v==='tabel'?'bg-primary-600 text-white':'text-slate-600 hover:bg-slate-100'}`
    document.getElementById('view-jadwal').className = `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${v==='jadwal'?'bg-primary-600 text-white':'text-slate-600 hover:bg-slate-100'}`
    if (v === 'tabel') renderTabelView()
    else renderJadwalView()
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: TABEL
  // ══════════════════════════════════════════════════════════
  const renderTabelView = () => {
    document.getElementById('view-content').innerHTML = `
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div class="flex-1 min-w-48">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" placeholder="Cari mata kuliah, dosen, kode kelas…"
              value="${state.search}"
              class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              oninput="KelasModule.onSearch(this.value)" />
          </div>
        </div>
        <select onchange="KelasModule.onFilter('semester_akademik', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Semester</option>
          ${state.semesters.map(s => `<option value="${s}" ${state.semester_akademik===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <select onchange="KelasModule.onFilter('prodi_id', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Prodi</option>
          ${state.prodiList.map(p => `<option value="${p.id}" ${state.prodi_id===p.id?'selected':''}>${p.nama}</option>`).join('')}
        </select>
        <select onchange="KelasModule.onFilter('hari', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Hari</option>
          ${HARI.map(h => `<option value="${h}" ${state.hari===h?'selected':''}>${h}</option>`).join('')}
        </select>
      </div>
      ${UI.card(`
        <div id="kelas-table-wrap"></div>
        <div id="kelas-pagination"></div>
      `)}
    `
    fetchList()
  }

  const renderTable = () => {
    document.getElementById('kelas-table-wrap').innerHTML = UI.renderTable({
      headers: ['Mata Kuliah', 'Kelas', 'Dosen', 'Jadwal', 'Ruang', 'Peserta', 'Semester', 'Aksi'],
      emptyText: 'Tidak ada kelas ditemukan',
      rows: state.list.map(k => {
        const pct = k.kapasitas > 0 ? Math.round((k.jumlah_peserta / k.kapasitas) * 100) : 0
        const barColor = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-yellow-400' : 'bg-green-400'
        const hariColor = HARI_COLOR[k.hari] || 'bg-slate-50 border-slate-200 text-slate-800'
        return `
          <td class="px-4 py-3">
            <div class="font-medium text-slate-800 text-sm">${k.mata_kuliah_nama}</div>
            <div class="text-xs text-slate-400 font-mono">${k.mata_kuliah_kode} · ${k.sks} SKS</div>
          </td>
          <td class="px-4 py-3 text-center">
            <span class="badge bg-primary-100 text-primary-700 font-bold">${k.kode_kelas}</span>
          </td>
          <td class="px-4 py-3 text-sm text-slate-600">${k.dosen_nama}</td>
          <td class="px-4 py-3 text-sm">
            <span class="badge border ${hariColor} text-xs font-medium">${k.hari}</span>
            <div class="text-xs text-slate-500 mt-0.5">${k.jam_mulai}–${k.jam_selesai}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-600">${k.ruang_nama}</td>
          <td class="px-4 py-3 min-w-28">
            <div class="flex items-center gap-2">
              <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div class="${barColor} h-full rounded-full" style="width:${pct}%"></div>
              </div>
              <span class="text-xs text-slate-500 whitespace-nowrap">${k.jumlah_peserta}/${k.kapasitas}</span>
            </div>
          </td>
          <td class="px-4 py-3 text-xs text-slate-500">${k.semester_akademik}</td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-1">
              <button onclick="KelasModule.openDetail('${k.id}')" title="Detail"
                class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary-600 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              </button>
              <button onclick="KelasModule.openForm('${k.id}')" title="Edit"
                class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button onclick="KelasModule.confirmDelete('${k.id}','${k.mata_kuliah_kode} ${k.kode_kelas}')" title="Hapus"
                class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </td>
        `
      })
    })
  }

  const renderPagination = () => {
    document.getElementById('kelas-pagination').innerHTML =
      UI.renderPagination(state.meta, 'KelasModule.goPage')
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: JADWAL MINGGUAN
  // ══════════════════════════════════════════════════════════
  const renderJadwalView = () => {
    document.getElementById('view-content').innerHTML = `
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <select onchange="KelasModule.jadwalFilter('jadwalSemester', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          ${state.semesters.map(s => `<option value="${s}" ${state.jadwalSemester===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <select onchange="KelasModule.jadwalFilter('jadwalProdi', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Prodi</option>
          ${state.prodiList.map(p => `<option value="${p.id}" ${state.jadwalProdi===p.id?'selected':''}>${p.nama}</option>`).join('')}
        </select>
      </div>
      <div id="jadwal-grid" class="overflow-x-auto"></div>
    `
    fetchJadwal()
  }

  const renderJadwalGrid = () => {
    const el = document.getElementById('jadwal-grid')
    if (!el || !state.jadwalData) return

    const harisWithData = HARI.filter(h => (state.jadwalData[h] || []).length > 0)
    if (!harisWithData.length) {
      el.innerHTML = `<div class="text-center py-12 text-slate-400">Tidak ada jadwal untuk filter ini</div>`
      return
    }

    const cols = harisWithData.map(h => {
      const kelas = state.jadwalData[h] || []
      const cards = kelas.map(k => {
        const pct = k.kapasitas > 0 ? Math.round(((k.jumlah_peserta || 0) / k.kapasitas) * 100) : 0
        return `
          <div class="border rounded-lg p-3 mb-2 bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow"
               onclick="KelasModule.openDetail('${k.id}')">
            <div class="font-semibold text-slate-800 text-xs leading-tight">${k.mata_kuliah_kode} ${k.kode_kelas}</div>
            <div class="text-xs text-slate-500 truncate mt-0.5">${k.mata_kuliah_nama}</div>
            <div class="text-xs text-slate-400 mt-1">⏰ ${k.jam_mulai}–${k.jam_selesai}</div>
            <div class="text-xs text-slate-400">📍 ${k.ruang_nama}</div>
            <div class="text-xs text-slate-400 truncate">👤 ${k.dosen_nama}</div>
          </div>`
      }).join('')

      const hColor = (HARI_COLOR[h] || 'bg-slate-50').split(' ')[0]
      return `
        <div class="min-w-40 flex-1">
          <div class="text-center py-2 mb-3 rounded-lg font-semibold text-sm ${HARI_COLOR[h] || 'bg-slate-100 text-slate-700'}">${h}</div>
          ${cards || `<div class="text-center text-xs text-slate-300 py-4">Tidak ada kelas</div>`}
        </div>`
    }).join('')

    el.innerHTML = `
      <div class="flex gap-3 min-w-max pb-4">
        ${cols}
      </div>
    `
  }

  // ══════════════════════════════════════════════════════════
  // FORM CRUD
  // ══════════════════════════════════════════════════════════
  const openForm = async (id = null) => {
    await loadRefs()
    const isEdit = !!id
    let k = null
    if (isEdit) {
      try { const r = await API.get(`/kelas/${id}`); k = r.data }
      catch (e) { UI.toast(e.message, 'error'); return }
    }

    const semOpts = state.semesters.length
      ? state.semesters.map(s => `<option value="${s}" ${(k?.semester_akademik||state.semester_akademik)===s?'selected':''}>${s}</option>`).join('')
      : `<option value="${state.semester_akademik}">${state.semester_akademik}</option>`

    UI.openModal(`
      <div class="p-5 border-b border-slate-200">
        <h3 class="font-semibold text-slate-800">${isEdit ? 'Edit' : 'Buat'} Kelas</h3>
      </div>
      <form id="kelas-form" class="p-5 space-y-4">
        ${!isEdit ? `
        <div>
          ${UI.select('mata_kuliah_id', 'Mata Kuliah', state.mkList.map(m=>({value:m.id,label:`${m.kode_mk} — ${m.nama} (${m.sks} SKS)`})), '', true)}
        </div>` : `
        <div class="p-3 bg-slate-50 rounded-lg text-sm">
          <span class="text-slate-500">Mata Kuliah:</span>
          <span class="font-medium text-slate-800 ml-2">${k?.mata_kuliah_kode} — ${k?.mata_kuliah_nama}</span>
        </div>`}
        ${UI.select('dosen_id', 'Dosen Pengampu', state.dosenList.map(d=>({value:d.id,label:d.nama_lengkap})), k?.dosen_id||'', true)}
        ${UI.select('ruang_id', 'Ruang', state.ruangList.map(r=>({value:r.id,label:`${r.nama} (${r.gedung}, kap. ${r.kapasitas})`})), k?.ruang_id||'', true)}
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Semester Akademik <span class="text-red-500">*</span></label>
            <select name="semester_akademik" required class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
              ${semOpts}
              <option value="__custom__">+ Ketik baru…</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Kode Kelas <span class="text-red-500">*</span></label>
            <input type="text" name="kode_kelas" value="${k?.kode_kelas||'A'}" required maxlength="3"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="A" />
          </div>
        </div>
        <div id="sem-custom-wrap" class="hidden">
          ${UI.input('semester_akademik_custom', 'Semester Baru', 'text', '', '2025/2026-1')}
        </div>
        <div class="grid grid-cols-3 gap-4">
          ${UI.select('hari', 'Hari', HARI.map(h=>({value:h,label:h})), k?.hari||'Senin', true)}
          ${UI.input('jam_mulai', 'Jam Mulai', 'time', k?.jam_mulai||'08:00', '', true)}
          ${UI.input('jam_selesai', 'Jam Selesai', 'time', k?.jam_selesai||'09:40', '', true)}
        </div>
        <div class="grid grid-cols-2 gap-4">
          ${UI.input('kapasitas', 'Kapasitas', 'number', k?.kapasitas||35, '35', true)}
          ${UI.input('jumlah_pertemuan', 'Jumlah Pertemuan', 'number', k?.jumlah_pertemuan||16, '16', true)}
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Batal</button>
          <button type="submit" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg">
            ${isEdit ? 'Simpan Perubahan' : 'Buat Kelas'}
          </button>
        </div>
      </form>
    `)

    // Toggle semester custom input
    document.querySelector('[name="semester_akademik"]')?.addEventListener('change', (e) => {
      const wrap = document.getElementById('sem-custom-wrap')
      wrap.classList.toggle('hidden', e.target.value !== '__custom__')
    })

    document.getElementById('kelas-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const body = Object.fromEntries(fd.entries())

      // Handle custom semester
      if (body.semester_akademik === '__custom__') {
        body.semester_akademik = (body.semester_akademik_custom || '').trim()
        if (!body.semester_akademik) { UI.toast('Masukkan semester baru', 'error'); return }
      }
      delete body.semester_akademik_custom
      body.kapasitas = parseInt(body.kapasitas)
      body.jumlah_pertemuan = parseInt(body.jumlah_pertemuan)

      if (!isEdit) body.mata_kuliah_id = fd.get('mata_kuliah_id')

      const btn = e.target.querySelector('button[type=submit]')
      btn.disabled = true; btn.textContent = 'Menyimpan…'
      try {
        if (isEdit) {
          await API.put(`/kelas/${id}`, body)
          UI.toast('Kelas berhasil diperbarui')
        } else {
          await API.post('/kelas', body)
          UI.toast('Kelas berhasil dibuat')
        }
        UI.closeModal()
        if (view === 'tabel') await fetchList()
        else await fetchJadwal()
      } catch (err) {
        UI.toast(err.message || 'Gagal menyimpan', 'error')
        btn.disabled = false
        btn.textContent = isEdit ? 'Simpan Perubahan' : 'Buat Kelas'
      }
    })
  }

  // ── Detail modal ─────────────────────────────────────────
  const openDetail = async (id) => {
    try {
      const res = await API.get(`/kelas/${id}`)
      const k = res.data
      const pct = k.kapasitas > 0 ? Math.round((k.jumlah_peserta / k.kapasitas) * 100) : 0
      const barColor = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-yellow-400' : 'bg-green-400'
      UI.openModal(`
        <div class="p-5 border-b border-slate-200">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-semibold text-slate-800">${k.mata_kuliah_nama}</h3>
              <p class="text-sm text-slate-500">${k.mata_kuliah_kode} · Kelas ${k.kode_kelas} · ${k.sks} SKS</p>
            </div>
            <span class="badge bg-primary-100 text-primary-700 font-bold text-base px-3">${k.kode_kelas}</span>
          </div>
        </div>
        <div class="p-5 space-y-4">
          <div class="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg text-center">
            <div>
              <p class="text-2xl font-bold text-primary-600">${k.jumlah_peserta}</p>
              <p class="text-xs text-slate-500">Peserta / ${k.kapasitas}</p>
              <div class="h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div class="${barColor} h-full rounded-full" style="width:${pct}%"></div>
              </div>
            </div>
            <div>
              <p class="text-2xl font-bold text-slate-800">${k.pertemuan_ke}/${k.jumlah_pertemuan}</p>
              <p class="text-xs text-slate-500">Pertemuan</p>
            </div>
          </div>
          <table class="w-full text-sm">
            ${dRow('Semester', k.semester_akademik)}
            ${dRow('Dosen', k.dosen_nama)}
            ${dRow('Hari', k.hari)}
            ${dRow('Jam', `${k.jam_mulai} – ${k.jam_selesai}`)}
            ${dRow('Ruang', k.ruang_nama)}
            ${dRow('Program Studi', k.program_studi?.nama || '—')}
          </table>
          <div class="flex justify-end gap-2">
            <button onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Tutup</button>
            <button onclick="UI.closeModal(); KelasModule.openForm('${k.id}')"
              class="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">Edit</button>
          </div>
        </div>
      `)
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const dRow = (label, value) => `
    <tr class="border-b border-slate-100">
      <td class="py-2 pr-4 text-slate-500 font-medium w-36">${label}</td>
      <td class="py-2 text-slate-800">${value}</td>
    </tr>`

  // ── Delete ────────────────────────────────────────────────
  const confirmDelete = (id, label) => {
    UI.openModal(`
      <div class="p-6 text-center">
        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3 class="font-semibold text-slate-800 mb-1">Hapus Kelas?</h3>
        <p class="text-sm text-slate-500 mb-6">Kelas <strong>${label}</strong> akan dihapus dari sistem.</p>
        <div class="flex justify-center gap-3">
          <button onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Batal</button>
          <button onclick="KelasModule.doDelete('${id}')" class="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Ya, Hapus</button>
        </div>
      </div>
    `)
  }

  const doDelete = async (id) => {
    try {
      await API.delete(`/kelas/${id}`)
      UI.closeModal()
      UI.toast('Kelas berhasil dihapus')
      if (view === 'tabel') await fetchList()
      else await fetchJadwal()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  // ── Event handlers ────────────────────────────────────────
  let searchTimer = null
  const onSearch = (val) => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => { state.search = val; state.page = 1; fetchList() }, 400)
  }
  const onFilter = (key, val) => { state[key] = val; state.page = 1; fetchList() }
  const goPage = (p) => { state.page = p; fetchList() }
  const jadwalFilter = (key, val) => { state[key] = val; fetchJadwal() }

  return { render, switchView, onSearch, onFilter, goPage, jadwalFilter, openForm, openDetail, confirmDelete, doDelete }
})()
