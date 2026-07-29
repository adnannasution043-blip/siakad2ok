// Modul Akreditasi
const AkreditasiModule = (() => {

  let _tab = 'prodi'
  let _filterBadan  = ''
  let _filterPeringkat = ''
  let _filterJenisDok  = ''
  let _filterProdiId   = ''
  let _search = ''
  let _page   = 1
  let _pageD  = 1

  // ── Badge helpers ────────────────────────────────────────────────────────
  const peringkatBadge = (p) => {
    const map = {
      'Unggul':              'bg-green-100 text-green-800',
      'Baik Sekali':         'bg-blue-100 text-blue-800',
      'Baik':                'bg-indigo-100 text-indigo-700',
      'A':                   'bg-green-100 text-green-800',
      'B':                   'bg-blue-100 text-blue-800',
      'C':                   'bg-yellow-100 text-yellow-700',
      'Terakreditasi':       'bg-gray-100 text-gray-700',
      'Belum Terakreditasi': 'bg-red-100 text-red-700',
    }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[p]||'bg-gray-100 text-gray-600'}">${p||'-'}</span>`
  }

  const statusAkr = (tglBerakhir) => {
    if (!tglBerakhir) return '<span class="text-xs text-gray-400">-</span>'
    const today  = new Date()
    const expiry = new Date(tglBerakhir)
    const diff   = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
    if (diff < 0)   return '<span class="text-xs text-red-600 font-medium">Kedaluwarsa</span>'
    if (diff <= 180) return `<span class="text-xs text-orange-600 font-medium">Berakhir ${diff} hari lagi</span>`
    return `<span class="text-xs text-green-600">Aktif</span>`
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '-'

  // ── Stats ────────────────────────────────────────────────────────────────
  const loadStats = async () => {
    try {
      const res = await API.get('/akreditasi/stats')
      const d = res.data || {}
      document.getElementById('akr-stat-total').textContent      = d.total_prodi ?? 0
      document.getElementById('akr-stat-terakreditasi').textContent = d.terakreditasi ?? 0
      document.getElementById('akr-stat-unggul').textContent     = d.unggul ?? 0
      document.getElementById('akr-stat-baik-sekali').textContent= d.baik_sekali ?? 0
      document.getElementById('akr-stat-berakhir').textContent   = d.akan_berakhir ?? 0
      document.getElementById('akr-stat-dokumen').textContent    = d.total_dokumen ?? 0
    } catch (_) {}
  }

  // ── Prodi List ────────────────────────────────────────────────────────────
  const loadProdi = async () => {
    const tbody = document.getElementById('akr-prodi-tbody')
    if (!tbody) return
    tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>'
    try {
      const params = new URLSearchParams({ page: _page, per_page: 15, search: _search })
      if (_filterBadan)    params.append('badan_akreditasi', _filterBadan)
      if (_filterPeringkat) params.append('peringkat', _filterPeringkat)
      const res = await API.get('/akreditasi/prodi?' + params)
      const items = res.data || []
      const meta  = res.meta || {}
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">Tidak ada data akreditasi prodi</td></tr>'
        document.getElementById('akr-prodi-info').textContent = ''
        document.getElementById('akr-prodi-pager').innerHTML  = ''
        return
      }
      tbody.innerHTML = items.map(r => `
        <tr class="table-row-hover">
          <td class="px-4 py-3">
            <div class="font-medium text-gray-800 text-sm">${r.prodi_nama}</div>
            <div class="text-xs text-gray-500">${r.jenjang||''}</div>
          </td>
          <td class="px-4 py-3 text-xs text-gray-600">${r.badan_akreditasi||'-'}</td>
          <td class="px-4 py-3">${peringkatBadge(r.peringkat)}</td>
          <td class="px-4 py-3 text-xs text-gray-500 font-mono">${r.nomor_sk||'-'}</td>
          <td class="px-4 py-3 text-xs text-gray-600">${fmtDate(r.tgl_berlaku)}</td>
          <td class="px-4 py-3 text-xs">${fmtDate(r.tgl_berakhir)}<br>${statusAkr(r.tgl_berakhir)}</td>
          <td class="px-4 py-3 text-right">
            <button onclick="AkreditasiModule.editProdi('${r.id}')" class="text-xs text-indigo-600 hover:underline mr-1">Edit</button>
            <button onclick="AkreditasiModule.lihatDokumen('${r.id}')" class="text-xs text-blue-600 hover:underline mr-1">Dokumen</button>
            <button onclick="AkreditasiModule.hapusProdi('${r.id}')" class="text-xs text-red-500 hover:underline mr-1">Hapus</button>
          </td>
        </tr>
      `).join('')
      document.getElementById('akr-prodi-info').textContent =
        `Menampilkan ${items.length} dari ${meta.total || items.length} data`
      renderPager('akr-prodi-pager', meta, (pg) => { _page = pg; loadProdi() })
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-red-400">${e.message}</td></tr>`
    }
  }

  // ── Dokumen List ──────────────────────────────────────────────────────────
  const loadDokumen = async () => {
    const tbody = document.getElementById('akr-dok-tbody')
    if (!tbody) return
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>'
    try {
      const params = new URLSearchParams({ page: _pageD, per_page: 15, search: _search })
      if (_filterJenisDok) params.append('jenis', _filterJenisDok)
      if (_filterProdiId)  params.append('prodi_id', _filterProdiId)
      const res = await API.get('/akreditasi/dokumen?' + params)
      const items = res.data || []
      const meta  = res.meta || {}
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Tidak ada dokumen akreditasi</td></tr>'
        document.getElementById('akr-dok-info').textContent = ''
        document.getElementById('akr-dok-pager').innerHTML  = ''
        return
      }
      const jenisBadge = (j) => {
        const m = { led:'bg-purple-100 text-purple-700', lkps:'bg-blue-100 text-blue-700', renstra:'bg-green-100 text-green-700', borang:'bg-orange-100 text-orange-700', lainnya:'bg-gray-100 text-gray-600' }
        return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${m[j]||'bg-gray-100 text-gray-600'}">${(j||'').toUpperCase()}</span>`
      }
      tbody.innerHTML = items.map(d => `
        <tr class="table-row-hover">
          <td class="px-4 py-3">
            <div class="font-medium text-gray-800 text-sm">${d.judul}</div>
            <div class="text-xs text-gray-500">${d.prodi_nama||'-'}</div>
          </td>
          <td class="px-4 py-3">${jenisBadge(d.jenis)}</td>
          <td class="px-4 py-3 text-sm text-gray-600">${d.tahun||'-'}</td>
          <td class="px-4 py-3 text-xs text-gray-500">${d.keterangan||'-'}</td>
          <td class="px-4 py-3 text-right">
            <button onclick="AkreditasiModule.editDokumen('${d.id}')" class="text-xs text-indigo-600 hover:underline mr-1">Edit</button>
            <button onclick="AkreditasiModule.hapusDokumen('${d.id}')" class="text-xs text-red-500 hover:underline mr-1">Hapus</button>
          </td>
        </tr>
      `).join('')
      document.getElementById('akr-dok-info').textContent =
        `Menampilkan ${items.length} dari ${meta.total || items.length} data`
      renderPager('akr-dok-pager', meta, (pg) => { _pageD = pg; loadDokumen() })
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-red-400">${e.message}</td></tr>`
    }
  }

  const renderPager = (elId, meta, cb) => {
    const el = document.getElementById(elId)
    if (!el || !meta || meta.total_pages <= 1) { if(el) el.innerHTML=''; return }
    const cur = meta.page, tot = meta.total_pages
    let html = '<div class="flex gap-1">'
    if (cur > 1) html += `<button onclick="(${cb})(${cur-1})" class="px-2 py-1 text-xs border rounded hover:bg-gray-50">‹</button>`
    for (let i = Math.max(1,cur-2); i <= Math.min(tot,cur+2); i++)
      html += `<button onclick="(${cb})(${i})" class="px-2 py-1 text-xs border rounded ${i===cur?'bg-primary-600 text-white border-primary-600':'hover:bg-gray-50'}">${i}</button>`
    if (cur < tot) html += `<button onclick="(${cb})(${cur+1})" class="px-2 py-1 text-xs border rounded hover:bg-gray-50">›</button>`
    el.innerHTML = html + '</div>'
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const render = () => {
    const el = document.getElementById('page-content')
    Router.setPageMeta('Akreditasi', 'Manajemen dokumen dan borang akreditasi')
    if (!el) return
    el.innerHTML = `
      <div class="p-6 space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold text-gray-800">Akreditasi</h1>
            <p class="text-sm text-gray-500">Status akreditasi program studi & pengelolaan dokumen</p>
          </div>
          <button onclick="AkreditasiModule.openFormProdi()" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">+ Tambah Akreditasi</button>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          ${[
            ['akr-stat-total',       'Total Prodi',       'text-blue-600'],
            ['akr-stat-terakreditasi','Terakreditasi',     'text-green-600'],
            ['akr-stat-unggul',      'Unggul',            'text-emerald-700'],
            ['akr-stat-baik-sekali', 'Baik Sekali',       'text-indigo-600'],
            ['akr-stat-berakhir',    'Akan Berakhir',     'text-orange-600'],
            ['akr-stat-dokumen',     'Total Dokumen',     'text-purple-600'],
          ].map(([id,lbl,cls]) => `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p class="text-xs text-gray-500">${lbl}</p>
              <p id="${id}" class="text-xl font-bold ${cls} mt-1">-</p>
            </div>`).join('')}
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-gray-200 gap-4">
          <button id="akr-tab-prodi" onclick="AkreditasiModule.switchTab('prodi')"
            class="pb-2 text-sm font-medium border-b-2 ${_tab==='prodi'?'border-primary-600 text-primary-600':'border-transparent text-gray-500 hover:text-gray-700'}">
            Status Akreditasi Prodi
          </button>
          <button id="akr-tab-dokumen" onclick="AkreditasiModule.switchTab('dokumen')"
            class="pb-2 text-sm font-medium border-b-2 ${_tab==='dokumen'?'border-primary-600 text-primary-600':'border-transparent text-gray-500 hover:text-gray-700'}">
            Dokumen Akreditasi
          </button>
        </div>

        <!-- Tab Prodi -->
        <div id="akr-panel-prodi" class="${_tab!=='prodi'?'hidden':''}">
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="p-4 flex flex-wrap gap-2 border-b border-gray-100">
              <input type="text" placeholder="Cari nama prodi, badan, nomor SK…" value="${_search}"
                oninput="AkreditasiModule.onSearch(this.value)"
                class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
              <select onchange="AkreditasiModule.onFilter('badan',this.value)" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                <option value="">Semua Badan</option>
                ${['BAN-PT','LAM-PTKes','LAM Teknik','LAM Ekonomi','LAM Hukum','LAM Sains Alam'].map(b=>`<option value="${b}" ${_filterBadan===b?'selected':''}>${b}</option>`).join('')}
              </select>
              <select onchange="AkreditasiModule.onFilter('peringkat',this.value)" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                <option value="">Semua Peringkat</option>
                ${['Unggul','Baik Sekali','Baik','A','B','C'].map(p=>`<option value="${p}" ${_filterPeringkat===p?'selected':''}>${p}</option>`).join('')}
              </select>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th class="px-4 py-3">Prodi</th>
                    <th class="px-4 py-3">Badan Akreditasi</th>
                    <th class="px-4 py-3">Peringkat</th>
                    <th class="px-4 py-3">Nomor SK</th>
                    <th class="px-4 py-3">Tgl Berlaku</th>
                    <th class="px-4 py-3">Berakhir</th>
                    <th class="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody id="akr-prodi-tbody" class="divide-y divide-gray-50"></tbody>
              </table>
            </div>
            <div class="px-4 py-3 flex items-center justify-between text-xs text-gray-500 border-t border-gray-100">
              <span id="akr-prodi-info"></span>
              <div id="akr-prodi-pager"></div>
            </div>
          </div>
        </div>

        <!-- Tab Dokumen -->
        <div id="akr-panel-dokumen" class="${_tab!=='dokumen'?'hidden':''}">
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="p-4 flex flex-wrap gap-2 border-b border-gray-100">
              <input type="text" placeholder="Cari judul dokumen…" value="${_search}"
                oninput="AkreditasiModule.onSearch(this.value)"
                class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
              <select onchange="AkreditasiModule.onFilterD(this.value)" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                <option value="">Semua Jenis</option>
                ${['led','lkps','renstra','borang','lainnya'].map(j=>`<option value="${j}" ${_filterJenisDok===j?'selected':''}>${j.toUpperCase()}</option>`).join('')}
              </select>
              ${_filterProdiId ? `<button onclick="AkreditasiModule.clearFilterDok()" class="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50">× Hapus Filter</button>` : ''}
              <button onclick="AkreditasiModule.openFormDokumen()" class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">+ Tambah Dokumen</button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th class="px-4 py-3">Judul / Prodi</th>
                    <th class="px-4 py-3">Jenis</th>
                    <th class="px-4 py-3">Tahun</th>
                    <th class="px-4 py-3">Keterangan</th>
                    <th class="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody id="akr-dok-tbody" class="divide-y divide-gray-50"></tbody>
              </table>
            </div>
            <div class="px-4 py-3 flex items-center justify-between text-xs text-gray-500 border-t border-gray-100">
              <span id="akr-dok-info"></span>
              <div id="akr-dok-pager"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal -->
      <div id="akr-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40" onclick="AkreditasiModule.closeModal()"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div class="p-6">
            <h2 id="akr-modal-title" class="text-lg font-semibold text-gray-800 mb-4">Akreditasi</h2>
            <div id="akr-modal-body"></div>
          </div>
        </div>
      </div>
    `
    loadStats()
    if (_tab === 'prodi') loadProdi()
    else loadDokumen()
  }

  const switchTab = (tab) => {
    _tab = tab; _search = ''; _page = 1; _pageD = 1
    ;['prodi','dokumen'].forEach(t => {
      const btn   = document.getElementById('akr-tab-' + t)
      const panel = document.getElementById('akr-panel-' + t)
      if (btn) btn.className = `pb-2 text-sm font-medium border-b-2 ${t===tab?'border-primary-600 text-primary-600':'border-transparent text-gray-500 hover:text-gray-700'}`
      if (panel) panel.classList.toggle('hidden', t !== tab)
    })
    if (tab === 'prodi') loadProdi(); else loadDokumen()
  }

  const openModal = (title, html) => {
    document.getElementById('akr-modal-title').textContent = title
    document.getElementById('akr-modal-body').innerHTML = html
    document.getElementById('akr-modal').classList.remove('hidden')
  }
  const closeModal = () => document.getElementById('akr-modal').classList.add('hidden')

  const onSearch = (v) => {
    _search = v; _page = 1; _pageD = 1
    if (_tab === 'prodi') loadProdi(); else loadDokumen()
  }
  const onFilter = (key, v) => {
    if (key === 'badan')    _filterBadan    = v
    if (key === 'peringkat') _filterPeringkat = v
    _page = 1; loadProdi()
  }
  const onFilterD = (v) => { _filterJenisDok = v; _pageD = 1; loadDokumen() }
  const lihatDokumen = (prodiId) => { _filterProdiId = prodiId; switchTab('dokumen') }
  const clearFilterDok = () => { _filterProdiId = ''; _pageD = 1; loadDokumen() }

  // ── Prodi CRUD ────────────────────────────────────────────────────────────
  const prodiFormHtml = (r = {}) => `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Nama Prodi *</label>
          <input id="arf-nama" type="text" value="${r.prodi_nama||''}" placeholder="Nama program studi"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Jenjang</label>
          <select id="arf-jenjang" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
            ${['D3','D4','S1','S2','S3','Profesi'].map(j=>`<option value="${j}" ${r.jenjang===j?'selected':''}>${j}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Badan Akreditasi</label>
          <select id="arf-badan" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
            ${['BAN-PT','LAM-PTKes','LAM Teknik','LAM Ekonomi','LAM Hukum','LAM Sains Alam'].map(b=>`<option value="${b}" ${r.badan_akreditasi===b?'selected':''}>${b}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Peringkat</label>
          <select id="arf-peringkat" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
            ${['Unggul','Baik Sekali','Baik','A','B','C','Terakreditasi','Belum Terakreditasi'].map(p=>`<option value="${p}" ${r.peringkat===p?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Nomor SK</label>
        <input id="arf-sk" type="text" value="${r.nomor_sk||''}" placeholder="Nomor SK akreditasi"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Tgl Berlaku</label>
          <input id="arf-berlaku" type="date" value="${r.tgl_berlaku||''}"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Tgl Berakhir</label>
          <input id="arf-berakhir" type="date" value="${r.tgl_berakhir||''}"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Nilai Numerik (opsional)</label>
        <input id="arf-nilai" type="number" value="${r.nilai_numerik||''}" placeholder="mis: 375"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button onclick="AkreditasiModule.closeModal()" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
        <button onclick="AkreditasiModule.saveProdi('${r.id||''}')" class="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Simpan</button>
      </div>
    </div>
  `

  const openFormProdi = () => openModal('Tambah Akreditasi Prodi', prodiFormHtml())
  const editProdi = async (id) => {
    try {
      const res = await API.get('/akreditasi/prodi/' + id)
      openModal('Edit Akreditasi Prodi', prodiFormHtml(res.data || {}))
    } catch (e) { UI.toast(e.message, 'error') }
  }
  const saveProdi = async (id) => {
    const nama     = document.getElementById('arf-nama')?.value?.trim()
    const jenjang  = document.getElementById('arf-jenjang')?.value
    const badan    = document.getElementById('arf-badan')?.value
    const peringkat= document.getElementById('arf-peringkat')?.value
    const sk       = document.getElementById('arf-sk')?.value?.trim()
    const berlaku  = document.getElementById('arf-berlaku')?.value
    const berakhir = document.getElementById('arf-berakhir')?.value
    const nilai    = parseInt(document.getElementById('arf-nilai')?.value) || undefined
    if (!nama) return UI.toast('Nama prodi wajib diisi', 'error')
    try {
      const body = { prodi_nama: nama, jenjang, badan_akreditasi: badan, peringkat, nomor_sk: sk, tgl_berlaku: berlaku, tgl_berakhir: berakhir, nilai_numerik: nilai }
      if (id) { await API.put('/akreditasi/prodi/' + id, body) } else { await API.post('/akreditasi/prodi', body) }
      closeModal(); UI.toast('Data akreditasi disimpan', 'success')
      loadStats(); loadProdi()
    } catch (e) { UI.toast(e.message, 'error') }
  }
  const hapusProdi = async (id) => {
    if (!confirm('Hapus data akreditasi prodi ini?')) return
    try {
      await API.delete('/akreditasi/prodi/' + id)
      UI.toast('Data akreditasi dihapus', 'success'); loadStats(); loadProdi()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  // ── Dokumen CRUD ──────────────────────────────────────────────────────────
  const dokumenFormHtml = (d = {}) => `
    <div class="space-y-4">
      <div>
        <label class="text-xs font-medium text-gray-600">Judul Dokumen *</label>
        <input id="dkf-judul" type="text" value="${d.judul||''}" placeholder="Judul dokumen akreditasi"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Jenis</label>
          <select id="dkf-jenis" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
            ${['led','lkps','renstra','borang','lainnya'].map(j=>`<option value="${j}" ${d.jenis===j?'selected':''}>${j.toUpperCase()}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Tahun</label>
          <input id="dkf-tahun" type="number" value="${d.tahun||new Date().getFullYear()}" placeholder="2025"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Nama Prodi</label>
        <input id="dkf-prodi" type="text" value="${d.prodi_nama||''}" placeholder="Nama program studi"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Keterangan</label>
        <textarea id="dkf-ket" rows="2" placeholder="Keterangan singkat dokumen"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300">${d.keterangan||''}</textarea>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button onclick="AkreditasiModule.closeModal()" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
        <button onclick="AkreditasiModule.saveDokumen('${d.id||''}','${d.prodi_id||_filterProdiId||''}')" class="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Simpan</button>
      </div>
    </div>
  `
  const openFormDokumen = () => openModal('Tambah Dokumen Akreditasi', dokumenFormHtml())
  const editDokumen = async (id) => {
    try {
      const res = await API.get('/akreditasi/dokumen?' + new URLSearchParams({ per_page: 1000 }))
      const d = (res.data || []).find(x => x.id === id)
      if (!d) return UI.toast('Dokumen tidak ditemukan', 'error')
      openModal('Edit Dokumen', dokumenFormHtml(d))
    } catch (e) { UI.toast(e.message, 'error') }
  }
  const saveDokumen = async (id, prodiId) => {
    const judul  = document.getElementById('dkf-judul')?.value?.trim()
    const jenis  = document.getElementById('dkf-jenis')?.value
    const tahun  = parseInt(document.getElementById('dkf-tahun')?.value) || new Date().getFullYear()
    const prodi  = document.getElementById('dkf-prodi')?.value?.trim()
    const ket    = document.getElementById('dkf-ket')?.value?.trim()
    if (!judul) return UI.toast('Judul dokumen wajib diisi', 'error')
    try {
      const body = { judul, jenis, tahun, prodi_nama: prodi, prodi_id: prodiId||undefined, keterangan: ket }
      if (id) { await API.put('/akreditasi/dokumen/' + id, body) } else { await API.post('/akreditasi/dokumen', body) }
      closeModal(); UI.toast('Dokumen berhasil disimpan', 'success')
      loadStats(); loadDokumen()
    } catch (e) { UI.toast(e.message, 'error') }
  }
  const hapusDokumen = async (id) => {
    if (!confirm('Hapus dokumen ini?')) return
    try {
      await API.delete('/akreditasi/dokumen/' + id)
      UI.toast('Dokumen dihapus', 'success'); loadStats(); loadDokumen()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  return {
    render, switchTab, onSearch, onFilter, onFilterD, lihatDokumen, clearFilterDok,
    openFormProdi, editProdi, saveProdi, hapusProdi,
    openFormDokumen, editDokumen, saveDokumen, hapusDokumen,
    closeModal,
  }
})()
