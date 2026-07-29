// Modul Penelitian — Dosen & LPPM
const PenelitianModule = (() => {

  let _tab = 'penelitian'
  let _filterStatus = ''
  let _filterSkema = ''
  let _filterTahun = ''
  let _filterJenis = ''
  let _filterValidasi = ''
  let _filterPenelitianId = ''
  let _search = ''
  let _page = 1
  let _pageL = 1

  // ── Badge helpers ────────────────────────────────────────────────────────
  const statusBadge = (s) => {
    const map = {
      draft:    'bg-gray-100 text-gray-600',
      diajukan: 'bg-yellow-100 text-yellow-700',
      aktif:    'bg-blue-100 text-blue-700',
      selesai:  'bg-green-100 text-green-700',
      ditolak:  'bg-red-100 text-red-700',
    }
    const label = { draft:'Draft', diajukan:'Diajukan', aktif:'Aktif', selesai:'Selesai', ditolak:'Ditolak' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${label[s]||s}</span>`
  }

  const validasiBadge = (s) => {
    const map = {
      menunggu_validasi: 'bg-yellow-100 text-yellow-700',
      tervalidasi:       'bg-green-100 text-green-700',
      ditolak:           'bg-red-100 text-red-700',
    }
    const label = { menunggu_validasi:'Menunggu', tervalidasi:'Tervalidasi', ditolak:'Ditolak' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${label[s]||s}</span>`
  }

  const skemaBadge = (s) => {
    const map = {
      mandiri: 'bg-purple-100 text-purple-700',
      dikti:   'bg-blue-100 text-blue-700',
      internal:'bg-indigo-100 text-indigo-700',
      hibah:   'bg-orange-100 text-orange-700',
    }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${s||'-'}</span>`
  }

  const progressBar = (pct) => {
    const p = Math.min(100, Math.max(0, pct || 0))
    const color = p === 100 ? 'bg-green-500' : p >= 50 ? 'bg-blue-500' : 'bg-yellow-400'
    return `<div class="flex items-center gap-2">
      <div class="flex-1 bg-gray-200 rounded-full h-1.5">
        <div class="${color} h-1.5 rounded-full" style="width:${p}%"></div>
      </div>
      <span class="text-xs text-gray-600 w-8 text-right">${p}%</span>
    </div>`
  }

  const fmt = (n) => n ? new Intl.NumberFormat('id-ID').format(n) : '-'
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '-'

  // ── Stats ────────────────────────────────────────────────────────────────
  const loadStats = async () => {
    try {
      const res = await API.get('/penelitian/stats')
      const d = res.data || {}
      document.getElementById('stat-total').textContent    = d.total_penelitian ?? 0
      document.getElementById('stat-aktif').textContent    = d.aktif ?? 0
      document.getElementById('stat-selesai').textContent  = d.selesai ?? 0
      document.getElementById('stat-luaran').textContent   = d.total_luaran ?? 0
      document.getElementById('stat-valid').textContent    = d.luaran_tervalidasi ?? 0
      document.getElementById('stat-dana').textContent     = 'Rp ' + fmt(d.total_dana)
    } catch (_) {}
  }

  // ── Penelitian list ──────────────────────────────────────────────────────
  const loadPenelitian = async () => {
    const tbody = document.getElementById('penelitian-tbody')
    if (!tbody) return
    tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>'
    try {
      const params = new URLSearchParams({ page: _page, per_page: 15, search: _search })
      if (_filterStatus) params.append('status', _filterStatus)
      if (_filterSkema)  params.append('skema', _filterSkema)
      if (_filterTahun)  params.append('tahun', _filterTahun)
      const res = await API.get('/penelitian?' + params)
      const items = res.data || []
      const meta  = res.meta || {}
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">Tidak ada data penelitian</td></tr>'
        document.getElementById('penelitian-info').textContent = ''
        document.getElementById('penelitian-pager').innerHTML  = ''
        return
      }
      tbody.innerHTML = items.map(p => `
        <tr class="table-row-hover">
          <td class="px-4 py-3">
            <div class="font-medium text-gray-800 text-sm">${p.judul}</div>
            <div class="text-xs text-gray-500 mt-0.5">${p.ketua_nama || '-'}</div>
          </td>
          <td class="px-4 py-3 text-sm">${skemaBadge(p.skema)}</td>
          <td class="px-4 py-3 text-sm text-gray-600">${p.tahun || '-'}</td>
          <td class="px-4 py-3 text-sm text-gray-600">Rp ${fmt(p.dana_disetujui || p.dana_diajukan)}</td>
          <td class="px-4 py-3">${progressBar(p.laporan_kemajuan_persen)}</td>
          <td class="px-4 py-3 text-sm">${p.jumlah_luaran ?? 0} luaran</td>
          <td class="px-4 py-3">${statusBadge(p.status)}</td>
          <td class="px-4 py-3 text-right">
            ${actionButtons(p)}
          </td>
        </tr>
      `).join('')
      document.getElementById('penelitian-info').textContent =
        `Menampilkan ${items.length} dari ${meta.total || items.length} data`
      renderPager('penelitian-pager', meta, (pg) => { _page = pg; loadPenelitian() })
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-red-400">${e.message}</td></tr>`
    }
  }

  const actionButtons = (p) => {
    const btns = []
    btns.push(`<button onclick="PenelitianModule.detail('${p.id}')" class="text-xs text-blue-600 hover:underline mr-1">Detail</button>`)
    if (p.status === 'draft') {
      btns.push(`<button onclick="PenelitianModule.edit('${p.id}')" class="text-xs text-indigo-600 hover:underline mr-1">Edit</button>`)
      btns.push(`<button onclick="PenelitianModule.ajukan('${p.id}')" class="text-xs text-green-600 hover:underline mr-1">Ajukan</button>`)
      btns.push(`<button onclick="PenelitianModule.hapus('${p.id}')" class="text-xs text-red-500 hover:underline mr-1">Hapus</button>`)
    }
    if (p.status === 'diajukan') {
      btns.push(`<button onclick="PenelitianModule.setujui('${p.id}')" class="text-xs text-green-600 hover:underline mr-1">Setujui</button>`)
      btns.push(`<button onclick="PenelitianModule.tolak('${p.id}')" class="text-xs text-red-500 hover:underline mr-1">Tolak</button>`)
    }
    if (p.status === 'aktif') {
      btns.push(`<button onclick="PenelitianModule.updateLaporan('${p.id}', ${p.laporan_kemajuan_persen||0})" class="text-xs text-yellow-600 hover:underline mr-1">Laporan</button>`)
      btns.push(`<button onclick="PenelitianModule.selesaikan('${p.id}')" class="text-xs text-green-700 hover:underline mr-1">Selesaikan</button>`)
      btns.push(`<button onclick="PenelitianModule.lihatLuaran('${p.id}')" class="text-xs text-purple-600 hover:underline mr-1">Luaran</button>`)
    }
    if (p.status === 'selesai') {
      btns.push(`<button onclick="PenelitianModule.lihatLuaran('${p.id}')" class="text-xs text-purple-600 hover:underline mr-1">Luaran</button>`)
    }
    return btns.join('')
  }

  // ── Luaran list ──────────────────────────────────────────────────────────
  const loadLuaran = async () => {
    const tbody = document.getElementById('luaran-tbody')
    if (!tbody) return
    tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>'
    try {
      const params = new URLSearchParams({ page: _pageL, per_page: 15, search: _search })
      if (_filterValidasi)     params.append('status_validasi', _filterValidasi)
      if (_filterJenis)        params.append('jenis', _filterJenis)
      if (_filterPenelitianId) params.append('penelitian_id', _filterPenelitianId)
      const res = await API.get('/penelitian/luaran/list?' + params)
      const items = res.data || []
      const meta  = res.meta || {}
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">Tidak ada data luaran</td></tr>'
        document.getElementById('luaran-info').textContent = ''
        document.getElementById('luaran-pager').innerHTML  = ''
        return
      }
      tbody.innerHTML = items.map(l => `
        <tr class="table-row-hover">
          <td class="px-4 py-3">
            <div class="font-medium text-gray-800 text-sm">${l.judul}</div>
            <div class="text-xs text-gray-500 mt-0.5">${l.penelitian_judul || '-'}</div>
          </td>
          <td class="px-4 py-3 text-sm text-gray-600">${l.jenis || '-'}</td>
          <td class="px-4 py-3 text-sm text-gray-600">${l.penerbit || '-'}</td>
          <td class="px-4 py-3 text-sm text-gray-600">${l.tahun_terbit || '-'}</td>
          <td class="px-4 py-3 text-sm text-gray-600">${l.ketua_nama || '-'}</td>
          <td class="px-4 py-3">${validasiBadge(l.status_validasi)}</td>
          <td class="px-4 py-3 text-right">
            ${luaranActionButtons(l)}
          </td>
        </tr>
      `).join('')
      document.getElementById('luaran-info').textContent =
        `Menampilkan ${items.length} dari ${meta.total || items.length} data`
      renderPager('luaran-pager', meta, (pg) => { _pageL = pg; loadLuaran() })
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-red-400">${e.message}</td></tr>`
    }
  }

  const luaranActionButtons = (l) => {
    const btns = []
    if (l.status_validasi !== 'tervalidasi') {
      btns.push(`<button onclick="PenelitianModule.editLuaran('${l.id}')" class="text-xs text-indigo-600 hover:underline mr-1">Edit</button>`)
      btns.push(`<button onclick="PenelitianModule.validasiLuaran('${l.id}', 'tervalidasi')" class="text-xs text-green-600 hover:underline mr-1">Validasi</button>`)
      btns.push(`<button onclick="PenelitianModule.validasiLuaran('${l.id}', 'ditolak')" class="text-xs text-orange-500 hover:underline mr-1">Tolak</button>`)
      btns.push(`<button onclick="PenelitianModule.hapusLuaran('${l.id}')" class="text-xs text-red-500 hover:underline mr-1">Hapus</button>`)
    }
    return btns.join('') || '<span class="text-xs text-gray-400">Tervalidasi</span>'
  }

  // ── Pager ────────────────────────────────────────────────────────────────
  const renderPager = (elId, meta, cb) => {
    const el = document.getElementById(elId)
    if (!el || !meta || meta.total_pages <= 1) { if (el) el.innerHTML = ''; return }
    const cur = meta.page
    const tot = meta.total_pages
    let html = '<div class="flex gap-1">'
    if (cur > 1) html += `<button onclick="(${cb})(${cur-1})" class="px-2 py-1 text-xs border rounded hover:bg-gray-50">‹</button>`
    for (let i = Math.max(1,cur-2); i <= Math.min(tot,cur+2); i++) {
      html += `<button onclick="(${cb})(${i})" class="px-2 py-1 text-xs border rounded ${i===cur?'bg-primary-600 text-white border-primary-600':'hover:bg-gray-50'}">${i}</button>`
    }
    if (cur < tot) html += `<button onclick="(${cb})(${cur+1})" class="px-2 py-1 text-xs border rounded hover:bg-gray-50">›</button>`
    html += '</div>'
    el.innerHTML = html
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const render = () => {
    const el = document.getElementById('page-content')
    Router.setPageMeta('Penelitian', 'Manajemen penelitian dosen & luaran')
    if (!el) return
    el.innerHTML = `
      <div class="p-6 space-y-6">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold text-gray-800">Penelitian</h1>
            <p class="text-sm text-gray-500">Manajemen penelitian dosen & luaran</p>
          </div>
          <button onclick="PenelitianModule.openForm()" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
            + Penelitian Baru
          </button>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          ${[
            ['stat-total',   'Total Penelitian', 'text-blue-600'],
            ['stat-aktif',   'Aktif',            'text-indigo-600'],
            ['stat-selesai', 'Selesai',          'text-green-600'],
            ['stat-luaran',  'Total Luaran',     'text-purple-600'],
            ['stat-valid',   'Tervalidasi',      'text-teal-600'],
            ['stat-dana',    'Total Dana',       'text-orange-600'],
          ].map(([id, label, cls]) => `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p class="text-xs text-gray-500">${label}</p>
              <p id="${id}" class="text-xl font-bold ${cls} mt-1">-</p>
            </div>
          `).join('')}
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-gray-200 gap-4">
          <button id="tab-penelitian" onclick="PenelitianModule.switchTab('penelitian')"
            class="pb-2 text-sm font-medium border-b-2 ${_tab==='penelitian'?'border-primary-600 text-primary-600':'border-transparent text-gray-500 hover:text-gray-700'}">
            Daftar Penelitian
          </button>
          <button id="tab-luaran" onclick="PenelitianModule.switchTab('luaran')"
            class="pb-2 text-sm font-medium border-b-2 ${_tab==='luaran'?'border-primary-600 text-primary-600':'border-transparent text-gray-500 hover:text-gray-700'}">
            Luaran Penelitian
          </button>
        </div>

        <!-- Tab Penelitian -->
        <div id="panel-penelitian" class="${_tab!=='penelitian'?'hidden':''}">
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="p-4 flex flex-wrap gap-2 border-b border-gray-100">
              <input id="search-penelitian" type="text" placeholder="Cari judul / ketua / skema…"
                value="${_search}"
                oninput="PenelitianModule.onSearch(this.value)"
                class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
              <select onchange="PenelitianModule.onFilter('status',this.value)" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                <option value="">Semua Status</option>
                <option value="draft" ${_filterStatus==='draft'?'selected':''}>Draft</option>
                <option value="diajukan" ${_filterStatus==='diajukan'?'selected':''}>Diajukan</option>
                <option value="aktif" ${_filterStatus==='aktif'?'selected':''}>Aktif</option>
                <option value="selesai" ${_filterStatus==='selesai'?'selected':''}>Selesai</option>
                <option value="ditolak" ${_filterStatus==='ditolak'?'selected':''}>Ditolak</option>
              </select>
              <select onchange="PenelitianModule.onFilter('skema',this.value)" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                <option value="">Semua Skema</option>
                <option value="mandiri" ${_filterSkema==='mandiri'?'selected':''}>Mandiri</option>
                <option value="internal" ${_filterSkema==='internal'?'selected':''}>Internal</option>
                <option value="dikti" ${_filterSkema==='dikti'?'selected':''}>Dikti</option>
                <option value="hibah" ${_filterSkema==='hibah'?'selected':''}>Hibah</option>
              </select>
              <select onchange="PenelitianModule.onFilter('tahun',this.value)" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                <option value="">Semua Tahun</option>
                ${[2025,2024,2023,2022].map(y=>`<option value="${y}" ${_filterTahun==y?'selected':''}>${y}</option>`).join('')}
              </select>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th class="px-4 py-3">Judul / Ketua</th>
                    <th class="px-4 py-3">Skema</th>
                    <th class="px-4 py-3">Tahun</th>
                    <th class="px-4 py-3">Dana</th>
                    <th class="px-4 py-3">Laporan</th>
                    <th class="px-4 py-3">Luaran</th>
                    <th class="px-4 py-3">Status</th>
                    <th class="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody id="penelitian-tbody" class="divide-y divide-gray-50"></tbody>
              </table>
            </div>
            <div class="px-4 py-3 flex items-center justify-between text-xs text-gray-500 border-t border-gray-100">
              <span id="penelitian-info"></span>
              <div id="penelitian-pager"></div>
            </div>
          </div>
        </div>

        <!-- Tab Luaran -->
        <div id="panel-luaran" class="${_tab!=='luaran'?'hidden':''}">
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="p-4 flex flex-wrap gap-2 border-b border-gray-100">
              <input type="text" placeholder="Cari judul luaran…"
                value="${_search}"
                oninput="PenelitianModule.onSearch(this.value)"
                class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
              <select onchange="PenelitianModule.onFilterL('jenis',this.value)" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                <option value="">Semua Jenis</option>
                <option value="jurnal">Jurnal</option>
                <option value="prosiding">Prosiding</option>
                <option value="buku">Buku</option>
                <option value="paten">Paten</option>
                <option value="hki">HKI</option>
              </select>
              <select onchange="PenelitianModule.onFilterL('validasi',this.value)" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                <option value="">Semua Validasi</option>
                <option value="menunggu_validasi" ${_filterValidasi==='menunggu_validasi'?'selected':''}>Menunggu</option>
                <option value="tervalidasi" ${_filterValidasi==='tervalidasi'?'selected':''}>Tervalidasi</option>
                <option value="ditolak" ${_filterValidasi==='ditolak'?'selected':''}>Ditolak</option>
              </select>
              ${_filterPenelitianId ? `<button onclick="PenelitianModule.clearFilter()" class="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50">× Hapus Filter</button>` : ''}
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th class="px-4 py-3">Judul / Penelitian</th>
                    <th class="px-4 py-3">Jenis</th>
                    <th class="px-4 py-3">Penerbit</th>
                    <th class="px-4 py-3">Tahun</th>
                    <th class="px-4 py-3">Ketua</th>
                    <th class="px-4 py-3">Validasi</th>
                    <th class="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody id="luaran-tbody" class="divide-y divide-gray-50"></tbody>
              </table>
            </div>
            <div class="px-4 py-3 flex items-center justify-between text-xs text-gray-500 border-t border-gray-100">
              <span id="luaran-info"></span>
              <div id="luaran-pager"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal -->
      <div id="penelitian-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40" onclick="PenelitianModule.closeModal()"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div class="p-6">
            <h2 id="modal-title" class="text-lg font-semibold text-gray-800 mb-4">Penelitian</h2>
            <div id="modal-body"></div>
          </div>
        </div>
      </div>
    `
    loadStats()
    if (_tab === 'penelitian') loadPenelitian()
    else loadLuaran()
  }

  // ── Tab switch ───────────────────────────────────────────────────────────
  const switchTab = (tab) => {
    _tab = tab
    _search = ''
    _page = 1
    _pageL = 1
    ;['penelitian','luaran'].forEach(t => {
      const btn   = document.getElementById('tab-' + t)
      const panel = document.getElementById('panel-' + t)
      if (btn) {
        btn.className = `pb-2 text-sm font-medium border-b-2 ${t===tab?'border-primary-600 text-primary-600':'border-transparent text-gray-500 hover:text-gray-700'}`
      }
      if (panel) panel.classList.toggle('hidden', t !== tab)
    })
    if (tab === 'penelitian') loadPenelitian()
    else loadLuaran()
  }

  // ── Filter handlers ──────────────────────────────────────────────────────
  const onSearch = (v) => {
    _search = v; _page = 1; _pageL = 1
    if (_tab === 'penelitian') loadPenelitian()
    else loadLuaran()
  }
  const onFilter = (key, v) => {
    if (key === 'status') _filterStatus = v
    if (key === 'skema')  _filterSkema  = v
    if (key === 'tahun')  _filterTahun  = v
    _page = 1; loadPenelitian()
  }
  const onFilterL = (key, v) => {
    if (key === 'jenis')   _filterJenis   = v
    if (key === 'validasi') _filterValidasi = v
    _pageL = 1; loadLuaran()
  }
  const lihatLuaran = (penelitianId) => {
    _filterPenelitianId = penelitianId
    _pageL = 1
    switchTab('luaran')
  }
  const clearFilter = () => {
    _filterPenelitianId = ''
    _pageL = 1
    loadLuaran()
    const btn = document.querySelector('#panel-luaran button[onclick*="clearFilter"]')
    if (btn) btn.remove()
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openModal = (title, bodyHtml) => {
    document.getElementById('modal-title').textContent = title
    document.getElementById('modal-body').innerHTML = bodyHtml
    document.getElementById('penelitian-modal').classList.remove('hidden')
  }
  const closeModal = () => {
    document.getElementById('penelitian-modal').classList.add('hidden')
  }

  // ── Penelitian CRUD ───────────────────────────────────────────────────────
  const penelitianFormHtml = (p = {}) => `
    <div class="space-y-4">
      <div>
        <label class="text-xs font-medium text-gray-600">Judul Penelitian *</label>
        <input id="f-judul" type="text" value="${p.judul||''}" placeholder="Judul lengkap penelitian"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Skema *</label>
          <select id="f-skema" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
            ${['mandiri','internal','dikti','hibah'].map(s=>`<option value="${s}" ${p.skema===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Tahun *</label>
          <select id="f-tahun" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
            ${[2025,2024,2023,2022].map(y=>`<option value="${y}" ${p.tahun==y?'selected':''}>${y}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Nama Ketua *</label>
          <input id="f-ketua-nama" type="text" value="${p.ketua_nama||''}" placeholder="Nama lengkap ketua"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Dana Diajukan (Rp)</label>
          <input id="f-dana" type="number" value="${p.dana_diajukan||''}" placeholder="0"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Abstrak / Deskripsi</label>
        <textarea id="f-abstrak" rows="3" placeholder="Deskripsi singkat penelitian"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300">${p.abstrak||''}</textarea>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button onclick="PenelitianModule.closeModal()" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
        <button onclick="PenelitianModule.saveForm('${p.id||''}')" class="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Simpan</button>
      </div>
    </div>
  `

  const openForm = () => openModal('Penelitian Baru', penelitianFormHtml())

  const edit = async (id) => {
    try {
      const res = await API.get('/penelitian/' + id)
      openModal('Edit Penelitian', penelitianFormHtml(res.data || {}))
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const saveForm = async (id) => {
    const judul     = document.getElementById('f-judul')?.value?.trim()
    const ketua     = document.getElementById('f-ketua-nama')?.value?.trim()
    const skema     = document.getElementById('f-skema')?.value
    const tahun     = parseInt(document.getElementById('f-tahun')?.value)
    const dana      = parseInt(document.getElementById('f-dana')?.value) || 0
    const abstrak   = document.getElementById('f-abstrak')?.value?.trim()
    if (!judul || !ketua) return UI.toast('Judul dan nama ketua wajib diisi', 'error')
    try {
      const body = { judul, ketua_nama: ketua, skema, tahun, dana_diajukan: dana, abstrak }
      if (id) { await API.put('/penelitian/' + id, body) } else { await API.post('/penelitian', body) }
      closeModal()
      UI.toast('Penelitian berhasil disimpan', 'success')
      loadStats(); loadPenelitian()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const detail = async (id) => {
    try {
      const res = await API.get('/penelitian/' + id)
      const p = res.data || {}
      const luaranRows = (p.luaran || []).map(l => `
        <tr>
          <td class="py-1 text-xs">${l.judul}</td>
          <td class="py-1 text-xs text-gray-500">${l.jenis}</td>
          <td class="py-1">${validasiBadge(l.status_validasi)}</td>
        </tr>
      `).join('') || '<tr><td colspan="3" class="py-2 text-xs text-gray-400">Belum ada luaran</td></tr>'
      openModal('Detail Penelitian', `
        <div class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-2">
            <div><span class="text-gray-500 text-xs">Status</span><br>${statusBadge(p.status)}</div>
            <div><span class="text-gray-500 text-xs">Skema</span><br>${skemaBadge(p.skema)}</div>
            <div><span class="text-gray-500 text-xs">Tahun</span><br><b>${p.tahun||'-'}</b></div>
            <div><span class="text-gray-500 text-xs">Ketua</span><br><b>${p.ketua_nama||'-'}</b></div>
            <div><span class="text-gray-500 text-xs">Dana Diajukan</span><br>Rp ${fmt(p.dana_diajukan)}</div>
            <div><span class="text-gray-500 text-xs">Dana Disetujui</span><br>Rp ${fmt(p.dana_disetujui)}</div>
            <div><span class="text-gray-500 text-xs">Tgl Mulai</span><br>${fmtDate(p.tgl_mulai)}</div>
            <div><span class="text-gray-500 text-xs">Tgl Selesai</span><br>${fmtDate(p.tgl_selesai)}</div>
          </div>
          <div>${progressBar(p.laporan_kemajuan_persen)}</div>
          ${p.catatan ? `<div class="bg-red-50 p-2 rounded text-xs text-red-700"><b>Catatan:</b> ${p.catatan}</div>` : ''}
          <div>
            <p class="text-xs text-gray-500 mb-1">Luaran (${(p.luaran||[]).length})</p>
            <table class="w-full"><thead class="text-xs text-gray-400 border-b"><tr><th class="pb-1 text-left">Judul</th><th class="pb-1 text-left">Jenis</th><th class="pb-1 text-left">Validasi</th></tr></thead>
            <tbody>${luaranRows}</tbody></table>
          </div>
          <div class="flex justify-end pt-2">
            <button onclick="PenelitianModule.closeModal()" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Tutup</button>
          </div>
        </div>
      `)
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const hapus = async (id) => {
    if (!confirm('Hapus penelitian ini?')) return
    try {
      await API.delete('/penelitian/' + id)
      UI.toast('Penelitian dihapus', 'success')
      loadStats(); loadPenelitian()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  // ── Status transitions ────────────────────────────────────────────────────
  const ajukan = async (id) => {
    if (!confirm('Ajukan penelitian ini ke LPPM?')) return
    try {
      await API.post('/penelitian/' + id + '/ajukan', {})
      UI.toast('Penelitian berhasil diajukan', 'success')
      loadStats(); loadPenelitian()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const setujui = (id) => {
    openModal('Setujui Penelitian', `
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-gray-600">Dana Disetujui (Rp)</label>
            <input id="f-dana-disetujui" type="number" placeholder="0"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600">Tgl Mulai</label>
            <input id="f-tgl-mulai" type="date"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button onclick="PenelitianModule.closeModal()" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
          <button onclick="PenelitianModule.doSetujui('${id}')" class="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Setujui</button>
        </div>
      </div>
    `)
  }

  const doSetujui = async (id) => {
    const dana    = parseInt(document.getElementById('f-dana-disetujui')?.value) || undefined
    const tglMulai= document.getElementById('f-tgl-mulai')?.value || undefined
    try {
      const body = {}
      if (dana)    body.dana_disetujui = dana
      if (tglMulai) body.tgl_mulai    = tglMulai
      await API.post('/penelitian/' + id + '/setujui', body)
      closeModal()
      UI.toast('Penelitian disetujui dan aktif', 'success')
      loadStats(); loadPenelitian()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const tolak = (id) => {
    openModal('Tolak Penelitian', `
      <div class="space-y-4">
        <div>
          <label class="text-xs font-medium text-gray-600">Alasan Penolakan *</label>
          <textarea id="f-catatan" rows="3" placeholder="Wajib diisi"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"></textarea>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button onclick="PenelitianModule.closeModal()" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
          <button onclick="PenelitianModule.doTolak('${id}')" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Tolak</button>
        </div>
      </div>
    `)
  }

  const doTolak = async (id) => {
    const catatan = document.getElementById('f-catatan')?.value?.trim()
    if (!catatan) return UI.toast('Alasan penolakan wajib diisi', 'error')
    try {
      await API.post('/penelitian/' + id + '/tolak', { catatan })
      closeModal()
      UI.toast('Penelitian ditolak', 'success')
      loadStats(); loadPenelitian()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const selesaikan = async (id) => {
    if (!confirm('Selesaikan penelitian ini? Laporan kemajuan harus sudah 100%.')) return
    try {
      await API.post('/penelitian/' + id + '/selesaikan', {})
      UI.toast('Penelitian diselesaikan', 'success')
      loadStats(); loadPenelitian()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const updateLaporan = (id, current) => {
    openModal('Update Laporan Kemajuan', `
      <div class="space-y-4">
        <div class="text-center">
          <p class="text-xs text-gray-500 mb-2">Persentase Laporan Kemajuan</p>
          <p id="laporan-val" class="text-4xl font-bold text-primary-600">${current}%</p>
          <input id="f-persen" type="range" min="0" max="100" step="5" value="${current}"
            oninput="document.getElementById('laporan-val').textContent=this.value+'%'"
            class="w-full mt-3 accent-primary-600"/>
          <div class="flex justify-between text-xs text-gray-400 mt-1">
            <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button onclick="PenelitianModule.closeModal()" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
          <button onclick="PenelitianModule.doUpdateLaporan('${id}')" class="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Simpan</button>
        </div>
      </div>
    `)
  }

  const doUpdateLaporan = async (id) => {
    const persen = parseInt(document.getElementById('f-persen')?.value) || 0
    try {
      await API.patch('/penelitian/' + id + '/laporan', { laporan_kemajuan_persen: persen })
      closeModal()
      UI.toast(`Laporan kemajuan diperbarui: ${persen}%`, 'success')
      loadStats(); loadPenelitian()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  // ── Luaran CRUD ───────────────────────────────────────────────────────────
  const luaranFormHtml = (l = {}, penelitianId = '') => `
    <div class="space-y-4">
      <div>
        <label class="text-xs font-medium text-gray-600">Judul Luaran *</label>
        <input id="f-l-judul" type="text" value="${l.judul||''}" placeholder="Judul artikel / buku / paten"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Jenis *</label>
          <select id="f-l-jenis" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
            ${['jurnal','prosiding','buku','paten','hki'].map(j=>`<option value="${j}" ${l.jenis===j?'selected':''}>${j.charAt(0).toUpperCase()+j.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Tahun Terbit</label>
          <input id="f-l-tahun" type="number" value="${l.tahun_terbit||''}" placeholder="2024"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Penerbit / Nama Jurnal / Konferensi</label>
        <input id="f-l-penerbit" type="text" value="${l.penerbit||''}" placeholder="Nama penerbit atau jurnal"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">URL / DOI</label>
        <input id="f-l-url" type="text" value="${l.url||''}" placeholder="https://doi.org/..."
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button onclick="PenelitianModule.closeModal()" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
        <button onclick="PenelitianModule.saveLuaran('${l.id||''}','${penelitianId||l.penelitian_id||''}')"
          class="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Simpan</button>
      </div>
    </div>
  `

  const editLuaran = async (id) => {
    try {
      const rows = await API.get('/penelitian/luaran/list?per_page=1000')
      const l = (rows.data || []).find(x => x.id === id)
      if (!l) return UI.toast('Luaran tidak ditemukan', 'error')
      openModal('Edit Luaran', luaranFormHtml(l))
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const saveLuaran = async (id, penelitianId) => {
    const judul    = document.getElementById('f-l-judul')?.value?.trim()
    const jenis    = document.getElementById('f-l-jenis')?.value
    const tahun    = parseInt(document.getElementById('f-l-tahun')?.value) || undefined
    const penerbit = document.getElementById('f-l-penerbit')?.value?.trim()
    const url      = document.getElementById('f-l-url')?.value?.trim()
    if (!judul) return UI.toast('Judul luaran wajib diisi', 'error')
    try {
      const body = { judul, jenis, tahun_terbit: tahun, penerbit, url }
      if (id) {
        await API.put('/penelitian/luaran/' + id, body)
      } else {
        if (!penelitianId) return UI.toast('Tidak ada ID penelitian', 'error')
        await API.post('/penelitian/' + penelitianId + '/luaran', body)
      }
      closeModal()
      UI.toast('Luaran berhasil disimpan', 'success')
      loadStats(); loadLuaran()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const hapusLuaran = async (id) => {
    if (!confirm('Hapus luaran ini?')) return
    try {
      await API.delete('/penelitian/luaran/' + id)
      UI.toast('Luaran dihapus', 'success')
      loadStats(); loadLuaran()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const validasiLuaran = (id, status) => {
    if (status === 'tervalidasi') {
      if (!confirm('Validasi luaran ini?')) return
      API.post('/penelitian/luaran/' + id + '/validasi', { status_validasi: 'tervalidasi', catatan_lppm: '' })
        .then(() => { UI.toast('Luaran tervalidasi', 'success'); loadStats(); loadLuaran() })
        .catch(e => UI.toast(e.message, 'error'))
      return
    }
    openModal('Tolak Luaran', `
      <div class="space-y-4">
        <div>
          <label class="text-xs font-medium text-gray-600">Catatan LPPM *</label>
          <textarea id="f-catatan-lppm" rows="3" placeholder="Alasan penolakan luaran wajib diisi"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"></textarea>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button onclick="PenelitianModule.closeModal()" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
          <button onclick="PenelitianModule.doTolakLuaran('${id}')" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Tolak Luaran</button>
        </div>
      </div>
    `)
  }

  const doTolakLuaran = async (id) => {
    const catatan = document.getElementById('f-catatan-lppm')?.value?.trim()
    if (!catatan) return UI.toast('Catatan LPPM wajib diisi', 'error')
    try {
      await API.post('/penelitian/luaran/' + id + '/validasi', { status_validasi: 'ditolak', catatan_lppm: catatan })
      closeModal()
      UI.toast('Luaran ditolak', 'success')
      loadStats(); loadLuaran()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  return {
    render, switchTab,
    onSearch, onFilter, onFilterL, lihatLuaran, clearFilter,
    openForm, edit, saveForm, detail, hapus,
    ajukan, setujui, doSetujui, tolak, doTolak,
    selesaikan, updateLaporan, doUpdateLaporan,
    editLuaran, saveLuaran, hapusLuaran,
    validasiLuaran, doTolakLuaran,
    closeModal,
  }
})()
