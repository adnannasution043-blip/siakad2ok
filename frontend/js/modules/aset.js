// Modul Aset & Inventaris
const AsetModule = (() => {

  let _filterKategori = ''
  let _filterKondisi  = ''
  let _filterStatus   = ''
  let _search = ''
  let _page   = 1

  // ── Badge helpers ────────────────────────────────────────────────────────
  const kondisiBadge = (k) => {
    const map = { baik:'bg-green-100 text-green-700', rusak_ringan:'bg-yellow-100 text-yellow-700', rusak_berat:'bg-red-100 text-red-700' }
    const lbl = { baik:'Baik', rusak_ringan:'Rusak Ringan', rusak_berat:'Rusak Berat' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[k]||'bg-gray-100 text-gray-600'}">${lbl[k]||k}</span>`
  }

  const statusBadge = (s) => {
    const map = { aktif:'bg-blue-100 text-blue-700', dalam_perbaikan:'bg-orange-100 text-orange-700', dihapuskan:'bg-gray-100 text-gray-500' }
    const lbl = { aktif:'Aktif', dalam_perbaikan:'Perbaikan', dihapuskan:'Dihapuskan' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${lbl[s]||s}</span>`
  }

  const kategoriBadge = (k) => {
    const map = { tanah:'bg-amber-100 text-amber-700', bangunan:'bg-stone-100 text-stone-700', kendaraan:'bg-blue-100 text-blue-700', peralatan:'bg-purple-100 text-purple-700', elektronik:'bg-cyan-100 text-cyan-700', furniture:'bg-teal-100 text-teal-700', lainnya:'bg-gray-100 text-gray-600' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[k]||'bg-gray-100 text-gray-600'}">${k||'-'}</span>`
  }

  const fmt = (n) => n ? 'Rp ' + new Intl.NumberFormat('id-ID').format(n) : '-'

  // ── Stats ────────────────────────────────────────────────────────────────
  const loadStats = async () => {
    try {
      const res = await API.get('/aset/stats')
      const d = res.data || {}
      document.getElementById('aset-stat-total').textContent   = d.total_aset ?? 0
      document.getElementById('aset-stat-baik').textContent    = d.kondisi_baik ?? 0
      document.getElementById('aset-stat-rusak').textContent   = d.kondisi_rusak ?? 0
      document.getElementById('aset-stat-perbaikan').textContent = d.dalam_perbaikan ?? 0
      document.getElementById('aset-stat-unit').textContent    = d.total_unit ?? 0
      document.getElementById('aset-stat-nilai').textContent   = fmt(d.total_nilai)
    } catch (_) {}
  }

  // ── List ─────────────────────────────────────────────────────────────────
  const loadAset = async () => {
    const tbody = document.getElementById('aset-tbody')
    if (!tbody) return
    tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>'
    try {
      const params = new URLSearchParams({ page: _page, per_page: 15, search: _search })
      if (_filterKategori) params.append('kategori', _filterKategori)
      if (_filterKondisi)  params.append('kondisi', _filterKondisi)
      if (_filterStatus)   params.append('status', _filterStatus)
      const res = await API.get('/aset?' + params)
      const items = res.data || []
      const meta  = res.meta || {}
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">Tidak ada data aset</td></tr>'
        document.getElementById('aset-info').textContent  = ''
        document.getElementById('aset-pager').innerHTML   = ''
        return
      }
      tbody.innerHTML = items.map(a => `
        <tr class="table-row-hover">
          <td class="px-4 py-3 text-xs font-mono text-gray-500">${a.kode_aset||'-'}</td>
          <td class="px-4 py-3">
            <div class="font-medium text-gray-800 text-sm">${a.nama}</div>
            <div class="text-xs text-gray-500 mt-0.5">${a.lokasi||'-'}</div>
          </td>
          <td class="px-4 py-3">${kategoriBadge(a.kategori)}</td>
          <td class="px-4 py-3 text-sm text-gray-600 text-center">${a.jumlah||1} ${a.satuan||'unit'}</td>
          <td class="px-4 py-3 text-sm text-gray-700">${fmt(a.harga_perolehan)}</td>
          <td class="px-4 py-3 text-sm text-gray-500">${a.tahun_perolehan||'-'}</td>
          <td class="px-4 py-3">${kondisiBadge(a.kondisi)} ${statusBadge(a.status)}</td>
          <td class="px-4 py-3 text-right">
            <button onclick="AsetModule.edit('${a.id}')" class="text-xs text-indigo-600 hover:underline mr-1">Edit</button>
            <button onclick="AsetModule.updateKondisi('${a.id}','${a.kondisi}','${a.status}')" class="text-xs text-yellow-600 hover:underline mr-1">Kondisi</button>
            <button onclick="AsetModule.hapus('${a.id}')" class="text-xs text-red-500 hover:underline mr-1">Hapus</button>
          </td>
        </tr>
      `).join('')
      document.getElementById('aset-info').textContent =
        `Menampilkan ${items.length} dari ${meta.total || items.length} data`
      renderPager(meta, (pg) => { _page = pg; loadAset() })
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-red-400">${e.message}</td></tr>`
    }
  }

  const renderPager = (meta, cb) => {
    const el = document.getElementById('aset-pager')
    if (!el || !meta || meta.total_pages <= 1) { if(el) el.innerHTML=''; return }
    const cur = meta.page, tot = meta.total_pages
    let html = '<div class="flex gap-1">'
    if (cur > 1) html += `<button onclick="(${cb})(${cur-1})" class="px-2 py-1 text-xs border rounded hover:bg-gray-50">‹</button>`
    for (let i = Math.max(1,cur-2); i <= Math.min(tot,cur+2); i++)
      html += `<button onclick="(${cb})(${i})" class="px-2 py-1 text-xs border rounded ${i===cur?'bg-primary-600 text-white border-primary-600':'hover:bg-gray-50'}">${i}</button>`
    if (cur < tot) html += `<button onclick="(${cb})(${cur+1})" class="px-2 py-1 text-xs border rounded hover:bg-gray-50">›</button>`
    el.innerHTML = html + '</div>'
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const render = () => {
    const el = document.getElementById('page-content')
    if (!el) return
    el.innerHTML = `
      <div class="p-6 space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold text-gray-800">Aset & Inventaris</h1>
            <p class="text-sm text-gray-500">Manajemen barang milik institusi</p>
          </div>
          <button onclick="AsetModule.openForm()" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">+ Tambah Aset</button>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          ${[
            ['aset-stat-total',    'Total Jenis Aset', 'text-blue-600'],
            ['aset-stat-baik',     'Kondisi Baik',     'text-green-600'],
            ['aset-stat-rusak',    'Kondisi Rusak',    'text-red-600'],
            ['aset-stat-perbaikan','Dalam Perbaikan',  'text-orange-600'],
            ['aset-stat-unit',     'Total Unit',       'text-indigo-600'],
            ['aset-stat-nilai',    'Total Nilai',      'text-purple-600'],
          ].map(([id,lbl,cls]) => `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p class="text-xs text-gray-500">${lbl}</p>
              <p id="${id}" class="text-xl font-bold ${cls} mt-1">-</p>
            </div>`).join('')}
        </div>

        <!-- Table -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="p-4 flex flex-wrap gap-2 border-b border-gray-100">
            <input type="text" placeholder="Cari kode, nama, lokasi…" value="${_search}"
              oninput="AsetModule.onSearch(this.value)"
              class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
            <select onchange="AsetModule.onFilter('kategori',this.value)" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="">Semua Kategori</option>
              ${['tanah','bangunan','kendaraan','peralatan','elektronik','furniture','lainnya'].map(k=>`<option value="${k}" ${_filterKategori===k?'selected':''}>${k.charAt(0).toUpperCase()+k.slice(1)}</option>`).join('')}
            </select>
            <select onchange="AsetModule.onFilter('kondisi',this.value)" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="">Semua Kondisi</option>
              <option value="baik" ${_filterKondisi==='baik'?'selected':''}>Baik</option>
              <option value="rusak_ringan" ${_filterKondisi==='rusak_ringan'?'selected':''}>Rusak Ringan</option>
              <option value="rusak_berat" ${_filterKondisi==='rusak_berat'?'selected':''}>Rusak Berat</option>
            </select>
            <select onchange="AsetModule.onFilter('status',this.value)" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="">Semua Status</option>
              <option value="aktif" ${_filterStatus==='aktif'?'selected':''}>Aktif</option>
              <option value="dalam_perbaikan" ${_filterStatus==='dalam_perbaikan'?'selected':''}>Dalam Perbaikan</option>
              <option value="dihapuskan" ${_filterStatus==='dihapuskan'?'selected':''}>Dihapuskan</option>
            </select>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead class="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th class="px-4 py-3">Kode</th>
                  <th class="px-4 py-3">Nama / Lokasi</th>
                  <th class="px-4 py-3">Kategori</th>
                  <th class="px-4 py-3 text-center">Jumlah</th>
                  <th class="px-4 py-3">Harga Perolehan</th>
                  <th class="px-4 py-3">Tahun</th>
                  <th class="px-4 py-3">Kondisi & Status</th>
                  <th class="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody id="aset-tbody" class="divide-y divide-gray-50"></tbody>
            </table>
          </div>
          <div class="px-4 py-3 flex items-center justify-between text-xs text-gray-500 border-t border-gray-100">
            <span id="aset-info"></span>
            <div id="aset-pager"></div>
          </div>
        </div>
      </div>

      <!-- Modal -->
      <div id="aset-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40" onclick="AsetModule.closeModal()"></div>
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div class="p-6">
            <h2 id="aset-modal-title" class="text-lg font-semibold text-gray-800 mb-4">Aset</h2>
            <div id="aset-modal-body"></div>
          </div>
        </div>
      </div>
    `
    loadStats()
    loadAset()
  }

  const openModal = (title, html) => {
    document.getElementById('aset-modal-title').textContent = title
    document.getElementById('aset-modal-body').innerHTML = html
    document.getElementById('aset-modal').classList.remove('hidden')
  }
  const closeModal = () => document.getElementById('aset-modal').classList.add('hidden')

  const onSearch = (v) => { _search = v; _page = 1; loadAset() }
  const onFilter = (key, v) => {
    if (key === 'kategori') _filterKategori = v
    if (key === 'kondisi')  _filterKondisi  = v
    if (key === 'status')   _filterStatus   = v
    _page = 1; loadAset()
  }

  const formHtml = (a = {}) => `
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Kode Aset</label>
          <input id="af-kode" type="text" value="${a.kode_aset||''}" placeholder="mis: ELK-001"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Kategori *</label>
          <select id="af-kategori" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
            ${['tanah','bangunan','kendaraan','peralatan','elektronik','furniture','lainnya'].map(k=>`<option value="${k}" ${a.kategori===k?'selected':''}>${k.charAt(0).toUpperCase()+k.slice(1)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Nama Aset *</label>
        <input id="af-nama" type="text" value="${a.nama||''}" placeholder="Nama lengkap aset"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Lokasi</label>
          <input id="af-lokasi" type="text" value="${a.lokasi||''}" placeholder="Ruang / Gedung"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Satuan</label>
          <input id="af-satuan" type="text" value="${a.satuan||'unit'}" placeholder="unit / buah / bidang"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600">Jumlah</label>
          <input id="af-jumlah" type="number" value="${a.jumlah||1}" min="1"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Harga Perolehan</label>
          <input id="af-harga" type="number" value="${a.harga_perolehan||''}" placeholder="0"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Tahun Perolehan</label>
          <input id="af-tahun" type="number" value="${a.tahun_perolehan||new Date().getFullYear()}" placeholder="2024"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"/>
        </div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Keterangan</label>
        <textarea id="af-ket" rows="2" placeholder="Nomor seri, spesifikasi, dll."
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300">${a.keterangan||''}</textarea>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button onclick="AsetModule.closeModal()" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
        <button onclick="AsetModule.saveForm('${a.id||''}')" class="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Simpan</button>
      </div>
    </div>
  `

  const openForm = () => openModal('Tambah Aset', formHtml())

  const edit = async (id) => {
    try {
      const res = await API.get('/aset/' + id)
      openModal('Edit Aset', formHtml(res.data || {}))
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const saveForm = async (id) => {
    const nama     = document.getElementById('af-nama')?.value?.trim()
    const kategori = document.getElementById('af-kategori')?.value
    const kode     = document.getElementById('af-kode')?.value?.trim()
    const lokasi   = document.getElementById('af-lokasi')?.value?.trim()
    const satuan   = document.getElementById('af-satuan')?.value?.trim()
    const jumlah   = parseInt(document.getElementById('af-jumlah')?.value) || 1
    const harga    = parseInt(document.getElementById('af-harga')?.value) || 0
    const tahun    = parseInt(document.getElementById('af-tahun')?.value) || new Date().getFullYear()
    const ket      = document.getElementById('af-ket')?.value?.trim()
    if (!nama) return UI.toast('Nama aset wajib diisi', 'error')
    try {
      const body = { kode_aset: kode, nama, kategori, lokasi, satuan, jumlah, harga_perolehan: harga, tahun_perolehan: tahun, keterangan: ket }
      if (id) { await API.put('/aset/' + id, body) } else { await API.post('/aset', body) }
      closeModal(); UI.toast('Aset berhasil disimpan', 'success')
      loadStats(); loadAset()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const hapus = async (id) => {
    if (!confirm('Hapus aset ini?')) return
    try {
      await API.delete('/aset/' + id)
      UI.toast('Aset dihapus', 'success'); loadStats(); loadAset()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  const updateKondisi = (id, kondisiSaat, statusSaat) => {
    openModal('Update Kondisi Aset', `
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-gray-600">Kondisi</label>
            <select id="ak-kondisi" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
              <option value="baik" ${kondisiSaat==='baik'?'selected':''}>Baik</option>
              <option value="rusak_ringan" ${kondisiSaat==='rusak_ringan'?'selected':''}>Rusak Ringan</option>
              <option value="rusak_berat" ${kondisiSaat==='rusak_berat'?'selected':''}>Rusak Berat</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600">Status</label>
            <select id="ak-status" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
              <option value="aktif" ${statusSaat==='aktif'?'selected':''}>Aktif</option>
              <option value="dalam_perbaikan" ${statusSaat==='dalam_perbaikan'?'selected':''}>Dalam Perbaikan</option>
              <option value="dihapuskan" ${statusSaat==='dihapuskan'?'selected':''}>Dihapuskan</option>
            </select>
          </div>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Keterangan</label>
          <textarea id="ak-ket" rows="2" placeholder="Catatan kondisi / perbaikan"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-300"></textarea>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button onclick="AsetModule.closeModal()" class="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
          <button onclick="AsetModule.doUpdateKondisi('${id}')" class="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Simpan</button>
        </div>
      </div>
    `)
  }

  const doUpdateKondisi = async (id) => {
    const kondisi = document.getElementById('ak-kondisi')?.value
    const status  = document.getElementById('ak-status')?.value
    const ket     = document.getElementById('ak-ket')?.value?.trim()
    try {
      await API.patch('/aset/' + id + '/kondisi', { kondisi, status, keterangan: ket })
      closeModal(); UI.toast('Kondisi aset diperbarui', 'success')
      loadStats(); loadAset()
    } catch (e) { UI.toast(e.message, 'error') }
  }

  return { render, onSearch, onFilter, openForm, edit, saveForm, hapus, updateKondisi, doUpdateKondisi, closeModal }
})()
