// ============================================================
// KALENDER.JS — Kalender Akademik
// ============================================================
const KalenderModule = (() => {

  let state = {
    list: [], meta: null,
    page: 1, search: '', semester_akademik: '',
  }

  const KODE_LABEL = {
    pmb:          'PMB',
    registrasi:   'Registrasi Ulang',
    krs:          'Pengisian KRS',
    perkuliahan:  'Perkuliahan',
    uts:          'UTS',
    uas:          'UAS',
    nilai:        'Input Nilai',
    remedi:       'Remediasi',
    sp:           'Semester Pendek',
    wisuda:       'Wisuda',
    libur:        'Libur Akademik',
  }

  const KODE_COLOR = {
    pmb:          'bg-purple-100 text-purple-700',
    registrasi:   'bg-blue-100 text-blue-700',
    krs:          'bg-indigo-100 text-indigo-700',
    perkuliahan:  'bg-green-100 text-green-700',
    uts:          'bg-yellow-100 text-yellow-700',
    uas:          'bg-orange-100 text-orange-700',
    nilai:        'bg-teal-100 text-teal-700',
    remedi:       'bg-pink-100 text-pink-700',
    sp:           'bg-cyan-100 text-cyan-700',
    wisuda:       'bg-rose-100 text-rose-700',
    libur:        'bg-slate-100 text-slate-600',
  }

  const STATUS_BADGE = {
    active:   '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block"></span>Aktif</span>',
    upcoming: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Mendatang</span>',
    past:     '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Selesai</span>',
    unknown:  '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-400">—</span>',
  }

  const fmt = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // ── Fetch & render ─────────────────────────────────────────
  const fetchData = async () => {
    try {
      const res = await API.get('/kalender', {
        page: state.page, per_page: 50,
        search: state.search,
        semester_akademik: state.semester_akademik,
      })
      state.list = res.data || []
      state.meta = res.meta
      renderTable()
      renderPagination()
    } catch (e) {
      document.getElementById('kal-table-wrap').innerHTML =
        `<p class="text-center text-red-500 py-6 text-sm">${e.message}</p>`
    }
  }

  // ── Render page skeleton ───────────────────────────────────
  const render = async () => {
    Router.setPageMeta('Kalender Akademik', 'Jadwal periode akademik per semester')

    // Collect unique semesters from cached data for filter
    let semesters = []
    try {
      const res = await API.get('/kalender', { per_page: 200 })
      const all = res.data || []
      semesters = [...new Set(all.map(r => r.semester_akademik).filter(Boolean))].sort().reverse()
    } catch (_) {}

    const user = Auth.getUser()
    const canEdit = ['super_admin', 'admin_akademik', 'kaprodi'].includes(user?.role)

    document.getElementById('page-content').innerHTML = `
      <!-- Active periods banner -->
      <div id="kal-aktif-banner"></div>

      <!-- Toolbar -->
      <div class="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex-1 min-w-48 relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input id="kal-search" type="text" placeholder="Cari nama atau keterangan..."
              value="${state.search}"
              class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              oninput="KalenderModule.onSearch(this.value)" />
          </div>
          <select id="kal-sem-filter"
            onchange="KalenderModule.onSemFilter(this.value)"
            class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
            <option value="">Semua Semester</option>
            ${semesters.map(s => `<option value="${s}" ${state.semester_akademik === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          ${canEdit ? `
          <button onclick="KalenderModule.openForm()"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Tambah Periode
          </button>` : ''}
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div id="kal-table-wrap">
          <div class="flex items-center justify-center h-32 text-slate-400 text-sm">Memuat…</div>
        </div>
        <div id="kal-pagination" class="px-4 py-3 border-t border-slate-100"></div>
      </div>
    `

    await loadBanner()
    await fetchData()
  }

  // ── Active periods banner ──────────────────────────────────
  const loadBanner = async () => {
    try {
      const res = await API.get('/kalender/aktif')
      const aktif = res.data || []
      const el = document.getElementById('kal-aktif-banner')
      if (!el) return
      if (!aktif.length) {
        el.innerHTML = ''
        return
      }
      el.innerHTML = `
        <div class="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <div class="flex-1">
              <p class="text-sm font-semibold text-green-800 mb-1">Periode Aktif Hari Ini</p>
              <div class="flex flex-wrap gap-2">
                ${aktif.map(p => `
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white border border-green-200 text-green-700">
                    <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block"></span>
                    ${escHtml(p.nama)} — ${escHtml(p.semester_akademik)}
                    <span class="text-green-400">(s.d. ${fmt(p.tanggal_selesai)})</span>
                  </span>`).join('')}
              </div>
            </div>
          </div>
        </div>`
    } catch (_) {}
  }

  // ── Render table ───────────────────────────────────────────
  const renderTable = () => {
    const wrap = document.getElementById('kal-table-wrap')
    if (!wrap) return
    const user = Auth.getUser()
    const canEdit = ['super_admin', 'admin_akademik', 'kaprodi'].includes(user?.role)

    if (!state.list.length) {
      wrap.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <p class="text-sm">Belum ada periode kalender</p>
          ${canEdit ? `<button onclick="KalenderModule.openForm()" class="text-primary-600 text-sm hover:underline">+ Tambah periode baru</button>` : ''}
        </div>`
      return
    }

    // Group by semester
    const grouped = {}
    state.list.forEach(r => {
      const sem = r.semester_akademik || '—'
      if (!grouped[sem]) grouped[sem] = []
      grouped[sem].push(r)
    })

    const rows = Object.entries(grouped).map(([sem, items]) => `
      <tbody>
        <tr>
          <td colspan="${canEdit ? 6 : 5}" class="px-4 py-2 bg-slate-50 border-t border-b border-slate-200">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">${escHtml(sem)}</span>
          </td>
        </tr>
        ${items.map(r => `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
          <td class="px-4 py-3">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${KODE_COLOR[r.kode] || 'bg-slate-100 text-slate-600'}">
              ${escHtml(KODE_LABEL[r.kode] || r.kode)}
            </span>
          </td>
          <td class="px-4 py-3 text-sm font-medium text-slate-800">${escHtml(r.nama)}</td>
          <td class="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">${fmt(r.tanggal_mulai)}</td>
          <td class="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">${fmt(r.tanggal_selesai)}</td>
          <td class="px-4 py-3">${STATUS_BADGE[r.status_hari_ini] || STATUS_BADGE.unknown}</td>
          ${canEdit ? `
          <td class="px-4 py-3 text-right">
            <div class="flex justify-end gap-1">
              <button onclick="KalenderModule.openForm('${r.id}')"
                class="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button onclick="KalenderModule.confirmDelete('${r.id}', '${escHtml(r.nama).replace(/'/g,"\\'")}') "
                class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </td>` : ''}
        </tr>`).join('')}
      </tbody>`).join('')

    wrap.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Tipe</th>
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Periode</th>
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Mulai</th>
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Selesai</th>
              <th class="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Status</th>
              ${canEdit ? `<th class="px-4 py-3 w-20"></th>` : ''}
            </tr>
          </thead>
          ${rows}
        </table>
      </div>`
  }

  const renderPagination = () => {
    const el = document.getElementById('kal-pagination')
    if (!el || !state.meta) { if (el) el.innerHTML = ''; return }
    const { page, total_pages, total } = state.meta
    if (total_pages <= 1) { el.innerHTML = ''; return }
    el.innerHTML = `
      <div class="flex items-center justify-between">
        <p class="text-xs text-slate-500">Total ${total} periode</p>
        <div class="flex gap-1">
          <button onclick="KalenderModule.goPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}
            class="px-3 py-1 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">‹</button>
          <span class="px-3 py-1 text-sm text-slate-600">${page} / ${total_pages}</span>
          <button onclick="KalenderModule.goPage(${page + 1})" ${page >= total_pages ? 'disabled' : ''}
            class="px-3 py-1 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">›</button>
        </div>
      </div>`
  }

  // ── Form (add / edit) ──────────────────────────────────────
  const openForm = async (id = null) => {
    let rec = null
    if (id) {
      try { rec = (await API.get(`/kalender/${id}`)).data } catch (e) { UI.toast(e.message, 'error'); return }
    }

    const KODE_OPTIONS = Object.entries(KODE_LABEL)
      .map(([k, l]) => `<option value="${k}" ${rec?.kode === k ? 'selected' : ''}>${l}</option>`)
      .join('')

    UI.openModal(`
      <div class="p-5">
        <h3 class="text-base font-semibold text-slate-800 mb-4">${id ? 'Edit' : 'Tambah'} Periode Kalender</h3>
        <form id="kal-form" class="space-y-4" onsubmit="KalenderModule.submitForm(event, '${id || ''}')">

          <div class="grid grid-cols-1 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Semester Akademik <span class="text-red-500">*</span></label>
              <input name="semester_akademik" type="text" placeholder="mis. Ganjil 2026/2027"
                value="${escHtml(rec?.semester_akademik || '')}"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" required />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Tipe Periode <span class="text-red-500">*</span></label>
              <select name="kode" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white" required>
                <option value="">Pilih tipe…</option>
                ${KODE_OPTIONS}
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Nama Periode <span class="text-red-500">*</span></label>
              <input name="nama" type="text" placeholder="mis. Pengisian KRS Ganjil 2026/2027"
                value="${escHtml(rec?.nama || '')}"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" required />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Tanggal Mulai <span class="text-red-500">*</span></label>
                <input name="tanggal_mulai" type="date"
                  value="${rec?.tanggal_mulai || ''}"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" required />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Tanggal Selesai <span class="text-red-500">*</span></label>
                <input name="tanggal_selesai" type="date"
                  value="${rec?.tanggal_selesai || ''}"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" required />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Keterangan</label>
              <textarea name="keterangan" rows="2" placeholder="Opsional"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none">${escHtml(rec?.keterangan || '')}</textarea>
            </div>
          </div>

          <div id="kal-form-err" class="hidden text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg"></div>

          <div class="flex gap-3 pt-1">
            <button type="button" onclick="UI.closeModal()"
              class="flex-1 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">Batal</button>
            <button type="submit" id="kal-form-btn"
              class="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors">
              ${id ? 'Simpan Perubahan' : 'Tambah Periode'}
            </button>
          </div>
        </form>
      </div>
    `)
  }

  const submitForm = async (e, id) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = Object.fromEntries(fd.entries())
    const errEl = document.getElementById('kal-form-err')
    const btn   = document.getElementById('kal-form-btn')
    errEl.classList.add('hidden')
    btn.disabled = true
    btn.textContent = 'Menyimpan…'
    try {
      if (id) {
        await API.put(`/kalender/${id}`, body)
        UI.toast('Periode berhasil diperbarui')
      } else {
        await API.post('/kalender', body)
        UI.toast('Periode berhasil ditambahkan')
      }
      UI.closeModal()
      state.page = 1
      await render()
    } catch (err) {
      errEl.textContent = err.message || 'Terjadi kesalahan'
      errEl.classList.remove('hidden')
      btn.disabled = false
      btn.textContent = id ? 'Simpan Perubahan' : 'Tambah Periode'
    }
  }

  // ── Delete ─────────────────────────────────────────────────
  const confirmDelete = (id, nama) => {
    UI.openModal(`
      <div class="p-5">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-slate-800">Hapus Periode?</h3>
            <p class="text-sm text-slate-500 mt-1">Periode <strong>${escHtml(nama)}</strong> akan dihapus dari kalender akademik.</p>
          </div>
        </div>
        <div class="flex gap-3 mt-5">
          <button onclick="UI.closeModal()"
            class="flex-1 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">Batal</button>
          <button onclick="KalenderModule.doDelete('${id}')"
            class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">Hapus</button>
        </div>
      </div>`)
  }

  const doDelete = async (id) => {
    try {
      await API.delete(`/kalender/${id}`)
      UI.toast('Periode berhasil dihapus')
      UI.closeModal()
      state.page = 1
      await render()
    } catch (e) {
      UI.toast(e.message, 'error')
    }
  }

  // ── Handlers ───────────────────────────────────────────────
  let _searchTimer = null
  const onSearch = (v) => {
    clearTimeout(_searchTimer)
    _searchTimer = setTimeout(() => { state.search = v; state.page = 1; fetchData() }, 300)
  }

  const onSemFilter = (v) => { state.semester_akademik = v; state.page = 1; fetchData() }

  const goPage = (p) => { state.page = p; fetchData() }

  const escHtml = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

  return { render, openForm, submitForm, confirmDelete, doDelete, onSearch, onSemFilter, goPage }
})()
