// ============================================================
// OBE MODULE — Outcome-Based Education
// Tabs: CPL | CPMK | RPS | Penilaian | Laporan
// ============================================================
const OBEModule = (() => {
  const $ = id => document.getElementById(id)

  let state = {
    activeTab: 'cpl',
    editingId: null,
    refsLoaded: false,
    refs: { prodi: [], mk: [], cpl: [], dosen: [], semesters: [] },
    cpl:      { list: [], page: 1, search: '', prodi_id: '' },
    cpmk:     { list: [], page: 1, search: '', mk_id: '' },
    rps:      { list: [], page: 1, search: '', status: '' },
    penilaian:{ list: [], page: 1, search: '', mk_id: '', semester: '' },
    laporan:  { prodi_id: '', mk_id: '' },
  }

  // ── Badge helpers ────────────────────────────────────────────
  const RANAH_LABELS = {
    sikap:'Sikap', pengetahuan:'Pengetahuan',
    keterampilan_umum:'Ket. Umum', keterampilan_khusus:'Ket. Khusus'
  }
  const RANAH_COLORS = {
    sikap:'bg-blue-100 text-blue-700',
    pengetahuan:'bg-purple-100 text-purple-700',
    keterampilan_umum:'bg-green-100 text-green-700',
    keterampilan_khusus:'bg-orange-100 text-orange-700'
  }
  const ranahBadge = r =>
    `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RANAH_COLORS[r]||'bg-slate-100 text-slate-600'}">${RANAH_LABELS[r]||r}</span>`

  const STATUS_COLORS = {
    draft:'bg-slate-100 text-slate-600',
    diajukan:'bg-yellow-100 text-yellow-700',
    disetujui:'bg-green-100 text-green-700'
  }
  const statusBadge = s =>
    `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s]||'bg-slate-100 text-slate-600'}">${s}</span>`

  const progressBar = (pct) => {
    const color = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
    return `<div class="flex items-center gap-2">
      <div class="flex-1 bg-slate-100 rounded-full h-2 min-w-16">
        <div class="${color} h-2 rounded-full transition-all duration-500" style="width:${Math.min(pct,100)}%"></div>
      </div>
      <span class="text-xs font-bold w-10 text-right ${pct>=75?'text-green-700':pct>=50?'text-yellow-700':'text-red-600'}">${pct}%</span>
    </div>`
  }

  const scoreColor = n => n >= 80 ? 'text-green-600' : n >= 60 ? 'text-blue-600' : n > 0 ? 'text-red-500' : 'text-slate-400'

  // ── Input style shorthand ─────────────────────────────────────
  const INP = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  // ── Modal helpers ─────────────────────────────────────────────
  const openModal = (html, wide = false) => {
    UI.openModal(html)
    const box = document.getElementById('modal-box')
    if (box) box.style.maxWidth = wide ? '64rem' : ''
  }

  const closeModal = () => {
    UI.closeModal()
    const box = document.getElementById('modal-box')
    if (box) box.style.maxWidth = ''
    state.editingId = null
  }

  // ── Load refs (once per session) ──────────────────────────────
  const loadRefs = async () => {
    if (state.refsLoaded) return
    try {
      const [prodiRes, mkRes, cplRes, dosenRes, semRes] = await Promise.all([
        API.get('/master/prodi?per_page=100'),
        API.get('/master/mk?per_page=100'),
        API.get('/obe/cpl?per_page=200'),
        API.get('/dosen?per_page=100'),
        API.get('/krs/semesters'),
      ])
      state.refs.prodi     = (prodiRes.data || []).filter(p => p.is_active && !p.deleted_at)
      state.refs.mk        = (mkRes.data || []).filter(m => !m.deleted_at)
      state.refs.cpl       = cplRes.data || []
      state.refs.dosen     = (dosenRes.data || []).filter(d => !d.deleted_at)
      state.refs.semesters = semRes.data || []
      state.refsLoaded = true
    } catch(e) {
      console.warn('OBE loadRefs error', e)
    }
  }

  // ── prodiOptions / mkOptions helpers ─────────────────────────
  const prodiOptions = (selected = '') =>
    `<option value="">Semua Prodi</option>` +
    state.refs.prodi.map(p =>
      `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${p.kode} — ${p.nama}</option>`
    ).join('')

  const mkOptions = (selected = '', placeholder = 'Semua MK') =>
    `<option value="">${placeholder}</option>` +
    state.refs.mk.map(m =>
      `<option value="${m.id}" ${m.id === selected ? 'selected' : ''}>${m.kode} — ${m.nama}</option>`
    ).join('')

  const dosenOptions = (selected = '') =>
    `<option value="">-- Pilih Dosen --</option>` +
    state.refs.dosen.map(d =>
      `<option value="${d.id}" ${d.id === selected ? 'selected' : ''}>${d.nama_lengkap}</option>`
    ).join('')

  const semesterOptions = (selected = '') =>
    `<option value="">Semua Semester</option>` +
    state.refs.semesters.map(s =>
      `<option value="${s}" ${s === selected ? 'selected' : ''}>${s}</option>`
    ).join('')

  // ── Main render ───────────────────────────────────────────────
  const render = async () => {
    const el = $('page-content')
    Router.setPageMeta('OBE — Outcome Based Education', 'CPL, CPMK, RPS, Penilaian, dan Laporan Ketercapaian')
    if (!el) return

    el.innerHTML = `
      <div class="mb-6">
        <h2 class="text-xl font-bold text-slate-800">OBE — Outcome-Based Education</h2>
        <p class="text-slate-500 text-sm mt-1">Pengelolaan CPL, CPMK, RPS, Penilaian, dan Laporan Ketercapaian</p>
      </div>
      <div id="obe-stats" class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6"></div>
      <div class="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 overflow-x-auto">
        ${['cpl','cpmk','rps','penilaian','laporan'].map(t => `
          <button onclick="OBEModule.switchTab('${t}')" id="obe-tab-${t}"
            class="obe-tab px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                   ${state.activeTab===t ? 'bg-white shadow text-primary-700' : 'text-slate-500 hover:text-slate-700'}">
            ${{cpl:'CPL',cpmk:'CPMK',rps:'RPS',penilaian:'Penilaian OBE',laporan:'Laporan Ketercapaian'}[t]}
          </button>`).join('')}
      </div>
      <div id="obe-body"></div>
    `

    await loadRefs()
    loadStats()
    switchTab(state.activeTab)
  }

  const loadStats = async () => {
    try {
      const res = await API.get('/obe/stats')
      if (!res.success) return
      const d = res.data
      const cards = [
        {label:'Total CPL',     val:d.total_cpl,       color:'text-purple-600', bg:'bg-purple-50'},
        {label:'Total CPMK',    val:d.total_cpmk,      color:'text-blue-600',   bg:'bg-blue-50'},
        {label:'Total RPS',     val:d.total_rps,        color:'text-indigo-600', bg:'bg-indigo-50'},
        {label:'RPS Disetujui', val:d.rps_disetujui,   color:'text-green-600',  bg:'bg-green-50'},
        {label:'Data Penilaian',val:d.total_penilaian, color:'text-orange-600', bg:'bg-orange-50'},
      ]
      $('obe-stats').innerHTML = cards.map(c => `
        <div class="bg-white rounded-xl p-4 border border-slate-200 text-center shadow-sm hover:shadow-md transition-shadow">
          <div class="w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center mx-auto mb-2">
            <span class="text-lg font-bold ${c.color}">${c.val}</span>
          </div>
          <div class="text-xs text-slate-500 font-medium">${c.label}</div>
        </div>`).join('')
    } catch(e) {}
  }

  const switchTab = (tab) => {
    state.activeTab = tab
    document.querySelectorAll('.obe-tab').forEach(b => {
      const t = b.id.replace('obe-tab-','')
      b.className = `obe-tab px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
        t === tab ? 'bg-white shadow text-primary-700' : 'text-slate-500 hover:text-slate-700'
      }`
    })
    const tabs = {cpl:renderCPL, cpmk:renderCPMK, rps:renderRPS, penilaian:renderPenilaian, laporan:renderLaporan}
    if (tabs[tab]) tabs[tab]()
  }

  // ══════════════════════════════════════════════════════════════
  // TAB 1 — CPL
  // ══════════════════════════════════════════════════════════════
  const renderCPL = () => {
    const s = state.cpl
    $('obe-body').innerHTML = `
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div class="p-4 border-b border-slate-100">
          <div class="flex flex-wrap gap-3">
            <input id="cpl-search" type="text" placeholder="Cari kode / deskripsi…" value="${s.search}"
              oninput="OBEModule.onCPLSearch()"
              class="${INP} flex-1 min-w-48"/>
            <select id="cpl-prodi" onchange="OBEModule.onCPLSearch()"
              class="${INP} w-auto">
              ${prodiOptions(s.prodi_id)}
            </select>
            <button onclick="OBEModule.openCPLForm()"
              class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5">
              <span>＋</span> Tambah CPL
            </button>
          </div>
        </div>
        <div id="cpl-table" class="p-1">
          <div class="text-center py-12 text-slate-400 text-sm">Memuat data…</div>
        </div>
      </div>`
    loadCPL()
  }

  const onCPLSearch = () => {
    state.cpl.search   = $('cpl-search')?.value || ''
    state.cpl.prodi_id = $('cpl-prodi')?.value  || ''
    state.cpl.page = 1
    loadCPL()
  }

  const loadCPL = async () => {
    const s = state.cpl
    const params = new URLSearchParams({ page: s.page, per_page: 50 })
    if (s.search)   params.set('search', s.search)
    if (s.prodi_id) params.set('prodi_id', s.prodi_id)
    try {
      const res  = await API.get(`/obe/cpl?${params}`)
      const rows = res.data || []
      const meta = res.meta
      $('cpl-table').innerHTML = UI.renderTable({
        headers: ['Kode', 'Program Studi', 'Ranah', 'Deskripsi', 'Aksi'],
        rows: rows.map(r => `
          <td class="px-4 py-3 font-bold text-primary-700">${r.kode}</td>
          <td class="px-4 py-3 text-slate-600 text-sm">${r.prodi_nama}</td>
          <td class="px-4 py-3">${ranahBadge(r.ranah)}</td>
          <td class="px-4 py-3 text-slate-500 text-sm max-w-xs">
            <span title="${r.deskripsi}">${r.deskripsi.length > 90 ? r.deskripsi.slice(0,90)+'…' : r.deskripsi}</span>
          </td>
          <td class="px-4 py-3 whitespace-nowrap">
            <button onclick="OBEModule.openCPLForm('${r.id}')"
              class="text-xs px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 mr-1.5">Edit</button>
            <button onclick="OBEModule.deleteCPL('${r.id}','${r.kode}')"
              class="text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100">Hapus</button>
          </td>`),
        emptyText: 'Belum ada data CPL. Klik "+ Tambah CPL" untuk membuat.',
      }) + UI.renderPagination(meta, `(p)=>{ OBEModule.goPageCPL(p) }`)
    } catch(e) {
      $('cpl-table').innerHTML = `<p class="text-red-500 text-sm p-4">${e.message}</p>`
    }
  }

  const goPageCPL = (p) => { state.cpl.page = p; loadCPL() }

  const openCPLForm = async (id) => {
    state.editingId = id || null
    let rec = {}
    if (id) { try { const r = await API.get(`/obe/cpl/${id}`); rec = r.data || {} } catch(e){} }

    const prodiSelectHtml = `<option value="">-- Pilih Prodi --</option>` +
      state.refs.prodi.map(p =>
        `<option value="${p.id}" data-nama="${p.nama}" ${p.id === rec.prodi_id ? 'selected' : ''}>${p.kode} — ${p.nama}</option>`
      ).join('')

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-slate-800">${id ? 'Edit' : 'Tambah'} CPL</h3>
          <button onclick="OBEModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Kode CPL <span class="text-red-500">*</span></label>
              <input id="cf-kode" value="${rec.kode||''}" placeholder="Mis: CPL-TI-1" class="${INP}"/>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Ranah <span class="text-red-500">*</span></label>
              <select id="cf-ranah" class="${INP}">
                ${['sikap','pengetahuan','keterampilan_umum','keterampilan_khusus'].map(v =>
                  `<option value="${v}" ${rec.ranah===v?'selected':''}>${RANAH_LABELS[v]||v}</option>`).join('')}
              </select>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Program Studi <span class="text-red-500">*</span></label>
            <select id="cf-prodi-id" onchange="OBEModule._onCPLProdiChange()" class="${INP}">
              ${prodiSelectHtml}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Deskripsi CPL <span class="text-red-500">*</span></label>
            <textarea id="cf-deskripsi" rows="4" placeholder="Mahasiswa mampu…"
              class="${INP} resize-none">${rec.deskripsi||''}</textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button onclick="OBEModule.closeModal()"
            class="px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">Batal</button>
          <button onclick="OBEModule.submitCPL()"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg">Simpan</button>
        </div>
      </div>`)
  }

  const _onCPLProdiChange = () => {}

  const submitCPL = async () => {
    const prodiEl   = $('cf-prodi-id')
    const prodiId   = prodiEl?.value || ''
    const prodiNama = prodiEl?.options[prodiEl.selectedIndex]?.textContent?.split('—')[1]?.trim() || ''
    const body = {
      kode:       $('cf-kode').value.trim(),
      ranah:      $('cf-ranah').value,
      prodi_id:   prodiId,
      prodi_nama: prodiNama,
      deskripsi:  $('cf-deskripsi').value.trim(),
    }
    if (!body.kode || !body.prodi_id || !body.deskripsi) return UI.toast('Lengkapi semua field wajib', 'error')
    try {
      if (state.editingId) await API.put(`/obe/cpl/${state.editingId}`, body)
      else                 await API.post('/obe/cpl', body)
      closeModal()
      UI.toast(`CPL berhasil ${state.editingId ? 'diperbarui' : 'ditambahkan'}`)
      state.refsLoaded = false
      await loadRefs()
      loadStats()
      loadCPL()
    } catch(e) { UI.toast(e.message, 'error') }
  }

  const deleteCPL = async (id, kode) => {
    if (!confirm(`Hapus CPL "${kode}"? Tindakan ini tidak bisa dibatalkan.`)) return
    try {
      await API.delete(`/obe/cpl/${id}`)
      UI.toast('CPL berhasil dihapus')
      state.refsLoaded = false
      await loadRefs()
      loadStats()
      loadCPL()
    } catch(e) { UI.toast(e.message, 'error') }
  }

  // ══════════════════════════════════════════════════════════════
  // TAB 2 — CPMK
  // ══════════════════════════════════════════════════════════════
  const renderCPMK = () => {
    const s = state.cpmk
    $('obe-body').innerHTML = `
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div class="p-4 border-b border-slate-100">
          <div class="flex flex-wrap gap-3">
            <input id="cpmk-search" type="text" placeholder="Cari kode / deskripsi…" value="${s.search}"
              oninput="OBEModule.onCPMKSearch()"
              class="${INP} flex-1 min-w-48"/>
            <select id="cpmk-mk" onchange="OBEModule.onCPMKSearch()"
              class="${INP} w-auto">
              ${mkOptions(s.mk_id, 'Semua Mata Kuliah')}
            </select>
            <button onclick="OBEModule.openCPMKForm()"
              class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5">
              <span>＋</span> Tambah CPMK
            </button>
          </div>
        </div>
        <div id="cpmk-table" class="p-1">
          <div class="text-center py-12 text-slate-400 text-sm">Memuat data…</div>
        </div>
      </div>`
    loadCPMK()
  }

  const onCPMKSearch = () => {
    state.cpmk.search = $('cpmk-search')?.value || ''
    state.cpmk.mk_id  = $('cpmk-mk')?.value    || ''
    state.cpmk.page   = 1
    loadCPMK()
  }

  const loadCPMK = async () => {
    const s = state.cpmk
    const params = new URLSearchParams({ page: s.page, per_page: 50 })
    if (s.search) params.set('search', s.search)
    if (s.mk_id)  params.set('mk_id', s.mk_id)
    try {
      const res    = await API.get(`/obe/cpmk?${params}`)
      const rows   = res.data || []
      const cplMap = Object.fromEntries(state.refs.cpl.map(c => [c.id, c.kode]))
      $('cpmk-table').innerHTML = UI.renderTable({
        headers: ['Kode', 'Mata Kuliah', 'CPL Dikover', 'Bobot', 'Deskripsi', 'Aksi'],
        rows: rows.map(r => `
          <td class="px-4 py-3 font-bold text-primary-700">${r.kode}</td>
          <td class="px-4 py-3">
            <div class="font-medium text-slate-800 text-sm">${r.mk_nama}</div>
          </td>
          <td class="px-4 py-3">
            ${(r.cpl_ids||[]).map(cid =>
              `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 mr-1 mb-0.5">${cplMap[cid]||cid}</span>`
            ).join('')||'<span class="text-slate-400 text-xs">—</span>'}
          </td>
          <td class="px-4 py-3">
            <span class="font-bold text-slate-800">${r.bobot}%</span>
          </td>
          <td class="px-4 py-3 text-slate-500 text-xs max-w-xs">
            ${r.deskripsi.length > 70 ? r.deskripsi.slice(0,70)+'…' : r.deskripsi}
          </td>
          <td class="px-4 py-3 whitespace-nowrap">
            <button onclick="OBEModule.openCPMKForm('${r.id}')"
              class="text-xs px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 mr-1.5">Edit</button>
            <button onclick="OBEModule.deleteCPMK('${r.id}','${r.kode}')"
              class="text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100">Hapus</button>
          </td>`),
        emptyText: 'Belum ada data CPMK.',
      }) + UI.renderPagination(res.meta, `(p)=>{ OBEModule.goPageCPMK(p) }`)
    } catch(e) {
      $('cpmk-table').innerHTML = `<p class="text-red-500 text-sm p-4">${e.message}</p>`
    }
  }

  const goPageCPMK = (p) => { state.cpmk.page = p; loadCPMK() }

  const openCPMKForm = async (id) => {
    state.editingId = id || null
    let rec = {}
    if (id) { try { const r = await API.get(`/obe/cpmk/${id}`); rec = r.data || {} } catch(e){} }

    const selectedCpls = rec.cpl_ids || []
    const mkSelectHtml = `<option value="">-- Pilih Mata Kuliah --</option>` +
      state.refs.mk.map(m =>
        `<option value="${m.id}" data-nama="${m.nama}" data-prodi="${m.program_studi_id||''}" ${m.id === rec.mk_id ? 'selected' : ''}>${m.kode} — ${m.nama}</option>`
      ).join('')

    const cplListHtml = state.refs.cpl.length === 0
      ? `<p class="text-slate-400 text-sm">Belum ada CPL — tambahkan di tab CPL dahulu</p>`
      : state.refs.cpl.map(c => `
          <label class="flex items-start gap-2 text-sm cursor-pointer p-1 hover:bg-slate-50 rounded">
            <input type="checkbox" value="${c.id}" ${selectedCpls.includes(c.id) ? 'checked' : ''}
              class="cpl-check mt-0.5 accent-primary-600"/>
            <span>
              <span class="font-semibold text-purple-700">${c.kode}</span>
              <span class="text-slate-400 text-xs ml-1">(${c.prodi_nama})</span>
            </span>
          </label>`).join('')

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-slate-800">${id ? 'Edit' : 'Tambah'} CPMK</h3>
          <button onclick="OBEModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Mata Kuliah <span class="text-red-500">*</span></label>
            <select id="ck-mk-id" class="${INP}">${mkSelectHtml}</select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Kode CPMK <span class="text-red-500">*</span></label>
              <input id="ck-kode" value="${rec.kode||''}" placeholder="Mis: CPMK-1" class="${INP}"/>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Bobot (%) <span class="text-red-500">*</span></label>
              <input id="ck-bobot" type="number" min="0" max="100" value="${rec.bobot||0}" class="${INP}"/>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">CPL yang Dikover</label>
            <div class="border border-slate-200 rounded-lg p-3 max-h-36 overflow-y-auto space-y-1 bg-slate-50">
              ${cplListHtml}
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Deskripsi CPMK <span class="text-red-500">*</span></label>
            <textarea id="ck-deskripsi" rows="3" placeholder="Mahasiswa mampu…"
              class="${INP} resize-none">${rec.deskripsi||''}</textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button onclick="OBEModule.closeModal()"
            class="px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">Batal</button>
          <button onclick="OBEModule.submitCPMK()"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg">Simpan</button>
        </div>
      </div>`)
  }

  const submitCPMK = async () => {
    const mkEl   = $('ck-mk-id')
    const mk_id  = mkEl?.value || ''
    const mk_opt = mkEl?.options[mkEl.selectedIndex]
    const mk_nama = mk_opt?.dataset?.nama || mk_opt?.textContent?.split('—')[1]?.trim() || ''
    const cpl_ids = [...document.querySelectorAll('.cpl-check:checked')].map(c => c.value)
    const body = {
      kode:      $('ck-kode').value.trim(),
      bobot:     parseInt($('ck-bobot').value)||0,
      mk_id, mk_nama, cpl_ids,
      deskripsi: $('ck-deskripsi').value.trim(),
    }
    if (!body.kode || !mk_id || !body.deskripsi) return UI.toast('Lengkapi semua field wajib', 'error')
    try {
      if (state.editingId) await API.put(`/obe/cpmk/${state.editingId}`, body)
      else                 await API.post('/obe/cpmk', body)
      closeModal()
      UI.toast(`CPMK berhasil ${state.editingId ? 'diperbarui' : 'ditambahkan'}`)
      loadStats()
      loadCPMK()
    } catch(e) { UI.toast(e.message, 'error') }
  }

  const deleteCPMK = async (id, kode) => {
    if (!confirm(`Hapus CPMK "${kode}"?`)) return
    try { await API.delete(`/obe/cpmk/${id}`); UI.toast('CPMK dihapus'); loadStats(); loadCPMK() }
    catch(e) { UI.toast(e.message, 'error') }
  }

  // ══════════════════════════════════════════════════════════════
  // TAB 3 — RPS
  // ══════════════════════════════════════════════════════════════
  const renderRPS = () => {
    const s = state.rps
    $('obe-body').innerHTML = `
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div class="p-4 border-b border-slate-100">
          <div class="flex flex-wrap gap-3">
            <input id="rps-search" type="text" placeholder="Cari MK / dosen / semester…" value="${s.search}"
              oninput="OBEModule.onRPSSearch()"
              class="${INP} flex-1 min-w-48"/>
            <select id="rps-status" onchange="OBEModule.onRPSSearch()"
              class="${INP} w-auto">
              <option value="">Semua Status</option>
              ${['draft','diajukan','disetujui'].map(v => `<option value="${v}" ${s.status===v?'selected':''}>${v.charAt(0).toUpperCase()+v.slice(1)}</option>`).join('')}
            </select>
            <button onclick="OBEModule.openRPSForm()"
              class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5">
              <span>＋</span> Buat RPS
            </button>
          </div>
          <div class="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-slate-400 inline-block"></span> Draft</span>
            <span class="text-slate-300">→</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span> Diajukan</span>
            <span class="text-slate-300">→</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Disetujui</span>
          </div>
        </div>
        <div id="rps-table" class="p-1">
          <div class="text-center py-12 text-slate-400 text-sm">Memuat data…</div>
        </div>
      </div>`
    loadRPS()
  }

  const onRPSSearch = () => {
    state.rps.search = $('rps-search')?.value || ''
    state.rps.status = $('rps-status')?.value || ''
    state.rps.page   = 1
    loadRPS()
  }

  const loadRPS = async () => {
    const s = state.rps
    const params = new URLSearchParams({ page: s.page, per_page: 25 })
    if (s.search) params.set('search', s.search)
    if (s.status) params.set('status', s.status)
    try {
      const res  = await API.get(`/obe/rps?${params}`)
      const rows = res.data || []
      $('rps-table').innerHTML = UI.renderTable({
        headers: ['Mata Kuliah', 'SKS', 'Semester', 'Dosen', 'Progress', 'Status', 'Aksi'],
        rows: rows.map(r => {
          const terisi = (r.pertemuan||[]).filter(p => p.topik).length
          const pct    = Math.round(terisi / 16 * 100)
          return `
            <td class="px-4 py-3">
              <div class="font-semibold text-slate-800">${r.mk_nama}</div>
              <div class="text-xs text-slate-400 mt-0.5">${r.mk_kode}</div>
            </td>
            <td class="px-4 py-3 text-slate-600 text-sm">${r.sks} SKS</td>
            <td class="px-4 py-3 text-slate-600 text-sm">${r.semester}</td>
            <td class="px-4 py-3 text-slate-600 text-sm">${r.dosen_nama}</td>
            <td class="px-4 py-3 min-w-32">
              ${progressBar(pct)}
              <div class="text-xs text-slate-400 mt-0.5">${terisi}/16 pertemuan</div>
            </td>
            <td class="px-4 py-3">${statusBadge(r.status)}</td>
            <td class="px-4 py-3 whitespace-nowrap">
              <button onclick="OBEModule.viewRPS('${r.id}')"
                class="text-xs px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 mr-1">Lihat</button>
              <button onclick="OBEModule.openRPSForm('${r.id}')"
                class="text-xs px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 mr-1">Edit</button>
              <button onclick="OBEModule.deleteRPS('${r.id}','${r.mk_nama}')"
                class="text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100">Hapus</button>
            </td>`
        }),
        emptyText: 'Belum ada RPS. Klik "+ Buat RPS" untuk membuat.',
      }) + UI.renderPagination(res.meta, `(p)=>{ OBEModule.goPageRPS(p) }`)
    } catch(e) {
      $('rps-table').innerHTML = `<p class="text-red-500 text-sm p-4">${e.message}</p>`
    }
  }

  const goPageRPS = (p) => { state.rps.page = p; loadRPS() }

  const viewRPS = async (id) => {
    try {
      const res = await API.get(`/obe/rps/${id}`)
      const r   = res.data
      const pertemuan = r.pertemuan || Array.from({length:16},(_,i)=>({minggu:i+1}))
      openModal(`
        <div class="p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-lg font-bold text-slate-800">${r.mk_nama}
                <span class="text-slate-400 font-normal text-sm ml-1">(${r.mk_kode})</span>
              </h3>
              <div class="flex flex-wrap items-center gap-2 mt-1.5 text-sm text-slate-500">
                <span>${r.semester}</span>
                <span class="text-slate-300">•</span>
                <span>${r.dosen_nama}</span>
                <span class="text-slate-300">•</span>
                <span>${r.sks} SKS</span>
                <span class="text-slate-300">•</span>
                ${statusBadge(r.status)}
              </div>
            </div>
            <button onclick="OBEModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl leading-none ml-4">✕</button>
          </div>

          ${r.tujuan_mk ? `
            <div class="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-sm text-blue-800">
              <strong>Tujuan MK:</strong> ${r.tujuan_mk}
            </div>` : ''}

          <h4 class="font-semibold text-sm text-slate-700 mb-2">Rencana 16 Pertemuan</h4>
          <div class="overflow-x-auto rounded-lg border border-slate-200">
            <table class="w-full text-xs">
              <thead>
                <tr class="bg-slate-50 text-slate-500 uppercase">
                  <th class="px-2 py-2 text-center w-10">Mggu</th>
                  <th class="px-3 py-2 text-left">Topik & Subtopik</th>
                  <th class="px-2 py-2 text-left w-24">Metode</th>
                  <th class="px-2 py-2 text-left w-28">Assessment</th>
                  <th class="px-2 py-2 text-left w-24">Media</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${pertemuan.map(p => `
                  <tr class="${p.assessment ? 'bg-amber-50' : 'hover:bg-slate-50'}">
                    <td class="px-2 py-2 text-center font-bold text-slate-600">${p.minggu}</td>
                    <td class="px-3 py-2">
                      <div class="font-medium text-slate-800">${p.topik||'<span class="text-slate-300 italic">Belum diisi</span>'}</div>
                      ${p.subtopik?`<div class="text-slate-400 mt-0.5">${p.subtopik}</div>`:''}
                    </td>
                    <td class="px-2 py-2 text-slate-600 capitalize">${p.metode||'—'}</td>
                    <td class="px-2 py-2 text-slate-600">${p.assessment||'—'}</td>
                    <td class="px-2 py-2 text-slate-600">${p.media||'—'}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>

          ${r.referensi?.length ? `
            <div class="mt-4">
              <p class="text-xs font-semibold text-slate-600 mb-1">Referensi:</p>
              <ul class="text-xs text-slate-500 list-disc list-inside space-y-0.5">
                ${r.referensi.map(ref => `<li>${ref}</li>`).join('')}
              </ul>
            </div>` : ''}

          <div class="flex justify-end mt-5 gap-2">
            <button onclick="OBEModule.openRPSForm('${r.id}'); OBEModule.closeModal();"
              class="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">Edit RPS</button>
            <button onclick="OBEModule.closeModal()"
              class="px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">Tutup</button>
          </div>
        </div>`, true)
    } catch(e) { UI.toast(e.message, 'error') }
  }

  const openRPSForm = async (id) => {
    state.editingId = id || null
    let rec = {}
    if (id) { try { const r = await API.get(`/obe/rps/${id}`); rec = r.data || {} } catch(e){} }

    const pertemuan = rec.pertemuan || Array.from({length:16}, (_,i) => ({minggu: i+1, topik:'', subtopik:'', metode:'ceramah', cpmk_ids:[], assessment:'', media:''}))

    const mkSelectHtml = `<option value="">-- Pilih Mata Kuliah --</option>` +
      state.refs.mk.map(m =>
        `<option value="${m.id}" data-nama="${m.nama}" data-kode="${m.kode}" data-sks="${m.sks||3}"
          ${m.id === rec.mk_id ? 'selected' : ''}>${m.kode} — ${m.nama}</option>`
      ).join('')

    const METODE_OPTS = ['ceramah','diskusi','praktikum','presentasi','studi kasus','project','simulasi']

    const pertemuanHtml = pertemuan.map((p, idx) => `
      <div class="border border-slate-200 rounded-lg overflow-hidden mb-2" id="ptm-block-${p.minggu}">
        <button type="button" onclick="OBEModule._togglePtm(${p.minggu})"
          class="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-left transition-colors">
          <span class="text-sm font-semibold text-slate-700">
            Minggu ${p.minggu}
            ${p.topik ? `<span class="ml-2 text-xs text-slate-400 font-normal">${p.topik.length>40?p.topik.slice(0,40)+'…':p.topik}</span>` : ''}
          </span>
          <span id="ptm-arrow-${p.minggu}" class="text-slate-400 text-xs transform transition-transform ${idx===0?'rotate-90':''}">▶</span>
        </button>
        <div id="ptm-body-${p.minggu}" class="${idx===0 ? '' : 'hidden'} p-4 space-y-3 bg-white">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Topik</label>
              <input id="ptm-topik-${p.minggu}" value="${(p.topik||'').replace(/"/g,'&quot;')}" placeholder="Topik utama pertemuan ini"
                class="${INP} text-xs" onchange="OBEModule._updatePtmHeader(${p.minggu})"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Subtopik</label>
              <input id="ptm-subtopik-${p.minggu}" value="${(p.subtopik||'').replace(/"/g,'&quot;')}" placeholder="Sub-topik (opsional)"
                class="${INP} text-xs"/>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Metode</label>
              <select id="ptm-metode-${p.minggu}" class="${INP} text-xs">
                ${METODE_OPTS.map(v => `<option value="${v}" ${(p.metode||'ceramah')===v?'selected':''}>${v.charAt(0).toUpperCase()+v.slice(1)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Assessment</label>
              <input id="ptm-assessment-${p.minggu}" value="${(p.assessment||'').replace(/"/g,'&quot;')}" placeholder="Tugas / kuis / ujian"
                class="${INP} text-xs"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Media</label>
              <input id="ptm-media-${p.minggu}" value="${(p.media||'').replace(/"/g,'&quot;')}" placeholder="PPT / video / dll"
                class="${INP} text-xs"/>
            </div>
          </div>
        </div>
      </div>`).join('')

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-slate-800">${id ? 'Edit' : 'Buat'} RPS</h3>
          <button onclick="OBEModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>
        <div class="space-y-4">
          <!-- Mata Kuliah -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Mata Kuliah <span class="text-red-500">*</span></label>
            <select id="rf-mk-id" onchange="OBEModule._onRPSMKChange()" class="${INP}">
              ${mkSelectHtml}
            </select>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Kode MK</label>
              <input id="rf-mk-kode" value="${rec.mk_kode||''}" readonly class="${INP} bg-slate-50 text-slate-500" placeholder="Auto"/>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">SKS</label>
              <input id="rf-sks" type="number" min="1" max="6" value="${rec.sks||3}" class="${INP}"/>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select id="rf-status" class="${INP}">
                ${['draft','diajukan','disetujui'].map(s => `<option value="${s}" ${rec.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
              </select>
            </div>
          </div>
          <!-- Dosen -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Dosen Pengampu <span class="text-red-500">*</span></label>
            <select id="rf-dosen-id" onchange="OBEModule._onRPSDosenChange()" class="${INP}">
              ${dosenOptions(rec.dosen_id)}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Semester <span class="text-red-500">*</span></label>
            <select id="rf-semester" class="${INP}">
              <option value="">-- Pilih Semester --</option>
              ${state.refs.semesters.map(s => `<option value="${s}" ${rec.semester===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Tujuan Mata Kuliah</label>
            <textarea id="rf-tujuan" rows="2" placeholder="Mahasiswa mampu…"
              class="${INP} resize-none">${rec.tujuan_mk||''}</textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Deskripsi Singkat</label>
            <textarea id="rf-deskripsi" rows="2" class="${INP} resize-none">${rec.deskripsi_mk||''}</textarea>
          </div>

          <!-- 16 Pertemuan Accordion -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-slate-700">Rencana 16 Pertemuan</label>
              <button type="button" onclick="OBEModule._expandAllPtm()"
                class="text-xs text-primary-600 hover:underline">Buka Semua</button>
            </div>
            <div id="ptm-container" class="max-h-96 overflow-y-auto pr-1">
              ${pertemuanHtml}
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <button onclick="OBEModule.closeModal()"
            class="px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">Batal</button>
          <button onclick="OBEModule.submitRPS()"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg">Simpan RPS</button>
        </div>
      </div>`, true)
  }

  const _togglePtm = (minggu) => {
    const body  = $(`ptm-body-${minggu}`)
    const arrow = $(`ptm-arrow-${minggu}`)
    if (!body) return
    const hidden = body.classList.toggle('hidden')
    if (arrow) arrow.style.transform = hidden ? '' : 'rotate(90deg)'
  }

  const _expandAllPtm = () => {
    for (let i = 1; i <= 16; i++) {
      const body = $(`ptm-body-${i}`)
      const arrow = $(`ptm-arrow-${i}`)
      if (body) body.classList.remove('hidden')
      if (arrow) arrow.style.transform = 'rotate(90deg)'
    }
  }

  const _onRPSMKChange = () => {
    const sel = $('rf-mk-id')
    const opt = sel?.options[sel.selectedIndex]
    if ($('rf-mk-kode')) $('rf-mk-kode').value = opt?.dataset?.kode || ''
    if ($('rf-sks'))     $('rf-sks').value     = opt?.dataset?.sks  || 3
  }

  const _onRPSDosenChange = () => {}

  const submitRPS = async () => {
    const mkEl      = $('rf-mk-id')
    const mk_id     = mkEl?.value || ''
    const mk_opt    = mkEl?.options[mkEl.selectedIndex]
    const mk_nama   = mk_opt?.dataset?.nama || mk_opt?.textContent?.split('—')[1]?.trim() || ''

    const dosenEl   = $('rf-dosen-id')
    const dosen_id  = dosenEl?.value || ''
    const dosen_opt = dosenEl?.options[dosenEl.selectedIndex]
    const dosen_nama = dosen_opt?.textContent?.trim() || ''

    const pertemuan = Array.from({length:16}, (_, idx) => {
      const m = idx + 1
      return {
        minggu:     m,
        topik:      $(`ptm-topik-${m}`)?.value.trim()      || '',
        subtopik:   $(`ptm-subtopik-${m}`)?.value.trim()   || '',
        metode:     $(`ptm-metode-${m}`)?.value             || 'ceramah',
        assessment: $(`ptm-assessment-${m}`)?.value.trim() || '',
        media:      $(`ptm-media-${m}`)?.value.trim()      || '',
        cpmk_ids:   [],
      }
    })

    const body = {
      mk_id, mk_nama,
      mk_kode:    $('rf-mk-kode')?.value.trim() || '',
      sks:        parseInt($('rf-sks')?.value)  || 3,
      semester:   $('rf-semester')?.value       || '',
      status:     $('rf-status')?.value         || 'draft',
      dosen_id, dosen_nama,
      tujuan_mk:    $('rf-tujuan')?.value.trim()    || '',
      deskripsi_mk: $('rf-deskripsi')?.value.trim() || '',
      pertemuan,
    }
    if (!mk_id || !dosen_id || !body.semester) return UI.toast('Pilih MK, Dosen, dan Semester', 'error')
    try {
      if (state.editingId) await API.put(`/obe/rps/${state.editingId}`, body)
      else                 await API.post('/obe/rps', body)
      closeModal()
      UI.toast(`RPS berhasil ${state.editingId ? 'diperbarui' : 'dibuat'}`)
      loadStats()
      loadRPS()
    } catch(e) { UI.toast(e.message, 'error') }
  }

  const _updatePtmHeader = (minggu) => {
    const topik = $(`ptm-topik-${minggu}`)?.value || ''
    const btn   = document.querySelector(`#ptm-block-${minggu} button span:first-child`)
    if (btn) {
      btn.innerHTML = `Minggu ${minggu}` +
        (topik ? ` <span class="ml-2 text-xs text-slate-400 font-normal">${topik.length>40?topik.slice(0,40)+'…':topik}</span>` : '')
    }
  }

  const deleteRPS = async (id, nama) => {
    if (!confirm(`Hapus RPS "${nama}"?`)) return
    try { await API.delete(`/obe/rps/${id}`); UI.toast('RPS dihapus'); loadStats(); loadRPS() }
    catch(e) { UI.toast(e.message, 'error') }
  }

  // ══════════════════════════════════════════════════════════════
  // TAB 4 — PENILAIAN OBE
  // ══════════════════════════════════════════════════════════════
  const renderPenilaian = () => {
    const s = state.penilaian
    $('obe-body').innerHTML = `
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div class="p-4 border-b border-slate-100">
          <div class="flex flex-wrap gap-3">
            <input id="pen-search" type="text" placeholder="Cari mahasiswa / NIM / MK…" value="${s.search}"
              oninput="OBEModule.onPenilaianSearch()"
              class="${INP} flex-1 min-w-48"/>
            <select id="pen-mk" onchange="OBEModule.onPenilaianSearch()"
              class="${INP} w-auto">
              ${mkOptions(s.mk_id, 'Semua Mata Kuliah')}
            </select>
            <select id="pen-semester" onchange="OBEModule.onPenilaianSearch()"
              class="${INP} w-auto">
              ${semesterOptions(s.semester)}
            </select>
            <button onclick="OBEModule.openPenilaianForm()"
              class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5">
              <span>＋</span> Input Penilaian
            </button>
          </div>
        </div>
        <div id="pen-table" class="p-1">
          <div class="text-center py-12 text-slate-400 text-sm">Memuat data…</div>
        </div>
      </div>`
    loadPenilaian()
  }

  const onPenilaianSearch = () => {
    state.penilaian.search   = $('pen-search')?.value   || ''
    state.penilaian.mk_id    = $('pen-mk')?.value       || ''
    state.penilaian.semester = $('pen-semester')?.value || ''
    state.penilaian.page     = 1
    loadPenilaian()
  }

  const loadPenilaian = async () => {
    const s = state.penilaian
    const params = new URLSearchParams({ page: s.page, per_page: 30 })
    if (s.search)   params.set('search', s.search)
    if (s.mk_id)    params.set('mk_id', s.mk_id)
    if (s.semester) params.set('semester', s.semester)
    try {
      const res  = await API.get(`/obe/penilaian?${params}`)
      const rows = res.data || []
      $('pen-table').innerHTML = UI.renderTable({
        headers: ['Mahasiswa', 'NIM', 'Mata Kuliah', 'Semester', 'Skor CPMK', 'Nilai Akhir', 'Aksi'],
        rows: rows.map(r => {
          const na = r.nilai_akhir || 0
          return `
            <td class="px-4 py-3 font-medium text-slate-800">${r.mahasiswa_nama}</td>
            <td class="px-4 py-3 text-slate-500 text-sm font-mono">${r.mahasiswa_nim}</td>
            <td class="px-4 py-3 text-slate-700 text-sm">${r.mk_nama}</td>
            <td class="px-4 py-3 text-slate-500 text-xs">${r.semester}</td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                ${(r.cpmk_scores||[]).map(cs => `
                  <span class="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-slate-100">
                    <span class="text-slate-500">${cs.kode}:</span>
                    <span class="font-bold ${cs.tercapai?'text-green-600':'text-red-500'}">${cs.nilai}</span>
                  </span>`).join('')||'<span class="text-slate-300 text-xs">—</span>'}
              </div>
            </td>
            <td class="px-4 py-3">
              <span class="text-2xl font-bold ${scoreColor(na)}">${na}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <button onclick="OBEModule.openPenilaianForm('${r.id}')"
                class="text-xs px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 mr-1.5">Edit</button>
              <button onclick="OBEModule.deletePenilaian('${r.id}','${r.mahasiswa_nama}')"
                class="text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100">Hapus</button>
            </td>`
        }),
        emptyText: 'Belum ada data penilaian OBE.',
      }) + UI.renderPagination(res.meta, `(p)=>{ OBEModule.goPagePenilaian(p) }`)
    } catch(e) {
      $('pen-table').innerHTML = `<p class="text-red-500 text-sm p-4">${e.message}</p>`
    }
  }

  const goPagePenilaian = (p) => { state.penilaian.page = p; loadPenilaian() }

  const openPenilaianForm = async (id) => {
    state.editingId = id || null
    let rec = {}
    if (id) { try { const r = await API.get(`/obe/penilaian/${id}`); rec = r.data || {} } catch(e){} }

    let cpmkByMk = {}
    try {
      const cpmkRes = await API.get('/obe/cpmk?per_page=200')
      ;(cpmkRes.data||[]).forEach(c => {
        if (!cpmkByMk[c.mk_id]) cpmkByMk[c.mk_id] = []
        cpmkByMk[c.mk_id].push(c)
      })
    } catch(e){}

    const existingScores = Object.fromEntries((rec.cpmk_scores||[]).map(cs => [cs.cpmk_id, cs.nilai]))

    const mkSelectHtml = `<option value="">-- Pilih Mata Kuliah --</option>` +
      state.refs.mk.filter(m => cpmkByMk[m.id]?.length > 0).map(m =>
        `<option value="${m.id}" data-nama="${m.nama}" ${m.id === rec.mk_id ? 'selected' : ''}>${m.kode} — ${m.nama}</option>`
      ).join('')

    window._obeCPMKByMk      = cpmkByMk
    window._obeExistingScores = existingScores

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-slate-800">${id ? 'Edit' : 'Input'} Penilaian OBE</h3>
          <button onclick="OBEModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        <!-- NIM Search → auto-fill -->
        <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
          <p class="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Cari Mahasiswa</p>
          <div class="flex gap-2">
            <input id="pf-nim-search" type="text" placeholder="Ketik NIM lalu tekan Enter atau klik Cari"
              value="${rec.mahasiswa_nim||''}"
              class="${INP} flex-1"
              onkeydown="if(event.key==='Enter') OBEModule.searchMahasiswaByNIM()"/>
            <button onclick="OBEModule.searchMahasiswaByNIM()"
              class="px-3 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 whitespace-nowrap">Cari</button>
          </div>
          <div id="pf-mhs-info" class="mt-2">
            ${rec.mahasiswa_id ? `
              <div class="flex items-center gap-2 text-sm">
                <span class="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
                <span class="font-medium text-slate-800">${rec.mahasiswa_nama}</span>
                <span class="text-slate-400">·</span>
                <span class="text-slate-500 font-mono text-xs">${rec.mahasiswa_nim}</span>
              </div>` : '<p class="text-xs text-slate-400">Masukkan NIM untuk mencari mahasiswa</p>'}
          </div>
          <input type="hidden" id="pf-mhs-id"   value="${rec.mahasiswa_id||''}"/>
          <input type="hidden" id="pf-mhs-nama"  value="${rec.mahasiswa_nama||''}"/>
          <input type="hidden" id="pf-mhs-nim"   value="${rec.mahasiswa_nim||''}"/>
        </div>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Mata Kuliah <span class="text-red-500">*</span></label>
              <select id="pf-mk" onchange="OBEModule.onPenilaianMKChange()" class="${INP}">
                ${mkSelectHtml}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Semester <span class="text-red-500">*</span></label>
              <select id="pf-semester" class="${INP}">
                <option value="">-- Pilih Semester --</option>
                ${state.refs.semesters.map(s => `<option value="${s}" ${rec.semester===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-slate-700">
                Nilai per CPMK <span class="text-red-500">*</span>
                <span class="text-slate-400 font-normal text-xs ml-1">(threshold tercapai: ≥ 60)</span>
              </label>
              <div id="pf-nilai-akhir-preview" class="text-sm font-bold text-slate-500"></div>
            </div>
            <div id="pf-cpmk-scores" class="space-y-2 border border-slate-200 rounded-lg p-3 min-h-16 bg-slate-50">
              <p class="text-slate-400 text-sm text-center py-2">Pilih Mata Kuliah untuk melihat CPMK</p>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button onclick="OBEModule.closeModal()"
            class="px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">Batal</button>
          <button onclick="OBEModule.submitPenilaian()"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg">Simpan Penilaian</button>
        </div>
      </div>`)

    if (rec.mk_id) setTimeout(onPenilaianMKChange, 50)
  }

  const searchMahasiswaByNIM = async () => {
    const nim = $('pf-nim-search')?.value.trim()
    if (!nim) return UI.toast('Masukkan NIM terlebih dahulu', 'warning')
    const infoEl = $('pf-mhs-info')
    infoEl.innerHTML = `<p class="text-xs text-slate-400">Mencari…</p>`
    try {
      const res  = await API.get(`/mahasiswa?search=${encodeURIComponent(nim)}&per_page=5`)
      const list = (res.data || []).filter(m => m.nim === nim || m.nim.includes(nim))
      if (!list.length) {
        infoEl.innerHTML = `<p class="text-xs text-red-500">Mahasiswa dengan NIM "${nim}" tidak ditemukan</p>`
        return
      }
      const m = list[0]
      $('pf-mhs-id').value   = m.id
      $('pf-mhs-nama').value = m.nama_lengkap
      $('pf-mhs-nim').value  = m.nim
      infoEl.innerHTML = `
        <div class="flex items-center gap-2 text-sm">
          <span class="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
          <span class="font-medium text-slate-800">${m.nama_lengkap}</span>
          <span class="text-slate-400">·</span>
          <span class="text-slate-500 font-mono text-xs">${m.nim}</span>
          <span class="text-slate-400">·</span>
          <span class="text-xs text-slate-400">${m.program_studi?.nama||''} ${m.angkatan}</span>
        </div>`
    } catch(e) {
      infoEl.innerHTML = `<p class="text-xs text-red-500">Error: ${e.message}</p>`
    }
  }

  const onPenilaianMKChange = () => {
    const mkId   = $('pf-mk')?.value
    const byMk   = window._obeCPMKByMk || {}
    const scores = window._obeExistingScores || {}
    const cont   = $('pf-cpmk-scores')
    const prev   = $('pf-nilai-akhir-preview')
    if (!cont) return
    if (!mkId || !byMk[mkId]) {
      cont.innerHTML = `<p class="text-slate-400 text-sm text-center py-2">Pilih Mata Kuliah untuk melihat CPMK</p>`
      if (prev) prev.textContent = ''
      return
    }
    const cpmks = byMk[mkId]
    cont.innerHTML = `<div class="space-y-3">${cpmks.map(c => {
      const existVal = scores[c.id] !== undefined ? scores[c.id] : ''
      const tercapai  = existVal !== '' && parseInt(existVal) >= 60
      return `
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-sm font-semibold text-slate-700">${c.kode}</span>
              <span class="text-slate-400 text-xs ml-1">bobot ${c.bobot}%</span>
            </div>
            <span id="score-ind-${c.id}" class="text-xs font-medium w-20 text-right">
              ${existVal !== '' ? (tercapai ? '<span class="text-green-600">✓ Tercapai</span>' : '<span class="text-red-500">✗ Belum</span>') : ''}
            </span>
          </div>
          <p class="text-xs text-slate-400">${c.deskripsi.length>80?c.deskripsi.slice(0,80)+'…':c.deskripsi}</p>
          <div class="flex items-center gap-3">
            <input type="range" min="0" max="100" value="${existVal||0}"
              data-cpmk-id="${c.id}"
              class="cpmk-slider flex-1 accent-primary-600"
              oninput="OBEModule._syncScore(this)"/>
            <input type="number" min="0" max="100" value="${existVal||''}"
              data-cpmk-id="${c.id}" data-bobot="${c.bobot}" data-kode="${c.kode}"
              placeholder="0–100"
              class="cpmk-score-input border border-slate-300 rounded-lg px-2 py-1.5 text-sm w-20 text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
              oninput="OBEModule._syncSlider(this)"/>
          </div>
        </div>`
    }).join('')}</div>`

    const updatePreview = () => {
      const inputs = document.querySelectorAll('.cpmk-score-input')
      let sum = 0, totalBobot = 0
      inputs.forEach(inp => {
        const val   = parseInt(inp.value) || 0
        const bobot = parseInt(inp.dataset.bobot) || 0
        sum += val * bobot
        totalBobot += bobot
      })
      const na = totalBobot > 0 ? Math.round(sum / totalBobot) : 0
      if (prev) prev.innerHTML = `Nilai Akhir: <span class="${scoreColor(na)} text-lg">${na}</span>`
    }

    cont.querySelectorAll('.cpmk-score-input').forEach(inp => inp.addEventListener('input', updatePreview))
    updatePreview()
  }

  const _syncScore = (slider) => {
    const id  = slider.dataset.cpmkId
    const inp = document.querySelector(`.cpmk-score-input[data-cpmk-id="${id}"]`)
    if (inp) { inp.value = slider.value; inp.dispatchEvent(new Event('input')) }
    const ind = $(`score-ind-${id}`)
    const val = parseInt(slider.value)
    if (ind) ind.innerHTML = val >= 60 ? '<span class="text-green-600">✓ Tercapai</span>' : '<span class="text-red-500">✗ Belum</span>'
  }

  const _syncSlider = (inp) => {
    const id     = inp.dataset.cpmkId
    const slider = document.querySelector(`.cpmk-slider[data-cpmk-id="${id}"]`)
    if (slider) slider.value = inp.value || 0
    const ind = $(`score-ind-${id}`)
    const val = parseInt(inp.value)
    if (ind) {
      if (!isNaN(val)) ind.innerHTML = val >= 60 ? '<span class="text-green-600">✓ Tercapai</span>' : '<span class="text-red-500">✗ Belum</span>'
      else ind.innerHTML = ''
    }
  }

  const submitPenilaian = async () => {
    const mhs_id   = $('pf-mhs-id')?.value
    const mhs_nama = $('pf-mhs-nama')?.value
    const mhs_nim  = $('pf-mhs-nim')?.value
    if (!mhs_id)   return UI.toast('Cari dan pilih mahasiswa terlebih dahulu', 'error')

    const mkEl   = $('pf-mk')
    const mk_id  = mkEl?.value
    const mk_opt = mkEl?.options[mkEl.selectedIndex]
    const mk_nama = mk_opt?.dataset?.nama || mk_opt?.textContent?.split('—')[1]?.trim() || ''
    if (!mk_id) return UI.toast('Pilih Mata Kuliah', 'error')

    const semester = $('pf-semester')?.value
    if (!semester) return UI.toast('Pilih Semester', 'error')

    const cpmk_scores = [...document.querySelectorAll('.cpmk-score-input')].map(inp => ({
      cpmk_id: inp.dataset.cpmkId,
      kode:    inp.dataset.kode,
      nilai:   parseInt(inp.value)||0,
    }))
    if (!cpmk_scores.length) return UI.toast('Pilih MK dan isi nilai CPMK', 'error')

    const body = {
      mahasiswa_id:   mhs_id,
      mahasiswa_nama: mhs_nama,
      mahasiswa_nim:  mhs_nim,
      mk_id, mk_nama, semester,
      cpmk_scores,
    }
    try {
      if (state.editingId) await API.put(`/obe/penilaian/${state.editingId}`, body)
      else                 await API.post('/obe/penilaian', body)
      closeModal()
      UI.toast(`Penilaian berhasil ${state.editingId ? 'diperbarui' : 'disimpan'}`)
      loadStats()
      loadPenilaian()
    } catch(e) { UI.toast(e.message, 'error') }
  }

  const deletePenilaian = async (id, nama) => {
    if (!confirm(`Hapus penilaian OBE "${nama}"?`)) return
    try { await API.delete(`/obe/penilaian/${id}`); UI.toast('Data dihapus'); loadStats(); loadPenilaian() }
    catch(e) { UI.toast(e.message, 'error') }
  }

  // ══════════════════════════════════════════════════════════════
  // TAB 5 — LAPORAN KETERCAPAIAN
  // ══════════════════════════════════════════════════════════════
  const renderLaporan = () => {
    const s = state.laporan
    $('obe-body').innerHTML = `
      <div class="space-y-6">

        <!-- Panel CPL -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div class="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="font-semibold text-slate-800">Ketercapaian CPL per Prodi</h3>
              <p class="text-xs text-slate-400 mt-0.5">Rata-rata nilai CPL dari seluruh data penilaian OBE</p>
            </div>
            <select id="lap-prodi" onchange="OBEModule.loadLaporanCPL()"
              class="${INP} w-auto">
              ${prodiOptions(s.prodi_id)}
            </select>
          </div>
          <div id="lap-cpl-summary" class="grid grid-cols-3 gap-3 p-4 pb-0"></div>
          <div id="lap-cpl-body" class="p-1">
            <div class="text-center py-8 text-slate-400 text-sm">Memuat…</div>
          </div>
        </div>

        <!-- Panel CPMK -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div class="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="font-semibold text-slate-800">Ketercapaian CPMK per Mata Kuliah</h3>
              <p class="text-xs text-slate-400 mt-0.5">Rata-rata nilai CPMK berdasarkan data penilaian</p>
            </div>
            <select id="lap-mk" onchange="OBEModule.loadLaporanCPMK()"
              class="${INP} w-auto">
              ${mkOptions(s.mk_id, 'Semua Mata Kuliah')}
            </select>
          </div>
          <div id="lap-cpmk-body" class="p-1">
            <div class="text-center py-8 text-slate-400 text-sm">Memuat…</div>
          </div>
        </div>

      </div>`
    loadLaporanCPL()
    loadLaporanCPMK()
  }

  const loadLaporanCPL = async () => {
    state.laporan.prodi_id = $('lap-prodi')?.value || ''
    const prodi  = state.laporan.prodi_id
    const params = prodi ? `?prodi_id=${prodi}` : ''
    try {
      const res  = await API.get(`/obe/laporan/cpl${params}`)
      const rows = res.data || []

      // Summary cards
      if (rows.length > 0) {
        const avg    = rows.reduce((s, r) => s + r.rata_rata, 0) / rows.length
        const done   = rows.filter(r => r.pct_tercapai >= 75).length
        const sumEl  = $('lap-cpl-summary')
        if (sumEl) sumEl.innerHTML = [
          {label:'Total CPL', val:rows.length, color:'text-purple-600', bg:'bg-purple-50'},
          {label:'Rata-rata Ketercapaian', val:avg.toFixed(1), color:'text-blue-600', bg:'bg-blue-50'},
          {label:'CPL Tercapai (≥75%)', val:`${done}/${rows.length}`, color:'text-green-600', bg:'bg-green-50'},
        ].map(c => `
          <div class="${c.bg} rounded-xl p-3 text-center">
            <div class="text-xl font-bold ${c.color}">${c.val}</div>
            <div class="text-xs text-slate-500 mt-0.5">${c.label}</div>
          </div>`).join('')
      } else {
        const sumEl = $('lap-cpl-summary')
        if (sumEl) sumEl.innerHTML = ''
      }

      $('lap-cpl-body').innerHTML = UI.renderTable({
        headers: ['Kode', 'Program Studi', 'Ranah', 'Rata-rata Nilai', 'Tercapai', '% Ketercapaian'],
        rows: rows.map(r => `
          <td class="px-4 py-3 font-bold text-purple-700">${r.kode}</td>
          <td class="px-4 py-3 text-slate-600 text-sm">${r.prodi}</td>
          <td class="px-4 py-3">${ranahBadge(r.ranah)}</td>
          <td class="px-4 py-3">
            <span class="text-lg font-bold ${scoreColor(r.rata_rata)}">${r.rata_rata}</span>
          </td>
          <td class="px-4 py-3 text-slate-500 text-sm">${r.tercapai}/${r.total_data} mhs</td>
          <td class="px-4 py-3 min-w-36">${progressBar(r.pct_tercapai)}</td>`),
        emptyText: 'Belum ada data penilaian OBE untuk menghitung ketercapaian CPL.',
      })
    } catch(e) {
      $('lap-cpl-body').innerHTML = `<p class="text-red-500 text-sm p-4">${e.message}</p>`
    }
  }

  const loadLaporanCPMK = async () => {
    state.laporan.mk_id = $('lap-mk')?.value || ''
    const mk     = state.laporan.mk_id
    const params = mk ? `?mk_id=${mk}` : ''
    try {
      const res  = await API.get(`/obe/laporan/cpmk${params}`)
      const rows = res.data || []
      $('lap-cpmk-body').innerHTML = UI.renderTable({
        headers: ['Kode', 'Mata Kuliah', 'Bobot', 'Rata-rata Nilai', 'Tercapai', '% Ketercapaian'],
        rows: rows.map(r => `
          <td class="px-4 py-3 font-bold text-blue-700">${r.kode}</td>
          <td class="px-4 py-3 text-slate-700 text-sm">${r.mk_nama}</td>
          <td class="px-4 py-3 text-slate-500 text-sm">${r.bobot}%</td>
          <td class="px-4 py-3">
            <span class="text-lg font-bold ${scoreColor(r.rata_rata)}">${r.rata_rata}</span>
          </td>
          <td class="px-4 py-3 text-slate-500 text-sm">${r.tercapai}/${r.total_data} mhs</td>
          <td class="px-4 py-3 min-w-36">${progressBar(r.pct_tercapai)}</td>`),
        emptyText: 'Belum ada data penilaian OBE untuk menghitung ketercapaian CPMK.',
      })
    } catch(e) {
      $('lap-cpmk-body').innerHTML = `<p class="text-red-500 text-sm p-4">${e.message}</p>`
    }
  }

  // ── Public API ────────────────────────────────────────────────
  return {
    render, switchTab,
    // CPL
    onCPLSearch, openCPLForm, submitCPL, deleteCPL, goPageCPL,
    _onCPLProdiChange,
    // CPMK
    onCPMKSearch, openCPMKForm, submitCPMK, deleteCPMK, goPageCPMK,
    // RPS
    onRPSSearch, openRPSForm, submitRPS, deleteRPS, viewRPS, goPageRPS,
    _togglePtm, _expandAllPtm, _onRPSMKChange, _onRPSDosenChange, _updatePtmHeader,
    // Penilaian
    onPenilaianSearch, openPenilaianForm, submitPenilaian, deletePenilaian, goPagePenilaian,
    onPenilaianMKChange, searchMahasiswaByNIM, _syncScore, _syncSlider,
    // Laporan
    loadLaporanCPL, loadLaporanCPMK,
    // Modal
    closeModal,
  }
})()
