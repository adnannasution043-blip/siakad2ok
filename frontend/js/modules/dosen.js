// ============================================================
// DOSEN.JS — Modul manajemen dosen
// ============================================================
const DosenModule = (() => {

  let state = {
    list: [], meta: null, prodiList: [],
    page: 1, search: '', prodi_id: '', jabatan: '',
  }

  const JABATAN_LIST = [
    'Asisten Ahli', 'Lektor', 'Lektor Kepala', 'Guru Besar', 'Tenaga Pengajar',
  ]
  const PENDIDIKAN_LIST = ['S1', 'S2', 'S3']

  const fetchList = async () => {
    const res = await API.get('/dosen', {
      page: state.page, per_page: 20,
      search: state.search, prodi_id: state.prodi_id, jabatan: state.jabatan,
    })
    state.list = res.data
    state.meta = res.meta
    renderTable()
    renderPagination()
  }

  const fetchProdi = async () => {
    if (state.prodiList.length) return
    const r = await API.get('/master/prodi', { per_page: 100 })
    state.prodiList = r.data || []
  }

  const render = async () => {
    Router.setPageMeta('Dosen', 'Manajemen data dosen')
    await fetchProdi()

    document.getElementById('page-content').innerHTML = `
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div class="flex-1 min-w-48">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input id="dsn-search" type="text" placeholder="Cari nama atau NIDN..."
              value="${state.search}"
              class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              oninput="DosenModule.onSearch(this.value)" />
          </div>
        </div>
        <select onchange="DosenModule.onFilter('prodi_id', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Prodi</option>
          ${state.prodiList.map(p => `<option value="${p.id}" ${state.prodi_id===p.id?'selected':''}>${p.nama} (${p.jenjang})</option>`).join('')}
        </select>
        <select id="dsn-jabatan" onchange="DosenModule.onFilter('jabatan', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Jabatan</option>
          ${JABATAN_LIST.map(j => `<option value="${j}" ${state.jabatan===j?'selected':''}>${j}</option>`).join('')}
        </select>
        <button onclick="DosenModule.openForm()"
          class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Tambah Dosen
        </button>
      </div>
      ${UI.card(`
        <div id="dsn-table-wrap"></div>
        <div id="dsn-pagination"></div>
      `)}
    `
    await fetchList()
  }

  const jabatanBadge = (j) => {
    const map = {
      'Guru Besar':      'bg-yellow-100 text-yellow-700',
      'Lektor Kepala':   'bg-orange-100 text-orange-700',
      'Lektor':          'bg-blue-100 text-blue-700',
      'Asisten Ahli':    'bg-green-100 text-green-700',
      'Tenaga Pengajar': 'bg-slate-100 text-slate-600',
    }
    return `<span class="badge ${map[j] || 'bg-slate-100 text-slate-600'}">${j || '—'}</span>`
  }

  const renderTable = () => {
    document.getElementById('dsn-table-wrap').innerHTML = UI.renderTable({
      headers: ['NIDN', 'Nama Dosen', 'Jabatan Fungsional', 'Bidang Keahlian', 'Kelas', 'Aksi'],
      emptyText: 'Tidak ada data dosen',
      rows: state.list.map(d => `
        <td class="px-4 py-3 font-mono text-xs text-slate-600">${d.nidn}</td>
        <td class="px-4 py-3">
          <div class="font-medium text-slate-800 text-sm">${d.nama_lengkap}</div>
          <div class="text-xs text-slate-400">${d.email || ''}</div>
        </td>
        <td class="px-4 py-3">${jabatanBadge(d.jabatan_fungsional)}</td>
        <td class="px-4 py-3 text-sm text-slate-600">
          <div class="flex flex-wrap gap-1">
            ${(d.bidang_keahlian || []).map(k => `<span class="badge bg-slate-100 text-slate-600">${k}</span>`).join('') || '—'}
          </div>
        </td>
        <td class="px-4 py-3 text-sm text-slate-600 text-center">
          <span class="badge bg-blue-50 text-blue-600">${d.jumlah_kelas} kelas</span>
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-1">
            <button onclick="DosenModule.openDetail('${d.id}')" title="Detail"
              class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary-600 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            </button>
            <button onclick="DosenModule.openForm('${d.id}')" title="Edit"
              class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button onclick="DosenModule.confirmDelete('${d.id}','${d.nama_lengkap}')" title="Hapus"
              class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </td>
      `)
    })
  }

  const renderPagination = () => {
    document.getElementById('dsn-pagination').innerHTML =
      UI.renderPagination(state.meta, 'DosenModule.goPage')
  }

  let searchTimer = null
  const onSearch = (val) => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => { state.search = val; state.page = 1; fetchList() }, 400)
  }
  const onFilter = (key, val) => { state[key] = val; state.page = 1; fetchList() }
  const goPage = (p) => { state.page = p; fetchList() }

  // ── Form Tambah / Edit ─────────────────────────────────────
  const openForm = async (id = null) => {
    await fetchProdi()
    const isEdit = !!id
    let d = null

    if (isEdit) {
      try {
        const res = await API.get(`/dosen/${id}`)
        d = res.data
      } catch (e) { UI.toast(e.message, 'error'); return }
    }

    const currentKeahlian = d?.bidang_keahlian || []

    UI.openModal(`
      <div class="p-5 border-b border-slate-200">
        <h3 class="font-semibold text-slate-800">${isEdit ? 'Edit' : 'Tambah'} Dosen</h3>
      </div>
      <form id="dsn-form" class="p-5 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          ${UI.input('nidn', 'NIDN', 'text', d?.nidn || '', '0123456789', !isEdit)}
          ${UI.select('pendidikan_terakhir', 'Pendidikan Terakhir', PENDIDIKAN_LIST.map(p=>({value:p,label:p})), d?.pendidikan_terakhir || 'S2', true)}
        </div>
        ${UI.input('nama_lengkap', 'Nama Lengkap', 'text', d?.nama_lengkap || '', 'Dr. Nama Dosen, M.Kom', true)}
        ${!isEdit ? UI.input('email', 'Email', 'email', '', 'dosen@kampus.ac.id', true) : ''}
        ${!isEdit ? UI.input('password', 'Password', 'password', '', 'Min. 8 karakter', true) : ''}
        ${UI.select('prodi_id', 'Program Studi', state.prodiList.map(p=>({value:p.id,label:`${p.nama} (${p.jenjang})`})), d?.prodi_id || '', true)}
        <div class="grid grid-cols-2 gap-4">
          ${UI.select('jabatan_fungsional', 'Jabatan Fungsional', JABATAN_LIST.map(j=>({value:j,label:j})), d?.jabatan_fungsional || 'Tenaga Pengajar', true)}
          ${UI.input('max_sks_mengajar', 'Maks SKS Mengajar', 'number', d?.max_sks_mengajar || 12, '12', true)}
        </div>
        ${UI.input('no_hp', 'No. HP', 'tel', d?.no_hp || '', '08xx-xxxx-xxxx')}
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Bidang Keahlian</label>
          <input type="text" id="dsn-keahlian-input" placeholder="Ketik keahlian, tekan Enter atau koma"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2" />
          <div id="dsn-keahlian-tags" class="flex flex-wrap gap-1 min-h-8">
            ${currentKeahlian.map(k => keahlianTag(k)).join('')}
          </div>
          <input type="hidden" id="dsn-keahlian-data" value="${currentKeahlian.join(',')}" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Batal</button>
          <button type="submit" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg">
            ${isEdit ? 'Simpan Perubahan' : 'Tambah Dosen'}
          </button>
        </div>
      </form>
    `)

    initKeahlianInput()

    document.getElementById('dsn-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const body = Object.fromEntries(fd.entries())
      body.max_sks_mengajar = parseInt(body.max_sks_mengajar)
      const keahlianRaw = document.getElementById('dsn-keahlian-data').value
      body.bidang_keahlian = keahlianRaw ? keahlianRaw.split(',').map(k => k.trim()).filter(Boolean) : []

      const btn = e.target.querySelector('button[type=submit]')
      btn.disabled = true; btn.textContent = 'Menyimpan...'
      try {
        if (isEdit) {
          await API.put(`/dosen/${id}`, body)
          UI.toast('Data dosen berhasil diperbarui')
        } else {
          await API.post('/dosen', body)
          UI.toast('Dosen berhasil ditambahkan')
        }
        UI.closeModal()
        await fetchList()
      } catch (err) {
        UI.toast(err.message || 'Gagal menyimpan', 'error')
        btn.disabled = false
        btn.textContent = isEdit ? 'Simpan Perubahan' : 'Tambah Dosen'
      }
    })
  }

  const keahlianTag = (k) =>
    `<span class="badge bg-slate-100 text-slate-700 gap-1 cursor-default">
      ${k}
      <button type="button" onclick="DosenModule._removeKeahlian('${k}')" class="ml-1 text-slate-400 hover:text-red-500 font-bold leading-none">&times;</button>
    </span>`

  const initKeahlianInput = () => {
    const inp = document.getElementById('dsn-keahlian-input')
    if (!inp) return
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()
        _addKeahlian(inp.value.trim())
        inp.value = ''
      }
    })
  }

  const _addKeahlian = (val) => {
    if (!val) return
    const dataEl = document.getElementById('dsn-keahlian-data')
    const tagsEl = document.getElementById('dsn-keahlian-tags')
    const current = dataEl.value ? dataEl.value.split(',').map(k => k.trim()).filter(Boolean) : []
    if (current.includes(val)) return
    current.push(val)
    dataEl.value = current.join(',')
    tagsEl.innerHTML = current.map(k => keahlianTag(k)).join('')
  }

  const _removeKeahlian = (val) => {
    const dataEl = document.getElementById('dsn-keahlian-data')
    const tagsEl = document.getElementById('dsn-keahlian-tags')
    const current = dataEl.value ? dataEl.value.split(',').map(k => k.trim()).filter(Boolean) : []
    const updated = current.filter(k => k !== val)
    dataEl.value = updated.join(',')
    tagsEl.innerHTML = updated.map(k => keahlianTag(k)).join('')
  }

  // ── Detail ─────────────────────────────────────────────────
  const openDetail = async (id) => {
    try {
      const res = await API.get(`/dosen/${id}`)
      const d = res.data
      UI.openModal(`
        <div class="p-5 border-b border-slate-200 flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-lg">
            ${d.nama_lengkap.charAt(0)}
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-slate-800">${d.nama_lengkap}</h3>
            <p class="text-sm text-slate-500">NIDN: ${d.nidn}</p>
          </div>
          <div>${jabatanBadge(d.jabatan_fungsional)}</div>
        </div>
        <div class="p-5 space-y-4">
          <div class="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-lg text-center">
            <div>
              <p class="text-xl font-bold text-primary-600">${d.jumlah_kelas}</p>
              <p class="text-xs text-slate-500">Kelas Aktif</p>
            </div>
            <div>
              <p class="text-xl font-bold text-slate-800">${d.max_sks_mengajar || '—'}</p>
              <p class="text-xs text-slate-500">Maks SKS</p>
            </div>
            <div>
              <p class="text-xl font-bold text-slate-800">${d.pendidikan_terakhir || '—'}</p>
              <p class="text-xs text-slate-500">Pendidikan</p>
            </div>
          </div>
          <table class="w-full text-sm">
            ${dRow('Email', d.email || '—')}
            ${dRow('No. HP', d.no_hp || '—')}
            ${dRow('Program Studi', d.program_studi?.nama || '—')}
            ${dRow('Bidang Keahlian', (d.bidang_keahlian || []).join(', ') || '—')}
          </table>
          <div class="flex justify-end gap-2">
            <button onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Tutup</button>
            <button onclick="UI.closeModal(); DosenModule.openForm('${d.id}')"
              class="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">Edit</button>
          </div>
        </div>
      `)
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const dRow = (label, value) => `
    <tr class="border-b border-slate-100">
      <td class="py-2 pr-4 text-slate-500 font-medium w-40">${label}</td>
      <td class="py-2 text-slate-800">${value}</td>
    </tr>`

  // ── Delete ─────────────────────────────────────────────────
  const confirmDelete = (id, nama) => {
    UI.openModal(`
      <div class="p-6 text-center">
        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3 class="font-semibold text-slate-800 mb-1">Hapus Dosen?</h3>
        <p class="text-sm text-slate-500 mb-6"><strong>${nama}</strong> akan dihapus dari sistem.</p>
        <div class="flex justify-center gap-3">
          <button onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Batal</button>
          <button onclick="DosenModule.doDelete('${id}')" class="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Ya, Hapus</button>
        </div>
      </div>
    `)
  }

  const doDelete = async (id) => {
    try {
      await API.delete(`/dosen/${id}`)
      UI.closeModal()
      UI.toast('Dosen berhasil dihapus')
      await fetchList()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  return { render, onSearch, onFilter, goPage, openForm, openDetail, confirmDelete, doDelete, _addKeahlian, _removeKeahlian }
})()
