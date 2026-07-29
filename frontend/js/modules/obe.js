// ============================================================
// OBE MODULE — Outcome-Based Education
// Tabs: CPL | CPMK | RPS | Penilaian | Laporan
// ============================================================
const OBEModule = (() => {
  let activeTab = 'cpl'
  let editingId  = null

  // ── helpers ─────────────────────────────────────────────────
  const $ = id => document.getElementById(id)
  const api = path => API.get(path)

  const ranahLabel = r => ({
    sikap:'Sikap', pengetahuan:'Pengetahuan',
    keterampilan_umum:'Ket. Umum', keterampilan_khusus:'Ket. Khusus'
  }[r] || r)

  const ranahBadge = r => {
    const colors = {
      sikap:'bg-blue-100 text-blue-700',
      pengetahuan:'bg-purple-100 text-purple-700',
      keterampilan_umum:'bg-green-100 text-green-700',
      keterampilan_khusus:'bg-orange-100 text-orange-700'
    }
    return `<span class="badge ${colors[r]||'bg-slate-100 text-slate-600'}">${ranahLabel(r)}</span>`
  }

  const statusBadge = s => {
    const m = {draft:'bg-slate-100 text-slate-600', diajukan:'bg-yellow-100 text-yellow-700', disetujui:'bg-green-100 text-green-700'}
    return `<span class="badge ${m[s]||'bg-slate-100 text-slate-600'}">${s}</span>`
  }

  const bar = pct => {
    const color = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
    return `<div class="flex items-center gap-2">
      <div class="flex-1 bg-slate-100 rounded-full h-2">
        <div class="${color} h-2 rounded-full" style="width:${Math.min(pct,100)}%"></div>
      </div>
      <span class="text-xs font-semibold w-10 text-right">${pct}%</span>
    </div>`
  }

  // ── render shell ────────────────────────────────────────────
  const render = () => {
    const el = $('page-content')
    Router.setPageMeta('OBE — Outcome Based Education', 'CPL, CPMK, RPS, Penilaian, dan Laporan Ketercapaian')
    if (!el) return
    el.innerHTML = `
      <div class="mb-6">
        <h2 class="text-xl font-bold text-slate-800">OBE — Outcome-Based Education</h2>
        <p class="text-slate-500 text-sm mt-1">CPL, CPMK, RPS, Penilaian, dan Laporan Ketercapaian</p>
      </div>

      <!-- Stats -->
      <div id="obe-stats" class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6"></div>

      <!-- Tabs -->
      <div class="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 overflow-x-auto">
        ${['cpl','cpmk','rps','penilaian','laporan'].map(t => `
          <button onclick="OBEModule.switchTab('${t}')" id="obe-tab-${t}"
            class="obe-tab px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                   ${activeTab===t ? 'bg-white shadow text-primary-700' : 'text-slate-500 hover:text-slate-700'}">
            ${{cpl:'CPL',cpmk:'CPMK',rps:'RPS',penilaian:'Penilaian OBE',laporan:'Laporan Ketercapaian'}[t]}
          </button>`).join('')}
      </div>

      <!-- Tab content -->
      <div id="obe-body"></div>

      <!-- Modal -->
      <div id="obe-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div id="obe-modal-box" class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"></div>
      </div>
    `
    loadStats()
    switchTab(activeTab)
  }

  const loadStats = async () => {
    try {
      const res = await api('/obe/stats')
      if (!res.success) return
      const d = res.data
      const cards = [
        {label:'Total CPL',    val:d.total_cpl,       color:'text-purple-600'},
        {label:'Total CPMK',   val:d.total_cpmk,      color:'text-blue-600'},
        {label:'Total RPS',    val:d.total_rps,        color:'text-indigo-600'},
        {label:'RPS Disetujui',val:d.rps_disetujui,   color:'text-green-600'},
        {label:'Data Penilaian',val:d.total_penilaian, color:'text-orange-600'},
      ]
      $('obe-stats').innerHTML = cards.map(c => `
        <div class="bg-white rounded-xl p-4 border border-slate-200 text-center">
          <div class="text-2xl font-bold ${c.color}">${c.val}</div>
          <div class="text-xs text-slate-500 mt-1">${c.label}</div>
        </div>`).join('')
    } catch(e) {}
  }

  const switchTab = (tab) => {
    activeTab = tab
    document.querySelectorAll('.obe-tab').forEach(b => {
      const t = b.id.replace('obe-tab-','')
      b.className = `obe-tab px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
        t === tab ? 'bg-white shadow text-primary-700' : 'text-slate-500 hover:text-slate-700'
      }`
    })
    const tabs = {cpl:renderCPL, cpmk:renderCPMK, rps:renderRPS, penilaian:renderPenilaian, laporan:renderLaporan}
    if (tabs[tab]) tabs[tab]()
  }

  // ── CPL TAB ─────────────────────────────────────────────────
  const renderCPL = async () => {
    const body = $('obe-body')
    body.innerHTML = `<div class="bg-white rounded-xl border border-slate-200 p-4">
      <div class="flex flex-wrap gap-3 mb-4">
        <input id="cpl-search" type="text" placeholder="Cari kode / deskripsi..." oninput="OBEModule.filterCPL()"
          class="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-primary-500"/>
        <select id="cpl-prodi" onchange="OBEModule.filterCPL()"
          class="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Semua Prodi</option>
          <option value="prodi-si">Sistem Informasi</option>
          <option value="prodi-if">Informatika</option>
          <option value="prodi-ak">Akuntansi</option>
        </select>
        <button onclick="OBEModule.openCPLForm()" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">+ Tambah CPL</button>
      </div>
      <div id="cpl-table">Memuat...</div>
    </div>`
    filterCPL()
  }

  const filterCPL = async () => {
    const search = $('cpl-search')?.value || ''
    const prodi  = $('cpl-prodi')?.value  || ''
    const params = new URLSearchParams({per_page:100})
    if (search) params.set('search', search)
    if (prodi)  params.set('prodi_id', prodi)
    try {
      const res = await api(`/obe/cpl?${params}`)
      const rows = (res.data || [])
      $('cpl-table').innerHTML = rows.length === 0
        ? `<p class="text-center text-slate-400 py-8">Belum ada CPL</p>`
        : `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="border-b border-slate-100 text-left text-slate-500 text-xs uppercase">
              <th class="pb-2 pr-4">Kode</th><th class="pb-2 pr-4">Prodi</th>
              <th class="pb-2 pr-4">Ranah</th><th class="pb-2 pr-4">Deskripsi</th><th class="pb-2">Aksi</th>
            </tr></thead>
            <tbody>${rows.map(r => `<tr class="border-b border-slate-50 table-row-hover">
              <td class="py-2 pr-4 font-semibold text-primary-700">${r.kode}</td>
              <td class="py-2 pr-4 text-slate-600">${r.prodi_nama}</td>
              <td class="py-2 pr-4">${ranahBadge(r.ranah)}</td>
              <td class="py-2 pr-4 text-slate-600 max-w-xs"><span title="${r.deskripsi}">${r.deskripsi.length>80?r.deskripsi.slice(0,80)+'…':r.deskripsi}</span></td>
              <td class="py-2 whitespace-nowrap">
                <button onclick="OBEModule.openCPLForm('${r.id}')" class="text-blue-600 hover:text-blue-800 mr-2 text-xs">Edit</button>
                <button onclick="OBEModule.deleteCPL('${r.id}','${r.kode}')" class="text-red-500 hover:text-red-700 text-xs">Hapus</button>
              </td>
            </tr>`).join('')}</tbody>
          </table></div>`
    } catch(e) { $('cpl-table').innerHTML = `<p class="text-red-500 text-sm">${e.message}</p>` }
  }

  const openCPLForm = async (id) => {
    editingId = id || null
    let rec = {}
    if (id) { try { const r = await api(`/obe/cpl/${id}`); rec = r.data || {} } catch(e){} }
    showModal(`
      <div class="p-6">
        <h3 class="font-bold text-lg mb-4">${id ? 'Edit' : 'Tambah'} CPL</h3>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Kode CPL *</label>
              <input id="cf-kode" value="${rec.kode||''}" class="obe-input" placeholder="CPL-SI-1"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Ranah *</label>
              <select id="cf-ranah" class="obe-input">
                ${['sikap','pengetahuan','keterampilan_umum','keterampilan_khusus'].map(v =>
                  `<option value="${v}" ${rec.ranah===v?'selected':''}>${ranahLabel(v)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Prodi ID *</label>
              <select id="cf-prodi-id" class="obe-input">
                <option value="prodi-si" ${rec.prodi_id==='prodi-si'?'selected':''}>prodi-si</option>
                <option value="prodi-if" ${rec.prodi_id==='prodi-if'?'selected':''}>prodi-if</option>
                <option value="prodi-ak" ${rec.prodi_id==='prodi-ak'?'selected':''}>prodi-ak</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Nama Prodi *</label>
              <input id="cf-prodi-nama" value="${rec.prodi_nama||''}" class="obe-input" placeholder="Sistem Informasi"/>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Deskripsi CPL *</label>
            <textarea id="cf-deskripsi" rows="4" class="obe-input resize-none" placeholder="Mampu…">${rec.deskripsi||''}</textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button onclick="OBEModule.closeModal()" class="px-4 py-2 border border-slate-200 rounded-lg text-sm">Batal</button>
          <button onclick="OBEModule.submitCPL()" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Simpan</button>
        </div>
      </div>`)
  }

  const submitCPL = async () => {
    const body = {
      kode:       $('cf-kode').value.trim(),
      ranah:      $('cf-ranah').value,
      prodi_id:   $('cf-prodi-id').value,
      prodi_nama: $('cf-prodi-nama').value.trim(),
      deskripsi:  $('cf-deskripsi').value.trim(),
    }
    try {
      if (editingId) await API.put(`/obe/cpl/${editingId}`, body)
      else           await API.post('/obe/cpl', body)
      closeModal()
      UI.toast(`CPL berhasil ${editingId?'diperbarui':'ditambahkan'}`)
      loadStats(); filterCPL()
    } catch(e) { UI.toast(e.message, 'error') }
  }

  const deleteCPL = async (id, kode) => {
    if (!confirm(`Hapus CPL "${kode}"?`)) return
    try { await API.delete(`/obe/cpl/${id}`); UI.toast('CPL dihapus'); loadStats(); filterCPL() }
    catch(e) { UI.toast(e.message, 'error') }
  }

  // ── CPMK TAB ────────────────────────────────────────────────
  const renderCPMK = async () => {
    $('obe-body').innerHTML = `<div class="bg-white rounded-xl border border-slate-200 p-4">
      <div class="flex flex-wrap gap-3 mb-4">
        <input id="cpmk-search" type="text" placeholder="Cari kode / MK..." oninput="OBEModule.filterCPMK()"
          class="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-primary-500"/>
        <button onclick="OBEModule.openCPMKForm()" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">+ Tambah CPMK</button>
      </div>
      <div id="cpmk-table">Memuat...</div>
    </div>`
    filterCPMK()
  }

  const filterCPMK = async () => {
    const search = $('cpmk-search')?.value || ''
    const params = new URLSearchParams({per_page:100})
    if (search) params.set('search', search)
    try {
      const res  = await api(`/obe/cpmk?${params}`)
      const cpls = await api('/obe/cpl?per_page=100')
      const cplMap = Object.fromEntries((cpls.data||[]).map(c=>[c.id, c.kode]))
      const rows = res.data || []
      $('cpmk-table').innerHTML = rows.length === 0
        ? `<p class="text-center text-slate-400 py-8">Belum ada CPMK</p>`
        : `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="border-b border-slate-100 text-left text-slate-500 text-xs uppercase">
              <th class="pb-2 pr-3">Kode</th><th class="pb-2 pr-3">Mata Kuliah</th>
              <th class="pb-2 pr-3">CPL Dikover</th><th class="pb-2 pr-3">Bobot</th>
              <th class="pb-2 pr-3">Deskripsi</th><th class="pb-2">Aksi</th>
            </tr></thead>
            <tbody>${rows.map(r => `<tr class="border-b border-slate-50 table-row-hover">
              <td class="py-2 pr-3 font-semibold text-primary-700">${r.kode}</td>
              <td class="py-2 pr-3 text-slate-700">${r.mk_nama}</td>
              <td class="py-2 pr-3">${(r.cpl_ids||[]).map(cid=>`<span class="badge bg-purple-100 text-purple-700 mr-1">${cplMap[cid]||cid}</span>`).join('')}</td>
              <td class="py-2 pr-3"><span class="font-semibold text-slate-700">${r.bobot}%</span></td>
              <td class="py-2 pr-3 text-slate-500 max-w-xs text-xs">${r.deskripsi.length>70?r.deskripsi.slice(0,70)+'…':r.deskripsi}</td>
              <td class="py-2 whitespace-nowrap">
                <button onclick="OBEModule.openCPMKForm('${r.id}')" class="text-blue-600 hover:text-blue-800 mr-2 text-xs">Edit</button>
                <button onclick="OBEModule.deleteCPMK('${r.id}','${r.kode}')" class="text-red-500 hover:text-red-700 text-xs">Hapus</button>
              </td>
            </tr>`).join('')}</tbody>
          </table></div>`
    } catch(e) { $('cpmk-table').innerHTML = `<p class="text-red-500 text-sm">${e.message}</p>` }
  }

  const openCPMKForm = async (id) => {
    editingId = id || null
    let rec = {}
    if (id) { try { const r = await api(`/obe/cpmk/${id}`); rec = r.data || {} } catch(e){} }
    const cplRes = await api('/obe/cpl?per_page=100')
    const cpls   = cplRes.data || []
    const selectedCpls = rec.cpl_ids || []
    showModal(`
      <div class="p-6">
        <h3 class="font-bold text-lg mb-4">${id?'Edit':'Tambah'} CPMK</h3>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Kode CPMK *</label>
              <input id="ck-kode" value="${rec.kode||''}" class="obe-input" placeholder="CPMK-1"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Bobot (%) *</label>
              <input id="ck-bobot" type="number" min="0" max="100" value="${rec.bobot||0}" class="obe-input"/>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">ID Mata Kuliah *</label>
              <input id="ck-mk-id" value="${rec.mk_id||''}" class="obe-input" placeholder="mk-web"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Nama Mata Kuliah *</label>
              <input id="ck-mk-nama" value="${rec.mk_nama||''}" class="obe-input" placeholder="Pemrograman Web"/>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">CPL yang Dikover</label>
            <div class="border border-slate-200 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
              ${cpls.map(c=>`<label class="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" value="${c.id}" ${selectedCpls.includes(c.id)?'checked':''}
                  class="cpl-check mt-0.5 accent-primary-600"/>
                <span><span class="font-semibold text-purple-700">${c.kode}</span>
                  <span class="text-slate-500 text-xs ml-1">${c.prodi_nama}</span></span>
              </label>`).join('')}
              ${cpls.length===0?'<p class="text-slate-400 text-sm">Belum ada CPL — tambahkan di tab CPL dahulu</p>':''}
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Deskripsi CPMK *</label>
            <textarea id="ck-deskripsi" rows="4" class="obe-input resize-none" placeholder="Mahasiswa mampu…">${rec.deskripsi||''}</textarea>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button onclick="OBEModule.closeModal()" class="px-4 py-2 border border-slate-200 rounded-lg text-sm">Batal</button>
          <button onclick="OBEModule.submitCPMK()" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Simpan</button>
        </div>
      </div>`)
  }

  const submitCPMK = async () => {
    const cpl_ids = [...document.querySelectorAll('.cpl-check:checked')].map(c=>c.value)
    const body = {
      kode:      $('ck-kode').value.trim(),
      bobot:     parseInt($('ck-bobot').value)||0,
      mk_id:     $('ck-mk-id').value.trim(),
      mk_nama:   $('ck-mk-nama').value.trim(),
      deskripsi: $('ck-deskripsi').value.trim(),
      cpl_ids,
    }
    try {
      if (editingId) await API.put(`/obe/cpmk/${editingId}`, body)
      else           await API.post('/obe/cpmk', body)
      closeModal(); UI.toast(`CPMK berhasil ${editingId?'diperbarui':'ditambahkan'}`)
      loadStats(); filterCPMK()
    } catch(e) { UI.toast(e.message,'error') }
  }

  const deleteCPMK = async (id, kode) => {
    if (!confirm(`Hapus CPMK "${kode}"?`)) return
    try { await API.delete(`/obe/cpmk/${id}`); UI.toast('CPMK dihapus'); loadStats(); filterCPMK() }
    catch(e) { UI.toast(e.message,'error') }
  }

  // ── RPS TAB ─────────────────────────────────────────────────
  const renderRPS = async () => {
    $('obe-body').innerHTML = `<div class="bg-white rounded-xl border border-slate-200 p-4">
      <div class="flex flex-wrap gap-3 mb-4">
        <input id="rps-search" type="text" placeholder="Cari MK / dosen / semester..." oninput="OBEModule.filterRPS()"
          class="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-primary-500"/>
        <select id="rps-status" onchange="OBEModule.filterRPS()" class="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="diajukan">Diajukan</option>
          <option value="disetujui">Disetujui</option>
        </select>
        <button onclick="OBEModule.openRPSForm()" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">+ Buat RPS</button>
      </div>
      <div id="rps-table">Memuat...</div>
    </div>`
    filterRPS()
  }

  const filterRPS = async () => {
    const search = $('rps-search')?.value  || ''
    const status = $('rps-status')?.value  || ''
    const params = new URLSearchParams({per_page:50})
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    try {
      const res  = await api(`/obe/rps?${params}`)
      const rows = res.data || []
      $('rps-table').innerHTML = rows.length === 0
        ? `<p class="text-center text-slate-400 py-8">Belum ada RPS</p>`
        : `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="border-b border-slate-100 text-left text-slate-500 text-xs uppercase">
              <th class="pb-2 pr-3">Mata Kuliah</th><th class="pb-2 pr-3">SKS</th>
              <th class="pb-2 pr-3">Semester</th><th class="pb-2 pr-3">Dosen</th>
              <th class="pb-2 pr-3">Status</th><th class="pb-2">Aksi</th>
            </tr></thead>
            <tbody>${rows.map(r => {
              const terisi = (r.pertemuan||[]).filter(p=>p.topik).length
              return `<tr class="border-b border-slate-50 table-row-hover">
                <td class="py-2 pr-3">
                  <div class="font-medium text-slate-800">${r.mk_nama}</div>
                  <div class="text-xs text-slate-400">${r.mk_kode}</div>
                </td>
                <td class="py-2 pr-3 text-slate-600">${r.sks} SKS</td>
                <td class="py-2 pr-3 text-slate-600">${r.semester}</td>
                <td class="py-2 pr-3 text-slate-600">${r.dosen_nama}</td>
                <td class="py-2 pr-3">${statusBadge(r.status)}
                  <div class="text-xs text-slate-400 mt-0.5">${terisi}/16 pertemuan terisi</div>
                </td>
                <td class="py-2 whitespace-nowrap">
                  <button onclick="OBEModule.viewRPS('${r.id}')" class="text-indigo-600 hover:text-indigo-800 mr-2 text-xs">Lihat</button>
                  <button onclick="OBEModule.openRPSForm('${r.id}')" class="text-blue-600 hover:text-blue-800 mr-2 text-xs">Edit</button>
                  <button onclick="OBEModule.deleteRPS('${r.id}','${r.mk_nama}')" class="text-red-500 hover:text-red-700 text-xs">Hapus</button>
                </td>
              </tr>`}).join('')}</tbody>
          </table></div>`
    } catch(e) { $('rps-table').innerHTML = `<p class="text-red-500 text-sm">${e.message}</p>` }
  }

  const viewRPS = async (id) => {
    try {
      const res = await api(`/obe/rps/${id}`)
      const r   = res.data
      showModal(`
        <div class="p-6">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="font-bold text-lg">${r.mk_nama} <span class="text-slate-400 font-normal text-sm">(${r.mk_kode})</span></h3>
              <p class="text-slate-500 text-sm">${r.semester} — ${r.dosen_nama} — ${r.sks} SKS — ${statusBadge(r.status)}</p>
            </div>
            <button onclick="OBEModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-xl">✕</button>
          </div>
          ${r.tujuan_mk ? `<div class="bg-blue-50 rounded-lg p-3 mb-4 text-sm text-blue-800"><strong>Tujuan MK:</strong> ${r.tujuan_mk}</div>` : ''}
          <h4 class="font-semibold text-sm mb-2 text-slate-700">Rencana Pertemuan (16 Minggu)</h4>
          <div class="overflow-x-auto">
            <table class="w-full text-xs border-collapse">
              <thead><tr class="bg-slate-50">
                <th class="border border-slate-200 px-2 py-1 text-left">Mggu</th>
                <th class="border border-slate-200 px-2 py-1 text-left">Topik</th>
                <th class="border border-slate-200 px-2 py-1 text-left">Metode</th>
                <th class="border border-slate-200 px-2 py-1 text-left">Assessment</th>
              </tr></thead>
              <tbody>${(r.pertemuan||[]).map(p => `<tr class="${p.assessment?'bg-yellow-50':''}">
                <td class="border border-slate-200 px-2 py-1 font-semibold text-center">${p.minggu}</td>
                <td class="border border-slate-200 px-2 py-1">
                  <div class="font-medium">${p.topik||'—'}</div>
                  ${p.subtopik?`<div class="text-slate-400">${p.subtopik}</div>`:''}
                </td>
                <td class="border border-slate-200 px-2 py-1 text-slate-600">${p.metode||'—'}</td>
                <td class="border border-slate-200 px-2 py-1 text-slate-600">${p.assessment||'—'}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
          ${r.referensi?.length ? `<div class="mt-4"><p class="text-xs font-semibold text-slate-600 mb-1">Referensi:</p>
            <ul class="text-xs text-slate-500 list-disc list-inside">${r.referensi.map(ref=>`<li>${ref}</li>`).join('')}</ul></div>` : ''}
          <div class="flex justify-end mt-4">
            <button onclick="OBEModule.closeModal()" class="px-4 py-2 border border-slate-200 rounded-lg text-sm">Tutup</button>
          </div>
        </div>`, true)
    } catch(e) { UI.toast(e.message,'error') }
  }

  const openRPSForm = async (id) => {
    editingId = id || null
    let rec = {}
    if (id) { try { const r = await api(`/obe/rps/${id}`); rec = r.data || {} } catch(e){} }
    showModal(`
      <div class="p-6">
        <h3 class="font-bold text-lg mb-4">${id?'Edit':'Buat'} RPS</h3>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">ID Mata Kuliah *</label>
              <input id="rf-mk-id" value="${rec.mk_id||''}" class="obe-input" placeholder="mk-web"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Kode MK</label>
              <input id="rf-mk-kode" value="${rec.mk_kode||''}" class="obe-input" placeholder="SI301"/>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Nama Mata Kuliah *</label>
              <input id="rf-mk-nama" value="${rec.mk_nama||''}" class="obe-input" placeholder="Pemrograman Web"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">SKS</label>
              <input id="rf-sks" type="number" min="1" max="6" value="${rec.sks||3}" class="obe-input"/>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Semester *</label>
              <input id="rf-semester" value="${rec.semester||''}" class="obe-input" placeholder="Ganjil 2024/2025"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select id="rf-status" class="obe-input">
                ${['draft','diajukan','disetujui'].map(s=>`<option value="${s}" ${rec.status===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">ID Dosen *</label>
              <input id="rf-dosen-id" value="${rec.dosen_id||''}" class="obe-input" placeholder="dsn-001"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Nama Dosen *</label>
              <input id="rf-dosen-nama" value="${rec.dosen_nama||''}" class="obe-input" placeholder="Dr. Ahmad, M.Kom"/>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Tujuan Mata Kuliah</label>
            <textarea id="rf-tujuan" rows="2" class="obe-input resize-none" placeholder="Mahasiswa mampu…">${rec.tujuan_mk||''}</textarea>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Deskripsi Singkat MK</label>
            <textarea id="rf-deskripsi" rows="2" class="obe-input resize-none">${rec.deskripsi_mk||''}</textarea>
          </div>
        </div>
        <p class="text-xs text-slate-400 mt-3">* Template 16 pertemuan akan dibuat otomatis. Edit topik pertemuan setelah RPS tersimpan.</p>
        <div class="flex justify-end gap-3 mt-4">
          <button onclick="OBEModule.closeModal()" class="px-4 py-2 border border-slate-200 rounded-lg text-sm">Batal</button>
          <button onclick="OBEModule.submitRPS()" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Simpan</button>
        </div>
      </div>`)
  }

  const submitRPS = async () => {
    const body = {
      mk_id:      $('rf-mk-id').value.trim(),
      mk_kode:    $('rf-mk-kode').value.trim(),
      mk_nama:    $('rf-mk-nama').value.trim(),
      sks:        parseInt($('rf-sks').value)||3,
      semester:   $('rf-semester').value.trim(),
      status:     $('rf-status').value,
      dosen_id:   $('rf-dosen-id').value.trim(),
      dosen_nama: $('rf-dosen-nama').value.trim(),
      tujuan_mk:  $('rf-tujuan').value.trim(),
      deskripsi_mk: $('rf-deskripsi').value.trim(),
    }
    try {
      if (editingId) await API.put(`/obe/rps/${editingId}`, body)
      else           await API.post('/obe/rps', body)
      closeModal(); UI.toast(`RPS berhasil ${editingId?'diperbarui':'dibuat'}`)
      loadStats(); filterRPS()
    } catch(e) { UI.toast(e.message,'error') }
  }

  const deleteRPS = async (id, nama) => {
    if (!confirm(`Hapus RPS "${nama}"?`)) return
    try { await API.delete(`/obe/rps/${id}`); UI.toast('RPS dihapus'); loadStats(); filterRPS() }
    catch(e) { UI.toast(e.message,'error') }
  }

  // ── PENILAIAN OBE TAB ────────────────────────────────────────
  const renderPenilaian = async () => {
    $('obe-body').innerHTML = `<div class="bg-white rounded-xl border border-slate-200 p-4">
      <div class="flex flex-wrap gap-3 mb-4">
        <input id="pen-search" type="text" placeholder="Cari mahasiswa / NIM / MK..." oninput="OBEModule.filterPenilaian()"
          class="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-primary-500"/>
        <button onclick="OBEModule.openPenilaianForm()" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">+ Input Penilaian</button>
      </div>
      <div id="pen-table">Memuat...</div>
    </div>`
    filterPenilaian()
  }

  const filterPenilaian = async () => {
    const search = $('pen-search')?.value || ''
    const params = new URLSearchParams({per_page:50})
    if (search) params.set('search', search)
    try {
      const res  = await api(`/obe/penilaian?${params}`)
      const rows = res.data || []
      $('pen-table').innerHTML = rows.length === 0
        ? `<p class="text-center text-slate-400 py-8">Belum ada data penilaian</p>`
        : `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="border-b border-slate-100 text-left text-slate-500 text-xs uppercase">
              <th class="pb-2 pr-3">Mahasiswa</th><th class="pb-2 pr-3">NIM</th>
              <th class="pb-2 pr-3">Mata Kuliah</th><th class="pb-2 pr-3">Semester</th>
              <th class="pb-2 pr-3">Nilai CPMK</th><th class="pb-2 pr-3">Nilai Akhir</th>
              <th class="pb-2">Aksi</th>
            </tr></thead>
            <tbody>${rows.map(r => {
              const na = r.nilai_akhir || 0
              const naColor = na>=80?'text-green-600':na>=60?'text-blue-600':'text-red-500'
              return `<tr class="border-b border-slate-50 table-row-hover">
                <td class="py-2 pr-3 font-medium text-slate-800">${r.mahasiswa_nama}</td>
                <td class="py-2 pr-3 text-slate-500">${r.mahasiswa_nim}</td>
                <td class="py-2 pr-3 text-slate-700">${r.mk_nama}</td>
                <td class="py-2 pr-3 text-slate-500 text-xs">${r.semester}</td>
                <td class="py-2 pr-3">
                  ${(r.cpmk_scores||[]).map(cs=>`
                    <span class="inline-flex items-center gap-1 text-xs mr-1">
                      <span class="text-slate-500">${cs.kode}:</span>
                      <span class="font-semibold ${cs.tercapai?'text-green-600':'text-red-500'}">${cs.nilai}</span>
                    </span>`).join('')}
                </td>
                <td class="py-2 pr-3 font-bold text-lg ${naColor}">${na}</td>
                <td class="py-2 whitespace-nowrap">
                  <button onclick="OBEModule.openPenilaianForm('${r.id}')" class="text-blue-600 hover:text-blue-800 mr-2 text-xs">Edit</button>
                  <button onclick="OBEModule.deletePenilaian('${r.id}','${r.mahasiswa_nama}')" class="text-red-500 hover:text-red-700 text-xs">Hapus</button>
                </td>
              </tr>`}).join('')}</tbody>
          </table></div>`
    } catch(e) { $('pen-table').innerHTML = `<p class="text-red-500 text-sm">${e.message}</p>` }
  }

  const openPenilaianForm = async (id) => {
    editingId = id || null
    let rec = {}
    if (id) { try { const r = await api(`/obe/penilaian/${id}`); rec = r.data || {} } catch(e){} }
    const cpmkRes  = await api('/obe/cpmk?per_page=100')
    const allCPMKs = cpmkRes.data || []

    const mkGroups = {}
    allCPMKs.forEach(c => { if (!mkGroups[c.mk_id]) mkGroups[c.mk_id] = {nama:c.mk_nama, cpmks:[]}; mkGroups[c.mk_id].cpmks.push(c) })

    const existingScores = Object.fromEntries((rec.cpmk_scores||[]).map(cs=>[cs.cpmk_id,cs.nilai]))

    showModal(`
      <div class="p-6">
        <h3 class="font-bold text-lg mb-4">${id?'Edit':'Input'} Penilaian OBE</h3>
        <div class="space-y-4">
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">ID Mahasiswa *</label>
              <input id="pf-mhs-id" value="${rec.mahasiswa_id||''}" class="obe-input" placeholder="mhs-001"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Nama Mahasiswa *</label>
              <input id="pf-mhs-nama" value="${rec.mahasiswa_nama||''}" class="obe-input" placeholder="Budi Santoso"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">NIM *</label>
              <input id="pf-mhs-nim" value="${rec.mahasiswa_nim||''}" class="obe-input" placeholder="2021001001"/>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Mata Kuliah *</label>
              <select id="pf-mk" onchange="OBEModule.onMKChange()" class="obe-input">
                <option value="">-- Pilih MK --</option>
                ${Object.entries(mkGroups).map(([mkId,mk])=>`
                  <option value="${mkId}" data-nama="${mk.nama}" ${rec.mk_id===mkId?'selected':''}>${mk.nama}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Semester *</label>
              <input id="pf-semester" value="${rec.semester||''}" class="obe-input" placeholder="Ganjil 2024/2025"/>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-2">Nilai per CPMK * <span class="text-slate-400">(threshold tercapai: ≥ 60)</span></label>
            <div id="pf-cpmk-scores" class="space-y-2 border border-slate-200 rounded-lg p-3 min-h-12">
              ${Object.keys(mkGroups).length===0
                ? '<p class="text-slate-400 text-sm">Belum ada CPMK — tambahkan di tab CPMK</p>'
                : '<p class="text-slate-400 text-sm text-center py-4">Pilih Mata Kuliah untuk melihat CPMK</p>'}
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button onclick="OBEModule.closeModal()" class="px-4 py-2 border border-slate-200 rounded-lg text-sm">Batal</button>
          <button onclick="OBEModule.submitPenilaian()" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Simpan</button>
        </div>
      </div>`)

    // Store CPMK data for onMKChange
    window._obeCPMKGroups    = mkGroups
    window._obeExistingScores = existingScores
    if (rec.mk_id) setTimeout(onMKChange, 50)
  }

  const onMKChange = () => {
    const mkId   = $('pf-mk')?.value
    const groups = window._obeCPMKGroups || {}
    const existing = window._obeExistingScores || {}
    const container = $('pf-cpmk-scores')
    if (!mkId || !groups[mkId]) {
      container.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">Pilih Mata Kuliah untuk melihat CPMK</p>'
      return
    }
    const cpmks = groups[mkId].cpmks
    container.innerHTML = cpmks.map(c => `
      <div class="flex items-center gap-3">
        <div class="flex-1">
          <div class="text-sm font-medium text-slate-700">${c.kode} <span class="text-slate-400 font-normal text-xs">bobot ${c.bobot}%</span></div>
          <div class="text-xs text-slate-400">${c.deskripsi.length>60?c.deskripsi.slice(0,60)+'…':c.deskripsi}</div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <input type="number" min="0" max="100" value="${existing[c.id]||''}"
            data-cpmk-id="${c.id}" data-cpmk-kode="${c.kode}"
            placeholder="0-100"
            class="cpmk-score-input border border-slate-200 rounded-lg px-2 py-1.5 text-sm w-20 text-center focus:outline-none focus:ring-2 focus:ring-primary-500"/>
          <span id="score-ind-${c.id}" class="text-xs w-16 text-center font-medium">
            ${existing[c.id]!==undefined ? (existing[c.id]>=60?'<span class="text-green-600">✓ Tercapai</span>':'<span class="text-red-500">✗ Belum</span>') : ''}
          </span>
        </div>
      </div>`).join('')

    // Live indicator update
    container.querySelectorAll('.cpmk-score-input').forEach(input => {
      input.addEventListener('input', () => {
        const val = parseInt(input.value)
        const ind = document.getElementById(`score-ind-${input.dataset.cpmkId}`)
        if (!isNaN(val)) ind.innerHTML = val>=60?'<span class="text-green-600">✓ Tercapai</span>':'<span class="text-red-500">✗ Belum</span>'
        else ind.innerHTML = ''
      })
    })
  }

  const submitPenilaian = async () => {
    const mkEl   = $('pf-mk')
    const mk_id  = mkEl?.value
    const mk_nama = mkEl?.options[mkEl.selectedIndex]?.dataset.nama || ''
    const cpmk_scores = [...document.querySelectorAll('.cpmk-score-input')].map(inp => ({
      cpmk_id: inp.dataset.cpmkId,
      kode:    inp.dataset.cpmkKode,
      nilai:   parseInt(inp.value)||0,
    }))
    if (cpmk_scores.length === 0) return UI.toast('Pilih mata kuliah dan isi nilai CPMK','error')
    const body = {
      mahasiswa_id:   $('pf-mhs-id').value.trim(),
      mahasiswa_nama: $('pf-mhs-nama').value.trim(),
      mahasiswa_nim:  $('pf-mhs-nim').value.trim(),
      mk_id, mk_nama,
      semester:       $('pf-semester').value.trim(),
      cpmk_scores,
    }
    try {
      if (editingId) await API.put(`/obe/penilaian/${editingId}`, body)
      else           await API.post('/obe/penilaian', body)
      closeModal(); UI.toast(`Penilaian berhasil ${editingId?'diperbarui':'disimpan'}`)
      loadStats(); filterPenilaian()
    } catch(e) { UI.toast(e.message,'error') }
  }

  const deletePenilaian = async (id, nama) => {
    if (!confirm(`Hapus penilaian OBE "${nama}"?`)) return
    try { await API.delete(`/obe/penilaian/${id}`); UI.toast('Data dihapus'); loadStats(); filterPenilaian() }
    catch(e) { UI.toast(e.message,'error') }
  }

  // ── LAPORAN TAB ─────────────────────────────────────────────
  const renderLaporan = async () => {
    $('obe-body').innerHTML = `<div class="space-y-5">
      <!-- CPL -->
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-slate-800">Ketercapaian CPL per Prodi</h3>
          <select id="lap-prodi" onchange="OBEModule.loadLaporanCPL()" class="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
            <option value="">Semua Prodi</option>
            <option value="prodi-si">Sistem Informasi</option>
            <option value="prodi-if">Informatika</option>
            <option value="prodi-ak">Akuntansi</option>
          </select>
        </div>
        <div id="lap-cpl-body">Memuat...</div>
      </div>
      <!-- CPMK -->
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-slate-800">Ketercapaian CPMK per Mata Kuliah</h3>
          <select id="lap-mk" onchange="OBEModule.loadLaporanCPMK()" class="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
            <option value="">Semua MK</option>
            <option value="mk-web">Pemrograman Web</option>
            <option value="mk-db">Basis Data</option>
            <option value="mk-algo">Algoritma & Struktur Data</option>
          </select>
        </div>
        <div id="lap-cpmk-body">Memuat...</div>
      </div>
    </div>`
    loadLaporanCPL()
    loadLaporanCPMK()
  }

  const loadLaporanCPL = async () => {
    const prodi  = $('lap-prodi')?.value || ''
    const params = prodi ? `?prodi_id=${prodi}` : ''
    try {
      const res  = await api(`/obe/laporan/cpl${params}`)
      const rows = res.data || []
      $('lap-cpl-body').innerHTML = rows.length === 0
        ? `<p class="text-center text-slate-400 py-6">Belum ada data penilaian untuk menghitung ketercapaian CPL</p>`
        : `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="border-b border-slate-100 text-left text-slate-500 text-xs uppercase">
              <th class="pb-2 pr-3">Kode</th><th class="pb-2 pr-3">Prodi</th>
              <th class="pb-2 pr-3">Ranah</th><th class="pb-2 pr-3">Rata-rata</th>
              <th class="pb-2 pr-3">Tercapai</th><th class="pb-2 w-40">% Ketercapaian</th>
            </tr></thead>
            <tbody>${rows.map(r => `<tr class="border-b border-slate-50">
              <td class="py-2 pr-3 font-semibold text-purple-700">${r.kode}</td>
              <td class="py-2 pr-3 text-slate-600">${r.prodi}</td>
              <td class="py-2 pr-3">${ranahBadge(r.ranah)}</td>
              <td class="py-2 pr-3 font-semibold text-slate-800">${r.rata_rata}</td>
              <td class="py-2 pr-3 text-slate-500">${r.tercapai}/${r.total_data} mhs</td>
              <td class="py-2">${bar(r.pct_tercapai)}</td>
            </tr>`).join('')}</tbody>
          </table></div>`
    } catch(e) { $('lap-cpl-body').innerHTML = `<p class="text-red-500 text-sm">${e.message}</p>` }
  }

  const loadLaporanCPMK = async () => {
    const mk     = $('lap-mk')?.value || ''
    const params = mk ? `?mk_id=${mk}` : ''
    try {
      const res  = await api(`/obe/laporan/cpmk${params}`)
      const rows = res.data || []
      $('lap-cpmk-body').innerHTML = rows.length === 0
        ? `<p class="text-center text-slate-400 py-6">Belum ada data penilaian untuk menghitung ketercapaian CPMK</p>`
        : `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="border-b border-slate-100 text-left text-slate-500 text-xs uppercase">
              <th class="pb-2 pr-3">Kode</th><th class="pb-2 pr-3">Mata Kuliah</th>
              <th class="pb-2 pr-3">Bobot</th><th class="pb-2 pr-3">Rata-rata</th>
              <th class="pb-2 pr-3">Tercapai</th><th class="pb-2 w-40">% Ketercapaian</th>
            </tr></thead>
            <tbody>${rows.map(r => `<tr class="border-b border-slate-50">
              <td class="py-2 pr-3 font-semibold text-blue-700">${r.kode}</td>
              <td class="py-2 pr-3 text-slate-700">${r.mk_nama}</td>
              <td class="py-2 pr-3 text-slate-500">${r.bobot}%</td>
              <td class="py-2 pr-3 font-semibold text-slate-800">${r.rata_rata}</td>
              <td class="py-2 pr-3 text-slate-500">${r.tercapai}/${r.total_data} mhs</td>
              <td class="py-2">${bar(r.pct_tercapai)}</td>
            </tr>`).join('')}</tbody>
          </table></div>`
    } catch(e) { $('lap-cpmk-body').innerHTML = `<p class="text-red-500 text-sm">${e.message}</p>` }
  }

  // ── Modal helpers ────────────────────────────────────────────
  const showModal = (html, wide) => {
    $('obe-modal-box').className = `bg-white rounded-xl shadow-2xl w-full max-h-[90vh] overflow-y-auto ${wide?'max-w-4xl':'max-w-2xl'}`
    $('obe-modal-box').innerHTML = html
    $('obe-modal').classList.remove('hidden')
    // Add input styles inline
    document.querySelectorAll('.obe-input').forEach(el => {
      el.className += ' w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
    })
  }

  const closeModal = () => {
    $('obe-modal').classList.add('hidden')
    editingId = null
    window._obeCPMKGroups = null
    window._obeExistingScores = null
  }

  return {
    render, switchTab,
    filterCPL, openCPLForm, submitCPL, deleteCPL,
    filterCPMK, openCPMKForm, submitCPMK, deleteCPMK,
    filterRPS, openRPSForm, submitRPS, deleteRPS, viewRPS,
    filterPenilaian, openPenilaianForm, submitPenilaian, deletePenilaian, onMKChange,
    loadLaporanCPL, loadLaporanCPMK,
    closeModal,
  }
})()
