// ============================================================
// MAHASISWA.JS — Modul manajemen mahasiswa
// State, render, CRUD semua di sini
// ============================================================
const MahasiswaModule = (() => {

  // ── State ──────────────────────────────────────────────
  let state = {
    list: [], meta: null, prodiList: [],
    page: 1, search: '', status: '', prodi_id: '',
    loading: false,
  }

  // ── Fetch Data ─────────────────────────────────────────
  const fetchList = async () => {
    state.loading = true
    const res = await API.get('/mahasiswa', {
      page: state.page, per_page: 20,
      search: state.search, status: state.status, prodi_id: state.prodi_id,
    })
    state.list = res.data
    state.meta = res.meta
    state.loading = false
    renderTable()
    renderPagination()
  }

  const fetchProdi = async () => {
    if (state.prodiList.length) return
    const res = await API.get('/mahasiswa/prodi')
    state.prodiList = res.data || []
  }

  // ── Render Utama ───────────────────────────────────────
  const render = async () => {
    Router.setPageMeta('Mahasiswa', 'Manajemen data mahasiswa')
    await fetchProdi()

    document.getElementById('page-content').innerHTML = `
      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div class="flex-1 min-w-48">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input id="mhs-search" type="text" placeholder="Cari nama atau NIM..."
              value="${state.search}"
              class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              oninput="MahasiswaModule.onSearch(this.value)" />
          </div>
        </div>
        <select id="mhs-status" onchange="MahasiswaModule.onFilter('status', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Status</option>
          <option value="aktif" ${state.status==='aktif'?'selected':''}>Aktif</option>
          <option value="cuti" ${state.status==='cuti'?'selected':''}>Cuti</option>
          <option value="non_aktif" ${state.status==='non_aktif'?'selected':''}>Non Aktif</option>
          <option value="DO" ${state.status==='DO'?'selected':''}>DO</option>
          <option value="lulus" ${state.status==='lulus'?'selected':''}>Lulus</option>
        </select>
        <select id="mhs-prodi" onchange="MahasiswaModule.onFilter('prodi_id', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Prodi</option>
          ${state.prodiList.map(p => `<option value="${p.id}" ${state.prodi_id===p.id?'selected':''}>${p.nama} (${p.jenjang})</option>`).join('')}
        </select>
        <button onclick="MahasiswaModule.openForm()"
          class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Tambah Mahasiswa
        </button>
      </div>

      <!-- Table card -->
      ${UI.card(`
        <div id="mhs-table-wrap"></div>
        <div id="mhs-pagination"></div>
      `)}
    `
    await fetchList()
  }

  const renderTable = () => {
    document.getElementById('mhs-table-wrap').innerHTML = UI.renderTable({
      headers: ['NIM', 'Nama Lengkap', 'Program Studi', 'Angkatan', 'Sem.', 'IPK', 'Status', 'Aksi'],
      emptyText: 'Tidak ada data mahasiswa',
      rows: state.list.map(m => `
        <td class="px-4 py-3 font-mono text-xs text-slate-600">${m.nim}</td>
        <td class="px-4 py-3">
          <div class="font-medium text-slate-800 text-sm">${m.nama_lengkap}</div>
          <div class="text-xs text-slate-400">${m.email || ''}</div>
        </td>
        <td class="px-4 py-3 text-sm text-slate-600">${m.program_studi?.nama || '—'}</td>
        <td class="px-4 py-3 text-sm text-slate-600 text-center">${m.angkatan}</td>
        <td class="px-4 py-3 text-sm text-slate-600 text-center">${m.semester_aktif}</td>
        <td class="px-4 py-3 text-sm font-medium text-slate-800 text-center">${Number(m.ipk).toFixed(2)}</td>
        <td class="px-4 py-3">${UI.statusBadge(m.status)}</td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-1">
            <button onclick="MahasiswaModule.openDetail('${m.id}')" title="Detail"
              class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary-600 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            </button>
            <button onclick="MahasiswaModule.openForm('${m.id}')" title="Edit"
              class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button onclick="MahasiswaModule.confirmDelete('${m.id}', '${m.nama_lengkap}')" title="Hapus"
              class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </td>
      `)
    })
  }

  const renderPagination = () => {
    document.getElementById('mhs-pagination').innerHTML = UI.renderPagination(
      state.meta,
      'MahasiswaModule.goPage'
    )
  }

  // ── Event handlers ─────────────────────────────────────
  let searchTimer = null
  const onSearch = (val) => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      state.search = val; state.page = 1; fetchList()
    }, 400)
  }

  const onFilter = (key, val) => {
    state[key] = val; state.page = 1; fetchList()
  }

  const goPage = (p) => { state.page = p; fetchList() }

  // ── Form Tambah / Edit ─────────────────────────────────
  const openForm = async (id = null) => {
    await fetchProdi()
    const isEdit = !!id
    let mhs = null

    if (isEdit) {
      try {
        const res = await API.get(`/mahasiswa/${id}`)
        mhs = res.data
      } catch (e) { UI.toast(e.message, 'error'); return }
    }

    UI.openModal(`
      <div class="p-5 border-b border-slate-200">
        <h3 class="font-semibold text-slate-800">${isEdit ? 'Edit' : 'Tambah'} Mahasiswa</h3>
      </div>
      <form id="mhs-form" class="p-5 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          ${UI.input('nim', 'NIM', 'text', mhs?.nim || '', '2024001001', !isEdit)}
          ${UI.input('angkatan', 'Angkatan', 'number', mhs?.angkatan || new Date().getFullYear(), '2024', !isEdit)}
        </div>
        ${UI.input('nama_lengkap', 'Nama Lengkap', 'text', mhs?.nama_lengkap || '', 'Nama mahasiswa', true)}
        ${!isEdit ? UI.input('email', 'Email', 'email', '', 'email@mahasiswa.ac.id', true) : ''}
        ${!isEdit ? UI.input('password', 'Password', 'password', '', 'Min. 8 karakter', true) : ''}
        ${UI.select('program_studi_id', 'Program Studi', state.prodiList.map(p => ({value: p.id, label: `${p.nama} (${p.jenjang})`})), mhs?.program_studi?.id || '', true)}
        ${UI.select('jenis_kelamin', 'Jenis Kelamin', [{value:'L',label:'Laki-laki'},{value:'P',label:'Perempuan'}], mhs?.jenis_kelamin || '')}
        <div class="grid grid-cols-2 gap-4">
          ${UI.input('tempat_lahir', 'Tempat Lahir', 'text', mhs?.tempat_lahir || '', 'Kota lahir')}
          ${UI.input('tanggal_lahir', 'Tanggal Lahir', 'date', mhs?.tanggal_lahir || '')}
        </div>
        ${UI.input('no_hp', 'No. HP', 'tel', mhs?.no_hp || '', '08xx-xxxx-xxxx')}
        ${UI.input('no_hp_ortu', 'No. HP Orang Tua', 'tel', mhs?.no_hp_ortu || '', '08xx-xxxx-xxxx')}
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Alamat</label>
          <textarea name="alamat" rows="2" placeholder="Alamat lengkap"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">${mhs?.alamat || ''}</textarea>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="UI.closeModal()"
            class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Batal</button>
          <button type="submit"
            class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors">
            ${isEdit ? 'Simpan Perubahan' : 'Tambah Mahasiswa'}
          </button>
        </div>
      </form>
    `)

    document.getElementById('mhs-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(e.target)
      const body = Object.fromEntries(fd.entries())
      if (body.angkatan) body.angkatan = parseInt(body.angkatan)

      const btn = e.target.querySelector('button[type=submit]')
      btn.disabled = true; btn.textContent = 'Menyimpan...'

      try {
        if (isEdit) {
          await API.put(`/mahasiswa/${id}`, body)
          UI.toast('Data mahasiswa berhasil diperbarui')
        } else {
          await API.post('/mahasiswa', body)
          UI.toast('Mahasiswa berhasil ditambahkan')
        }
        UI.closeModal()
        await fetchList()
      } catch (err) {
        UI.toast(err.message || 'Gagal menyimpan', 'error')
        btn.disabled = false
        btn.textContent = isEdit ? 'Simpan Perubahan' : 'Tambah Mahasiswa'
      }
    })
  }

  // ── Detail ─────────────────────────────────────────────
  const openDetail = async (id) => {
    try {
      const res = await API.get(`/mahasiswa/${id}`)
      const m = res.data
      UI.openModal(`
        <div class="p-5 border-b border-slate-200 flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg">
            ${m.nama_lengkap.charAt(0)}
          </div>
          <div>
            <h3 class="font-semibold text-slate-800">${m.nama_lengkap}</h3>
            <p class="text-sm text-slate-500">${m.nim} · ${m.program_studi?.nama || ''}</p>
          </div>
          <div class="ml-auto">${UI.statusBadge(m.status)}</div>
        </div>
        <div class="p-5 space-y-4">
          <div class="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
            <div class="text-center">
              <p class="text-2xl font-bold text-primary-600">${Number(m.ipk).toFixed(2)}</p>
              <p class="text-xs text-slate-500">IPK</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-slate-800">${m.total_sks_lulus}</p>
              <p class="text-xs text-slate-500">SKS Lulus</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold text-slate-800">${m.semester_aktif}</p>
              <p class="text-xs text-slate-500">Semester</p>
            </div>
          </div>
          <table class="w-full text-sm">
            ${row('Email', m.email || '—')}
            ${row('No. HP', m.no_hp || '—')}
            ${row('No. HP Orang Tua', m.no_hp_ortu || '—')}
            ${row('Jenis Kelamin', m.jenis_kelamin === 'L' ? 'Laki-laki' : m.jenis_kelamin === 'P' ? 'Perempuan' : '—')}
            ${row('Tempat, Tgl Lahir', m.tempat_lahir && m.tanggal_lahir ? `${m.tempat_lahir}, ${m.tanggal_lahir}` : '—')}
            ${row('Angkatan', m.angkatan)}
            ${row('Alamat', m.alamat || '—')}
          </table>
          <div class="flex justify-end gap-2">
            <button onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Tutup</button>
            <button onclick="UI.closeModal(); MahasiswaModule.openForm('${m.id}')"
              class="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">Edit</button>
          </div>
        </div>
      `)
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const row = (label, value) => `
    <tr class="border-b border-slate-100">
      <td class="py-2 pr-4 text-slate-500 font-medium w-40">${label}</td>
      <td class="py-2 text-slate-800">${value}</td>
    </tr>`

  // ── Delete ─────────────────────────────────────────────
  const confirmDelete = (id, nama) => {
    UI.openModal(`
      <div class="p-6 text-center">
        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3 class="font-semibold text-slate-800 mb-1">Hapus Mahasiswa?</h3>
        <p class="text-sm text-slate-500 mb-6"><strong>${nama}</strong> akan dihapus dari sistem.</p>
        <div class="flex justify-center gap-3">
          <button onclick="UI.closeModal()" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Batal</button>
          <button onclick="MahasiswaModule.doDelete('${id}')" class="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Ya, Hapus</button>
        </div>
      </div>
    `)
  }

  const doDelete = async (id) => {
    try {
      await API.delete(`/mahasiswa/${id}`)
      UI.closeModal()
      UI.toast('Mahasiswa berhasil dihapus')
      await fetchList()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  return { render, onSearch, onFilter, goPage, openForm, openDetail, confirmDelete, doDelete }
})()
