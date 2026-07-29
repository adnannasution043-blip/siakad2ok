// Modul Kepegawaian
const KepegawaianModule = (() => {

  let _filterStatus = ''
  let _search = ''
  let _page   = 1

  const statusBadge = (s) => {
    const map = { tetap:'bg-green-100 text-green-700', kontrak:'bg-yellow-100 text-yellow-700', honorer:'bg-gray-100 text-gray-600' }
    const lbl = { tetap:'Tetap', kontrak:'Kontrak', honorer:'Honorer' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${lbl[s]||s}</span>`
  }

  const fmt = (n) => n ? new Intl.NumberFormat('id-ID').format(n) : '-'
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '-'

  const loadStats = async () => {
    try {
      const res = await API.get('/kepegawaian/stats')
      const d = res.data || {}
      document.getElementById('peg-stat-total').textContent    = d.total_pegawai ?? 0
      document.getElementById('peg-stat-tetap').textContent    = d.tetap ?? 0
      document.getElementById('peg-stat-kontrak').textContent  = d.kontrak ?? 0
      document.getElementById('peg-stat-honorer').textContent  = d.honorer ?? 0
      document.getElementById('peg-stat-unit').textContent     = d.unit_kerja ?? 0
      document.getElementById('peg-stat-gaji').textContent     = 'Rp ' + fmt(d.total_gaji)
    } catch (_) {}
  }

  const loadPegawai = async () => {
    const tbody = document.getElementById('peg-tbody')
    if (!tbody) return
    tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>'
    try {
      const params = new URLSearchParams({ page: _page, per_page: 15, search: _search })
      if (_filterStatus) params.append('status_kepegawaian', _filterStatus)
      const res = await API.get('/kepegawaian/pegawai?' + params)
      const items = res.data || []
      const meta  = res.meta || {}
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">Tidak ada data pegawai</td></tr>'
        document.getElementById('peg-info').textContent  = ''
        document.getElementById('peg-pager').innerHTML   = ''
        return
      }
      tbody.innerHTML = items.map(p => `
        <tr class="table-row-hover">
          <td class="px-4 py-3 text-xs font-mono text-gray-500">${p.nip||'-'}</td>
          <td class="px-4 py-3">
            <div class="font-medium text-gray-800 text-sm">${p.nama}</div>
            <div class="text-xs text-gray-500 mt-0.5">${p.email||'-'}</div>
          </td>
          <td class="px-4 py-3 text-sm text-gray-700">${p.jabatan||'-'}</td>
          <td class="px-4 py-3 text-sm text-gray-600">${p.unit_kerja||'-'}</td>
          <td class="px-4 py-3 text-sm text-gray-600">${p.pendidikan_terakhir||'-'}</td>
          <td class="px-4 py-3">${statusBadge(p.status_kepegawaian)}</td>
          <td class="px-4 py-3 text-right">
            <button onclick="KepegawaianModule.detail('${p.id}')" class="text-xs text-blue-600 hover:underline mr-1">Detail</button>
            <button onclick="KepegawaianModule.edit('${p.id}')" class="text-xs text-indigo-600 hover:underline mr-1">Edit</button>
            <button onclick="KepegawaianModule.hapus('${p.id}')" class="text-xs text-red-500 hover:underline mr-1">Hapus</button>
          </td>
        </tr>
      `).join('')
      document.getElementById('peg-info').textContent =
        `Menampilkan ${items.length} dari ${meta.total || items.length} data`
      renderPager(meta, (pg) => { _page = pg; loadPegawai() })
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-red-400">${e.message}</td></tr>`
    }
  }

  const renderPager = (meta, cb) => {
    const el = document.getElementById('peg-pager')
    if (!el || !meta || meta.total_pages <= 1) { if(el) el.innerHTML=''; return }
    const cur = meta.page, tot = meta.total_pages
    let html = '<div class="flex gap-1">'
    if (cur > 1) html += `<button onclick="(${cb})(${cur-1})" class="px-2 py-1 text-xs border rounded hover:bg-gray-50">‹</button>`
    for (let i = Math.max(1,cur-2); i <= Math.min(tot,cur+2); i++)
      html += `<button onclick="(${cb})(${i})" class="px-2 py-1 text-xs border rounded ${i===cur?'bg-primary-600 text-white border-primary-600':'hover:bg-gray-50'}">${i}</button>`
    if (cur < tot) html += `<button onclick="(${cb})(${cur+1})" class="px-2 py-1 text-xs border rounded hover:bg-gray-50">›</button>`
    el.innerHTML = html + '</div>'
  }

  const render = () => {
    const el = document.getElementById('page-content')
    Router.setPageMeta('Kepegawaian', 'Manajemen data pegawai dan tenaga kependidikan')
    if (!el) return
    el.innerHTML = `
      <div class="p-6 space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold text-gray-800">Kepegawaian</h1>
            <p class="text-sm text-gray-500">Data tenaga kependidikan & staf administrasi</p>
          </div>
          <button onclick="KepegawaianModule.openForm()" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">+ Tambah Pegawai</button>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          ${[
            ['peg-stat-total',   'Total Pegawai',  'text-blue-600'],
            ['peg-stat-tetap',   'PNS / Tetap',    'text-green-600'],
            ['peg-stat-kontrak', 'Kontrak',         'text-yellow-600'],
            ['peg-stat-honorer', 'Honorer',         'text-gray-600'],
            ['peg-stat-unit',    'Unit Kerja',      'text-indigo-600'],
            ['peg-stat-gaji',    'Total Gaji+Tunj', 'text-purple-600'],
          ].map(([id,lbl,cls]) => `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p class="text-xs text-gray-500">${lbl}</p>
              <p id="${id}" class="text-xl font-bold ${cls} mt-1">-</p>
            </div>`).join('')}
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="p-4 flex flex-wrap gap-2 border-b border-gray-100">
            <input type="text" placeholder="Cari NIP, nama, jabatan, unit kerja…" value="${_search}"
              oninput="KepegawaianModule.onSearch(this.value)"
              class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
            <select onchange="KepegawaianModule.onFilter(this.value)" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="">Semua Status</option>
              <option value="tetap" ${_filterStatus==='tetap'?'selected':''}>PNS / Tetap</option>
              <option value="kontrak" ${_filterStatus==='kontrak'?'selected':''}>Kontrak</option>
              <option value="honorer" ${_filterStatus==='honorer'?'selected':''}>Honorer</option>
            </select>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th class="px-4 py-3">NIP</th>
                  <th class="px-4 py-3">Nama / Email</th>
                  <th class="px-4 py-3">Jabatan</th>
                  <th class="px-4 py-3">Unit Kerja</th>
                  <th class="px-4 py-3">Pendidikan</th>
                  <th class="px-4 py-3">Status</th>
                  <th class="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody id="peg-tbody" class="divide-y divide-gray-50"></tbody>
            </table>
          </div>
          <div class="px-4 py-3 flex items-center justify-between text-xs text-gray-500 border-t border-gray-100">
            <span id="peg-info"></span>
            <div id="peg-pager"></div>
          </div>
        </div>
      </div>

      <!-- Modal -->
      <div id="peg-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40" onclick="KepegawaianModule.closeModal()"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div class="p-6">
            <h2 id="peg-modal-title" class="text-lg font-semibold text-gray-800 mb-4">Pegawai</h2>
            <div id="peg-modal-body"></div>
          </div>
        </div>
      </div>
    `
    loadStats()
    loadPegawai()
  }

  const openModal = (title, html) => {
    document.getElementById('peg-modal-title').textContent = title
    document.getElementById('peg-modal-body').innerHTML = html
    document.getElementById('peg-modal').classList.remove('hidden')
  }
  const closeModal = () => document.getElementById('peg-modal').classList.add('hidden')

  const onSearch = (v) => { _search = v; _page = 1; loadPegawai() }
  const onFilter = (v) => { _filterStatus = v; _page = 1; loadPegawai() }

  const formHtml = (p = {}) => `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">NIP *</label>
          <input id="pf-nip" type="text" value="${p.nip||''}" placeholder="18 digit NIP"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Status Kepegawaian</label>
          <select id="pf-status" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
            <option value="tetap" ${p.status_kepegawaian==='tetap'?'selected':''}>PNS / Tetap</option>
            <option value="kontrak" ${p.status_kepegawaian==='kontrak'?'selected':''}>Kontrak</option>
            <option value="honorer" ${p.status_kepegawaian==='honorer'?'selected':''}>Honorer</option>
          </select>
        </div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Nama Lengkap *</label>
        <input id="pf-nama" type="text" value="${p.nama||''}" placeholder="Nama lengkap dengan gelar"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Jabatan</label>
          <input id="pf-jabatan" type="text" value="${p.jabatan||''}" placeholder="Jabatan / posisi"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Unit Kerja</label>
          <input id="pf-unit" type="text" value="${p.unit_kerja||''}" placeholder="Nama biro / UPT"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Pendidikan Terakhir</label>
          <select id="pf-pendidikan" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
            ${['SMA','D3','D4','S1','S2','S3'].map(d=>`<option value="${d}" ${p.pendidikan_terakhir===d?'selected':''}>${d}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Tgl Masuk</label>
          <input id="pf-masuk" type="date" value="${p.tgl_masuk||''}"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Gaji Pokok (Rp)</label>
          <input id="pf-gaji" type="number" value="${p.gaji_pokok||''}" placeholder="0"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Tunjangan (Rp)</label>
          <input id="pf-tunjangan" type="number" value="${p.tunjangan||''}" placeholder="0"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Email</label>
          <input id="pf-email" type="email" value="${p.email||''}" placeholder="email@kampus.ac.id"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">No. Telepon</label>
          <input id="pf-telp" type="text" value="${p.no_telp||''}" placeholder="08xx"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button onclick="KepegawaianModule.closeModal()" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
        <button onclick="KepegawaianModule.saveForm('${p.id||''}')" class="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Simpan</button>
      </div>
    </div>
  `

  const openForm = () => openModal('Tambah Pegawai', formHtml())

  const edit = async (id) => {
    try {
      const res = await API.get('/kepegawaian/pegawai/' + id)
      openModal('Edit Pegawai', formHtml(res.data || {}))
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const saveForm = async (id) => {
    const nip    = document.getElementById('pf-nip')?.value?.trim()
    const nama   = document.getElementById('pf-nama')?.value?.trim()
    const status = document.getElementById('pf-status')?.value
    const jabatan= document.getElementById('pf-jabatan')?.value?.trim()
    const unit   = document.getElementById('pf-unit')?.value?.trim()
    const pend   = document.getElementById('pf-pendidikan')?.value
    const masuk  = document.getElementById('pf-masuk')?.value
    const gaji   = parseInt(document.getElementById('pf-gaji')?.value) || 0
    const tunj   = parseInt(document.getElementById('pf-tunjangan')?.value) || 0
    const email  = document.getElementById('pf-email')?.value?.trim()
    const telp   = document.getElementById('pf-telp')?.value?.trim()
    if (!nip || !nama) return UI.toast('NIP dan nama wajib diisi', 'error')
    try {
      const body = { nip, nama, status_kepegawaian: status, jabatan, unit_kerja: unit, pendidikan_terakhir: pend, tgl_masuk: masuk, gaji_pokok: gaji, tunjangan: tunj, email, no_telp: telp }
      if (id) { await API.put('/kepegawaian/pegawai/' + id, body) } else { await API.post('/kepegawaian/pegawai', body) }
      closeModal(); UI.toast('Data pegawai berhasil disimpan', 'success')
      loadStats(); loadPegawai()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const detail = async (id) => {
    try {
      const res = await API.get('/kepegawaian/pegawai/' + id)
      const p = res.data || {}
      openModal('Detail Pegawai', `
        <div class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-2">
            <div><span class="text-gray-500 text-xs">NIP</span><br><b class="font-mono text-xs">${p.nip||'-'}</b></div>
            <div><span class="text-gray-500 text-xs">Status</span><br>${statusBadge(p.status_kepegawaian)}</div>
            <div><span class="text-gray-500 text-xs">Jabatan</span><br><b>${p.jabatan||'-'}</b></div>
            <div><span class="text-gray-500 text-xs">Unit Kerja</span><br>${p.unit_kerja||'-'}</div>
            <div><span class="text-gray-500 text-xs">Pendidikan</span><br>${p.pendidikan_terakhir||'-'}</div>
            <div><span class="text-gray-500 text-xs">Tgl Masuk</span><br>${fmtDate(p.tgl_masuk)}</div>
            <div><span class="text-gray-500 text-xs">Gaji Pokok</span><br>Rp ${fmt(p.gaji_pokok)}</div>
            <div><span class="text-gray-500 text-xs">Tunjangan</span><br>Rp ${fmt(p.tunjangan)}</div>
            <div><span class="text-gray-500 text-xs">Email</span><br>${p.email||'-'}</div>
            <div><span class="text-gray-500 text-xs">Telepon</span><br>${p.no_telp||'-'}</div>
          </div>
          <div class="border-t pt-3 flex justify-end">
            <button onclick="KepegawaianModule.closeModal()" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Tutup</button>
          </div>
        </div>
      `)
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const hapus = async (id) => {
    if (!confirm('Hapus data pegawai ini?')) return
    try {
      await API.delete('/kepegawaian/pegawai/' + id)
      UI.toast('Data pegawai dihapus', 'success'); loadStats(); loadPegawai()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  return { render, onSearch, onFilter, openForm, edit, saveForm, detail, hapus, closeModal }
})()
