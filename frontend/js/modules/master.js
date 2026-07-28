// ============================================================
// MASTER.JS — Master Data: Program Studi, Mata Kuliah, Ruang
// ============================================================
const MasterModule = (() => {

  let activeTab = 'prodi'

  // ── Tab switcher ───────────────────────────────────────────
  const render = async () => {
    Router.setPageMeta('Master Data', 'Program studi, mata kuliah, dan ruang')
    document.getElementById('page-content').innerHTML = `
      <div class="flex gap-1 mb-5 bg-white border border-slate-200 rounded-xl p-1 w-fit">
        ${tab('prodi',  'Program Studi')}
        ${tab('mk',     'Mata Kuliah')}
        ${tab('ruang',  'Ruang')}
      </div>
      <div id="master-content"></div>
    `
    switchTab(activeTab)
  }

  const tab = (id, label) => `
    <button id="tab-${id}" onclick="MasterModule.switchTab('${id}')"
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === id ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}">
      ${label}
    </button>`

  const switchTab = (id) => {
    activeTab = id
    document.querySelectorAll('[id^="tab-"]').forEach(el => {
      const isActive = el.id === `tab-${id}`
      el.className = `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`
    })
    if (id === 'prodi')  ProdiTab.render()
    if (id === 'mk')     MKTab.render()
    if (id === 'ruang')  RuangTab.render()
  }

  // ══════════════════════════════════════════════════════════
  // TAB: PROGRAM STUDI
  // ══════════════════════════════════════════════════════════
  const ProdiTab = (() => {
    let state = { list: [], meta: null, page: 1, search: '', jenjang: '' }

    const JENJANG = ['D3', 'S1', 'S2', 'S3']
    const AKREDITASI = ['Unggul', 'Baik Sekali', 'Baik', 'A', 'B', 'C']

    const fetch = async () => {
      const res = await API.get('/master/prodi', {
        page: state.page, per_page: 20,
        search: state.search, jenjang: state.jenjang,
      })
      state.list = res.data
      state.meta = res.meta
      renderTable()
      renderPagination()
    }

    const render = async () => {
      document.getElementById('master-content').innerHTML = `
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <div class="flex-1 min-w-48">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input id="prodi-search" type="text" placeholder="Cari nama atau kode..."
                value="${state.search}"
                class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                oninput="MasterModule.prodiSearch(this.value)" />
            </div>
          </div>
          <select onchange="MasterModule.prodiFilter('jenjang', this.value)"
            class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
            <option value="">Semua Jenjang</option>
            ${JENJANG.map(j => `<option value="${j}" ${state.jenjang===j?'selected':''}>${j}</option>`).join('')}
          </select>
          <button onclick="MasterModule.prodiOpenForm()"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Tambah Prodi
          </button>
        </div>
        ${UI.card(`<div id="prodi-table"></div><div id="prodi-pag"></div>`)}
      `
      await fetch()
    }

    const jenjangBadge = (j) => {
      const m = { D3:'bg-indigo-100 text-indigo-700', S1:'bg-blue-100 text-blue-700', S2:'bg-purple-100 text-purple-700', S3:'bg-rose-100 text-rose-700' }
      return `<span class="badge ${m[j]||'bg-slate-100 text-slate-600'}">${j}</span>`
    }

    const akreditasiBadge = (a) => {
      const m = { Unggul:'bg-green-100 text-green-700', 'Baik Sekali':'bg-teal-100 text-teal-700', Baik:'bg-blue-100 text-blue-700', A:'bg-green-100 text-green-700', B:'bg-yellow-100 text-yellow-700', C:'bg-orange-100 text-orange-700' }
      return `<span class="badge ${m[a]||'bg-slate-100 text-slate-600'}">${a}</span>`
    }

    const renderTable = () => {
      document.getElementById('prodi-table').innerHTML = UI.renderTable({
        headers: ['Kode', 'Nama Program Studi', 'Jenjang', 'Akreditasi', 'SKS Lulus', 'Mhs', 'MK', 'Status', 'Aksi'],
        emptyText: 'Tidak ada data program studi',
        rows: state.list.map(p => `
          <td class="px-4 py-3 font-mono text-xs font-semibold text-slate-700">${p.kode}</td>
          <td class="px-4 py-3 font-medium text-slate-800 text-sm">${p.nama}</td>
          <td class="px-4 py-3">${jenjangBadge(p.jenjang)}</td>
          <td class="px-4 py-3">${akreditasiBadge(p.akreditasi)}</td>
          <td class="px-4 py-3 text-sm text-center text-slate-600">${p.total_sks_lulus}</td>
          <td class="px-4 py-3 text-sm text-center text-slate-600">${p.jumlah_mahasiswa}</td>
          <td class="px-4 py-3 text-sm text-center text-slate-600">${p.jumlah_mk}</td>
          <td class="px-4 py-3">
            ${p.is_active
              ? '<span class="badge bg-green-100 text-green-700">Aktif</span>'
              : '<span class="badge bg-slate-100 text-slate-500">Nonaktif</span>'}
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-1">
              <button onclick="MasterModule.prodiOpenForm('${p.id}')" title="Edit"
                class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button onclick="MasterModule.prodiDelete('${p.id}','${p.nama}')" title="Hapus"
                class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </td>
        `)
      })
    }

    const renderPagination = () => {
      document.getElementById('prodi-pag').innerHTML = UI.renderPagination(state.meta, 'MasterModule.prodiPage')
    }

    const openForm = async (id = null) => {
      let p = null
      if (id) {
        try { const r = await API.get(`/master/prodi/${id}`); p = r.data } catch (e) { UI.toast(e.message,'error'); return }
      }
      UI.openModal(`
        <div class="p-5 border-b border-slate-200">
          <h3 class="font-semibold text-slate-800">${p ? 'Edit' : 'Tambah'} Program Studi</h3>
        </div>
        <form id="prodi-form" class="p-5 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            ${UI.input('kode', 'Kode', 'text', p?.kode||'', 'TI', !p)}
            ${UI.select('jenjang', 'Jenjang', JENJANG.map(j=>({value:j,label:j})), p?.jenjang||'S1', true)}
          </div>
          ${UI.input('nama', 'Nama Program Studi', 'text', p?.nama||'', 'Teknik Informatika', true)}
          <div class="grid grid-cols-2 gap-4">
            ${UI.select('akreditasi', 'Akreditasi', AKREDITASI.map(a=>({value:a,label:a})), p?.akreditasi||'B', true)}
            ${UI.input('total_sks_lulus', 'Total SKS Lulus', 'number', p?.total_sks_lulus||144, '144', true)}
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" name="is_active" id="prodi-active" value="true" ${!p||p.is_active?'checked':''} class="rounded border-slate-300 text-primary-600">
            <label for="prodi-active" class="text-sm text-slate-700">Program Studi Aktif</label>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Batal</button>
            <button type="submit" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg">
              ${p ? 'Simpan Perubahan' : 'Tambah Prodi'}
            </button>
          </div>
        </form>
      `)
      document.getElementById('prodi-form').addEventListener('submit', async (e) => {
        e.preventDefault()
        const fd = new FormData(e.target)
        const body = Object.fromEntries(fd.entries())
        body.total_sks_lulus = parseInt(body.total_sks_lulus)
        body.is_active = !!document.getElementById('prodi-active').checked
        const btn = e.target.querySelector('button[type=submit]')
        btn.disabled = true; btn.textContent = 'Menyimpan...'
        try {
          if (p) { await API.put(`/master/prodi/${p.id}`, body); UI.toast('Program studi diperbarui') }
          else    { await API.post('/master/prodi', body); UI.toast('Program studi ditambahkan') }
          UI.closeModal(); await fetch()
        } catch (err) { UI.toast(err.message,'error'); btn.disabled=false; btn.textContent = p?'Simpan Perubahan':'Tambah Prodi' }
      })
    }

    const doDelete = async (id, nama) => {
      UI.openModal(`
        <div class="p-6 text-center">
          <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <h3 class="font-semibold text-slate-800 mb-1">Hapus Program Studi?</h3>
          <p class="text-sm text-slate-500 mb-6"><strong>${nama}</strong> akan dihapus dari sistem.</p>
          <div class="flex justify-center gap-3">
            <button onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Batal</button>
            <button onclick="MasterModule._prodiConfirmDelete('${id}')" class="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Ya, Hapus</button>
          </div>
        </div>`)
    }

    const confirmDelete = async (id) => {
      try { await API.delete(`/master/prodi/${id}`); UI.closeModal(); UI.toast('Program studi dihapus'); await fetch() }
      catch (e) { UI.toast(e.message,'error') }
    }

    let timer = null
    const onSearch = (v) => { clearTimeout(timer); timer = setTimeout(() => { state.search=v; state.page=1; fetch() }, 400) }
    const onFilter = (k, v) => { state[k]=v; state.page=1; fetch() }
    const goPage = (p) => { state.page=p; fetch() }

    return { render, openForm, doDelete, confirmDelete, onSearch, onFilter, goPage }
  })()

  // ══════════════════════════════════════════════════════════
  // TAB: MATA KULIAH
  // ══════════════════════════════════════════════════════════
  const MKTab = (() => {
    let state = { list: [], meta: null, prodiList: [], page: 1, search: '', prodi_id: '', jenis: '' }

    const fetchProdi = async () => {
      if (state.prodiList.length) return
      const r = await API.get('/master/prodi', { per_page: 100 })
      state.prodiList = r.data || []
    }

    const fetch = async () => {
      const res = await API.get('/master/mk', {
        page: state.page, per_page: 20,
        search: state.search, prodi_id: state.prodi_id, jenis: state.jenis,
      })
      state.list = res.data
      state.meta = res.meta
      renderTable()
      renderPagination()
    }

    const render = async () => {
      await fetchProdi()
      document.getElementById('master-content').innerHTML = `
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <div class="flex-1 min-w-48">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input id="mk-search" type="text" placeholder="Cari nama atau kode MK..."
                value="${state.search}"
                class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                oninput="MasterModule.mkSearch(this.value)" />
            </div>
          </div>
          <select onchange="MasterModule.mkFilter('prodi_id', this.value)"
            class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
            <option value="">Semua Prodi</option>
            ${state.prodiList.map(p => `<option value="${p.id}" ${state.prodi_id===p.id?'selected':''}>${p.nama} (${p.jenjang})</option>`).join('')}
          </select>
          <select onchange="MasterModule.mkFilter('jenis', this.value)"
            class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
            <option value="">Semua Jenis</option>
            <option value="wajib"  ${state.jenis==='wajib'?'selected':''}>Wajib</option>
            <option value="pilihan" ${state.jenis==='pilihan'?'selected':''}>Pilihan</option>
          </select>
          <button onclick="MasterModule.mkOpenForm()"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Tambah MK
          </button>
        </div>
        ${UI.card(`<div id="mk-table"></div><div id="mk-pag"></div>`)}
      `
      await fetch()
    }

    const jenisBadge = (j) => {
      const m = { wajib:'bg-blue-100 text-blue-700', pilihan:'bg-purple-100 text-purple-700' }
      return `<span class="badge ${m[j]||'bg-slate-100 text-slate-600'}">${j}</span>`
    }

    const renderTable = () => {
      document.getElementById('mk-table').innerHTML = UI.renderTable({
        headers: ['Kode', 'Nama Mata Kuliah', 'Program Studi', 'Sem.', 'SKS', 'Jenis', 'Prasyarat', 'Aksi'],
        emptyText: 'Tidak ada data mata kuliah',
        rows: state.list.map(m => `
          <td class="px-4 py-3 font-mono text-xs font-semibold text-slate-700">${m.kode_mk}</td>
          <td class="px-4 py-3 font-medium text-slate-800 text-sm">${m.nama}</td>
          <td class="px-4 py-3 text-sm text-slate-600">${m.program_studi?.nama||'—'}</td>
          <td class="px-4 py-3 text-sm text-center text-slate-600">${m.semester}</td>
          <td class="px-4 py-3 text-sm text-center font-medium text-slate-800">${m.sks}</td>
          <td class="px-4 py-3">${jenisBadge(m.jenis)}</td>
          <td class="px-4 py-3 text-xs text-slate-500">
            ${(m.prasyarat||[]).length > 0 ? (m.prasyarat||[]).map(p=>`<span class="badge bg-slate-100 text-slate-600 mr-1">${p.kode_mk}</span>`).join('') : '—'}
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-1">
              <button onclick="MasterModule.mkOpenForm('${m.id}')" title="Edit"
                class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button onclick="MasterModule.mkDelete('${m.id}','${m.nama}')" title="Hapus"
                class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </td>
        `)
      })
    }

    const renderPagination = () => {
      document.getElementById('mk-pag').innerHTML = UI.renderPagination(state.meta, 'MasterModule.mkPage')
    }

    const openForm = async (id = null) => {
      await fetchProdi()
      let m = null
      if (id) {
        try { const r = await API.get(`/master/mk/${id}`); m = r.data } catch (e) { UI.toast(e.message,'error'); return }
      }
      const semOpts = [1,2,3,4,5,6,7,8].map(s => ({ value: s, label: `Semester ${s}` }))
      UI.openModal(`
        <div class="p-5 border-b border-slate-200">
          <h3 class="font-semibold text-slate-800">${m ? 'Edit' : 'Tambah'} Mata Kuliah</h3>
        </div>
        <form id="mk-form" class="p-5 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            ${UI.input('kode_mk', 'Kode MK', 'text', m?.kode_mk||'', 'TI101', !m)}
            ${UI.input('sks', 'SKS', 'number', m?.sks||3, '3', true)}
          </div>
          ${UI.input('nama', 'Nama Mata Kuliah', 'text', m?.nama||'', 'Algoritma dan Pemrograman', true)}
          <div class="grid grid-cols-2 gap-4">
            ${UI.select('program_studi_id', 'Program Studi', state.prodiList.map(p=>({value:p.id,label:`${p.nama} (${p.jenjang})`})), m?.program_studi_id||'', true)}
            ${UI.select('semester', 'Semester', semOpts, m?.semester||1, true)}
          </div>
          ${UI.select('jenis', 'Jenis', [{value:'wajib',label:'Wajib'},{value:'pilihan',label:'Pilihan'}], m?.jenis||'wajib', true)}
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Batal</button>
            <button type="submit" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg">
              ${m ? 'Simpan Perubahan' : 'Tambah Mata Kuliah'}
            </button>
          </div>
        </form>
      `)
      document.getElementById('mk-form').addEventListener('submit', async (e) => {
        e.preventDefault()
        const fd = new FormData(e.target)
        const body = Object.fromEntries(fd.entries())
        body.sks = parseInt(body.sks)
        body.semester = parseInt(body.semester)
        body.prasyarat_ids = []
        const btn = e.target.querySelector('button[type=submit]')
        btn.disabled = true; btn.textContent = 'Menyimpan...'
        try {
          if (m) { await API.put(`/master/mk/${m.id}`, body); UI.toast('Mata kuliah diperbarui') }
          else    { await API.post('/master/mk', body); UI.toast('Mata kuliah ditambahkan') }
          UI.closeModal(); await fetch()
        } catch (err) { UI.toast(err.message,'error'); btn.disabled=false; btn.textContent = m?'Simpan Perubahan':'Tambah Mata Kuliah' }
      })
    }

    const doDelete = (id, nama) => {
      UI.openModal(`
        <div class="p-6 text-center">
          <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <h3 class="font-semibold text-slate-800 mb-1">Hapus Mata Kuliah?</h3>
          <p class="text-sm text-slate-500 mb-6"><strong>${nama}</strong> akan dihapus dari sistem.</p>
          <div class="flex justify-center gap-3">
            <button onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Batal</button>
            <button onclick="MasterModule._mkConfirmDelete('${id}')" class="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Ya, Hapus</button>
          </div>
        </div>`)
    }

    const confirmDelete = async (id) => {
      try { await API.delete(`/master/mk/${id}`); UI.closeModal(); UI.toast('Mata kuliah dihapus'); await fetch() }
      catch (e) { UI.toast(e.message,'error') }
    }

    let timer = null
    const onSearch = (v) => { clearTimeout(timer); timer = setTimeout(() => { state.search=v; state.page=1; fetch() }, 400) }
    const onFilter = (k, v) => { state[k]=v; state.page=1; fetch() }
    const goPage = (p) => { state.page=p; fetch() }

    return { render, openForm, doDelete, confirmDelete, onSearch, onFilter, goPage }
  })()

  // ══════════════════════════════════════════════════════════
  // TAB: RUANG
  // ══════════════════════════════════════════════════════════
  const RuangTab = (() => {
    let state = { list: [], meta: null, gedungList: [], page: 1, search: '', gedung: '' }

    const FASILITAS_OPT = ['AC', 'Proyektor', 'Whiteboard', 'Smart TV', 'Lab Komputer', 'Internet WiFi', 'Sound System']

    const fetchGedung = async () => {
      if (state.gedungList.length) return
      const r = await API.get('/master/ruang/gedung-list')
      state.gedungList = r.data || []
    }

    const fetch = async () => {
      const res = await API.get('/master/ruang', {
        page: state.page, per_page: 20,
        search: state.search, gedung: state.gedung,
      })
      state.list = res.data
      state.meta = res.meta
      renderTable()
      renderPagination()
    }

    const render = async () => {
      await fetchGedung()
      document.getElementById('master-content').innerHTML = `
        <div class="flex flex-wrap items-center gap-3 mb-4">
          <div class="flex-1 min-w-48">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input id="ruang-search" type="text" placeholder="Cari nama atau kode ruang..."
                value="${state.search}"
                class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                oninput="MasterModule.ruangSearch(this.value)" />
            </div>
          </div>
          <select onchange="MasterModule.ruangFilter('gedung', this.value)"
            class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
            <option value="">Semua Gedung</option>
            ${state.gedungList.map(g => `<option value="${g}" ${state.gedung===g?'selected':''}>${g}</option>`).join('')}
          </select>
          <button onclick="MasterModule.ruangOpenForm()"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Tambah Ruang
          </button>
        </div>
        ${UI.card(`<div id="ruang-table"></div><div id="ruang-pag"></div>`)}
      `
      await fetch()
    }

    const renderTable = () => {
      document.getElementById('ruang-table').innerHTML = UI.renderTable({
        headers: ['Kode', 'Nama Ruang', 'Gedung', 'Lantai', 'Kapasitas', 'Fasilitas', 'Aksi'],
        emptyText: 'Tidak ada data ruang',
        rows: state.list.map(r => `
          <td class="px-4 py-3 font-mono text-xs font-semibold text-slate-700">${r.kode}</td>
          <td class="px-4 py-3 font-medium text-slate-800 text-sm">${r.nama}</td>
          <td class="px-4 py-3 text-sm text-slate-600">${r.gedung}</td>
          <td class="px-4 py-3 text-sm text-center text-slate-600">Lt. ${r.lantai}</td>
          <td class="px-4 py-3 text-sm text-center text-slate-600">
            <span class="badge bg-blue-50 text-blue-600">${r.kapasitas} org</span>
          </td>
          <td class="px-4 py-3">
            <div class="flex flex-wrap gap-1">
              ${(r.fasilitas||[]).map(f=>`<span class="badge bg-slate-100 text-slate-600">${f}</span>`).join('') || '—'}
            </div>
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-1">
              <button onclick="MasterModule.ruangOpenForm('${r.id}')" title="Edit"
                class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button onclick="MasterModule.ruangDelete('${r.id}','${r.nama}')" title="Hapus"
                class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </td>
        `)
      })
    }

    const renderPagination = () => {
      document.getElementById('ruang-pag').innerHTML = UI.renderPagination(state.meta, 'MasterModule.ruangPage')
    }

    const openForm = async (id = null) => {
      let r = null
      if (id) {
        try { const res = await API.get(`/master/ruang/${id}`); r = res.data } catch (e) { UI.toast(e.message,'error'); return }
      }
      const currentFas = r?.fasilitas || []
      UI.openModal(`
        <div class="p-5 border-b border-slate-200">
          <h3 class="font-semibold text-slate-800">${r ? 'Edit' : 'Tambah'} Ruang</h3>
        </div>
        <form id="ruang-form" class="p-5 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            ${UI.input('kode', 'Kode', 'text', r?.kode||'', 'A101', !r)}
            ${UI.input('kapasitas', 'Kapasitas (org)', 'number', r?.kapasitas||30, '30', true)}
          </div>
          ${UI.input('nama', 'Nama Ruang', 'text', r?.nama||'', 'Ruang A101', true)}
          <div class="grid grid-cols-2 gap-4">
            ${UI.input('gedung', 'Gedung', 'text', r?.gedung||'', 'Gedung A', true)}
            ${UI.input('lantai', 'Lantai', 'number', r?.lantai||1, '1', true)}
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Fasilitas</label>
            <div class="flex flex-wrap gap-2">
              ${FASILITAS_OPT.map(f => `
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" name="fasilitas" value="${f}" ${currentFas.includes(f)?'checked':''}
                    class="rounded border-slate-300 text-primary-600">
                  <span class="text-sm text-slate-700">${f}</span>
                </label>`).join('')}
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Batal</button>
            <button type="submit" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg">
              ${r ? 'Simpan Perubahan' : 'Tambah Ruang'}
            </button>
          </div>
        </form>
      `)
      document.getElementById('ruang-form').addEventListener('submit', async (e) => {
        e.preventDefault()
        const fd = new FormData(e.target)
        const body = Object.fromEntries(fd.entries())
        body.kapasitas = parseInt(body.kapasitas)
        body.lantai = parseInt(body.lantai)
        body.fasilitas = fd.getAll('fasilitas')
        const btn = e.target.querySelector('button[type=submit]')
        btn.disabled = true; btn.textContent = 'Menyimpan...'
        try {
          if (r) { await API.put(`/master/ruang/${r.id}`, body); UI.toast('Ruang diperbarui') }
          else    { await API.post('/master/ruang', body); UI.toast('Ruang ditambahkan') }
          UI.closeModal(); await fetch()
        } catch (err) { UI.toast(err.message,'error'); btn.disabled=false; btn.textContent = r?'Simpan Perubahan':'Tambah Ruang' }
      })
    }

    const doDelete = (id, nama) => {
      UI.openModal(`
        <div class="p-6 text-center">
          <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <h3 class="font-semibold text-slate-800 mb-1">Hapus Ruang?</h3>
          <p class="text-sm text-slate-500 mb-6"><strong>${nama}</strong> akan dihapus dari sistem.</p>
          <div class="flex justify-center gap-3">
            <button onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Batal</button>
            <button onclick="MasterModule._ruangConfirmDelete('${id}')" class="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Ya, Hapus</button>
          </div>
        </div>`)
    }

    const confirmDelete = async (id) => {
      try { await API.delete(`/master/ruang/${id}`); UI.closeModal(); UI.toast('Ruang dihapus'); await fetch() }
      catch (e) { UI.toast(e.message,'error') }
    }

    let timer = null
    const onSearch = (v) => { clearTimeout(timer); timer = setTimeout(() => { state.search=v; state.page=1; fetch() }, 400) }
    const onFilter = (k, v) => { state[k]=v; state.page=1; fetch() }
    const goPage = (p) => { state.page=p; fetch() }

    return { render, openForm, doDelete, confirmDelete, onSearch, onFilter, goPage }
  })()

  // ── Public API (dipanggil dari HTML inline event) ──────────
  return {
    render,
    switchTab,
    // Program Studi
    prodiSearch:  (v)    => ProdiTab.onSearch(v),
    prodiFilter:  (k, v) => ProdiTab.onFilter(k, v),
    prodiPage:    (p)    => ProdiTab.goPage(p),
    prodiOpenForm:(id)   => ProdiTab.openForm(id),
    prodiDelete:  (id,n) => ProdiTab.doDelete(id, n),
    _prodiConfirmDelete: (id) => ProdiTab.confirmDelete(id),
    // Mata Kuliah
    mkSearch:     (v)    => MKTab.onSearch(v),
    mkFilter:     (k, v) => MKTab.onFilter(k, v),
    mkPage:       (p)    => MKTab.goPage(p),
    mkOpenForm:   (id)   => MKTab.openForm(id),
    mkDelete:     (id,n) => MKTab.doDelete(id, n),
    _mkConfirmDelete: (id) => MKTab.confirmDelete(id),
    // Ruang
    ruangSearch:  (v)    => RuangTab.onSearch(v),
    ruangFilter:  (k, v) => RuangTab.onFilter(k, v),
    ruangPage:    (p)    => RuangTab.goPage(p),
    ruangOpenForm:(id)   => RuangTab.openForm(id),
    ruangDelete:  (id,n) => RuangTab.doDelete(id, n),
    _ruangConfirmDelete: (id) => RuangTab.confirmDelete(id),
  }
})()
