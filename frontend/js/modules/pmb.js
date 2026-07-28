// ============================================================
// PMB MODULE — Penerimaan Mahasiswa Baru
// ============================================================
const PMBModule = (() => {
  const API = '/api/v1/pmb'
  let activeTab = 'gelombang'
  let currentGelombang = []

  // ── Helpers ──────────────────────────────────────────────
  const statusGelombangBadge = (s) => {
    const map = {
      draft: 'bg-slate-100 text-slate-600',
      buka:  'bg-green-100 text-green-700',
      seleksi: 'bg-yellow-100 text-yellow-700',
      selesai: 'bg-blue-100 text-blue-700',
    }
    const label = { draft:'Draft', buka:'Buka', seleksi:'Seleksi', selesai:'Selesai' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${label[s]||s}</span>`
  }

  const statusPendaftarBadge = (s) => {
    const map = {
      menunggu:     'bg-slate-100 text-slate-600',
      lulus_seleksi:'bg-green-100 text-green-700',
      tidak_lulus:  'bg-red-100 text-red-700',
      diterima:     'bg-blue-100 text-blue-700',
      mundur:       'bg-orange-100 text-orange-700',
    }
    const label = {
      menunggu:'Menunggu', lulus_seleksi:'Lulus Seleksi',
      tidak_lulus:'Tidak Lulus', diterima:'Diterima', mundur:'Mundur',
    }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${label[s]||s}</span>`
  }

  const jalurBadge = (j) => {
    const map = {
      reguler:   'bg-indigo-100 text-indigo-700',
      beasiswa:  'bg-purple-100 text-purple-700',
      transfer:  'bg-teal-100 text-teal-700',
      kerjasama: 'bg-pink-100 text-pink-700',
    }
    const label = { reguler:'Reguler', beasiswa:'Beasiswa', transfer:'Transfer', kerjasama:'Kerjasama' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[j]||'bg-gray-100 text-gray-600'}">${label[j]||j}</span>`
  }

  const fmtCurrency = (n) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0)
  const fmtDate = (s) => s ? new Date(s).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '-'

  // ── Render Shell ──────────────────────────────────────────
  const render = () => {
    document.getElementById('page-content').innerHTML = `
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-slate-800">PMB</h1>
            <p class="text-slate-500 text-sm mt-0.5">Penerimaan Mahasiswa Baru</p>
          </div>
        </div>

        <!-- Stats -->
        <div id="pmb-stats" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"></div>

        <!-- Tabs -->
        <div class="border-b border-slate-200">
          <nav class="flex gap-1">
            ${['gelombang','pendaftar'].map(t => `
              <button onclick="PMBModule.switchTab('${t}')"
                id="tab-${t}"
                class="tab-btn px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                  ${activeTab===t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
                ${t==='gelombang' ? 'Gelombang PMB' : 'Pendaftar'}
              </button>`).join('')}
          </nav>
        </div>

        <!-- Tab content -->
        <div id="tab-gelombang-content" class="${activeTab==='gelombang'?'':'hidden'}">
          ${renderGelombangTab()}
        </div>
        <div id="tab-pendaftar-content" class="${activeTab==='pendaftar'?'':'hidden'}">
          ${renderPendaftarTab()}
        </div>
      </div>

      <!-- Modals -->
      <div id="pmb-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div id="pmb-modal-box" class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"></div>
      </div>
      <div id="pmb-detail-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div id="pmb-detail-box" class="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"></div>
      </div>
    `
    loadStats()
    if (activeTab === 'gelombang') loadGelombang()
    else loadPendaftar()
  }

  // ── Stats ─────────────────────────────────────────────────
  const loadStats = async () => {
    try {
      const r = await fetch(API + '/stats')
      const j = await r.json()
      const d = j.data
      document.getElementById('pmb-stats').innerHTML = [
        ['Total Gelombang',  d.total_gelombang,  'bg-slate-50  text-slate-600',  '🗂️'],
        ['Gelombang Buka',   d.gelombang_buka,   'bg-green-50  text-green-600',  '🟢'],
        ['Total Pendaftar',  d.total_pendaftar,  'bg-indigo-50 text-indigo-600', '📋'],
        ['Lulus Seleksi',    d.lulus_seleksi,    'bg-yellow-50 text-yellow-700', '✅'],
        ['Diterima',         d.diterima,         'bg-blue-50   text-blue-600',   '🎓'],
        ['Mundur',           d.mundur,           'bg-orange-50 text-orange-600', '↩️'],
      ].map(([label, val, cls, icon]) => `
        <div class="bg-white rounded-xl border border-slate-200 p-4">
          <div class="flex items-center gap-3">
            <span class="text-2xl">${icon}</span>
            <div>
              <p class="text-xs text-slate-500">${label}</p>
              <p class="text-2xl font-bold ${cls.split(' ')[1]}">${val}</p>
            </div>
          </div>
        </div>`).join('')
    } catch(e) { console.error(e) }
  }

  // ── Gelombang Tab ─────────────────────────────────────────
  const renderGelombangTab = () => `
    <div class="bg-white rounded-xl border border-slate-200">
      <div class="p-4 flex flex-wrap gap-3 border-b border-slate-100">
        <input id="g-search" type="text" placeholder="Cari gelombang..."
          class="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-48"
          oninput="PMBModule.filterGelombang()">
        <select id="g-status" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" onchange="PMBModule.filterGelombang()">
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="buka">Buka</option>
          <option value="seleksi">Seleksi</option>
          <option value="selesai">Selesai</option>
        </select>
        <button onclick="PMBModule.openCreateGelombang()"
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Buat Gelombang
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              ${['Nama Gelombang','TA','Jalur','Periode','Kuota','Pendaftar','Biaya','Status','Aksi']
                .map(h=>`<th class="text-left px-4 py-3 text-slate-600 font-semibold">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody id="gelombang-tbody" class="divide-y divide-slate-100"></tbody>
        </table>
      </div>
      <div id="gelombang-pagination" class="p-4 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500"></div>
    </div>`

  let gelombangPage = 1
  const loadGelombang = async (page=1) => {
    gelombangPage = page
    const search = document.getElementById('g-search')?.value || ''
    const status = document.getElementById('g-status')?.value || ''
    try {
      const r = await fetch(`${API}/gelombang?page=${page}&per_page=20&search=${encodeURIComponent(search)}&status=${status}`)
      const j = await r.json()
      currentGelombang = j.data || []
      const tbody = document.getElementById('gelombang-tbody')
      if (!tbody) return
      tbody.innerHTML = currentGelombang.length ? currentGelombang.map(g => `
        <tr class="table-row-hover">
          <td class="px-4 py-3 font-medium text-slate-800">${g.nama}</td>
          <td class="px-4 py-3 text-slate-600">${g.tahun_akademik}</td>
          <td class="px-4 py-3">${jalurBadge(g.jalur)}</td>
          <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${fmtDate(g.tanggal_buka)} – ${fmtDate(g.tanggal_tutup)}</td>
          <td class="px-4 py-3 text-slate-700">${g.kuota}</td>
          <td class="px-4 py-3">
            <button onclick="PMBModule.lihatPendaftar('${g.id}')" class="text-indigo-600 hover:underline font-medium">
              ${g.jumlah_pendaftar||0} <span class="text-slate-400 font-normal text-xs">(${g.jumlah_diterima||0} diterima)</span>
            </button>
          </td>
          <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${fmtCurrency(g.biaya_pendaftaran)}</td>
          <td class="px-4 py-3">${statusGelombangBadge(g.status)}</td>
          <td class="px-4 py-3">
            <div class="flex gap-1 flex-wrap">
              ${g.status==='draft' ? `<button onclick="PMBModule.bukaGelombang('${g.id}')" class="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded font-medium">Buka</button>` : ''}
              ${g.status==='buka'  ? `<button onclick="PMBModule.tutupGelombang('${g.id}')" class="text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200 px-2 py-1 rounded font-medium">Tutup Pendaftaran</button>` : ''}
              ${g.status==='seleksi' ? `<button onclick="PMBModule.selesaikanGelombang('${g.id}')" class="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded font-medium">Selesaikan</button>` : ''}
              <button onclick="PMBModule.editGelombang('${g.id}')" class="text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded">Edit</button>
              ${g.status==='draft' ? `<button onclick="PMBModule.hapusGelombang('${g.id}')" class="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded">Hapus</button>` : ''}
            </div>
          </td>
        </tr>`).join('') : `<tr><td colspan="9" class="text-center py-12 text-slate-400">Belum ada gelombang PMB</td></tr>`
      const meta = j.meta
      document.getElementById('gelombang-pagination').innerHTML = meta ? `
        <span>Total ${meta.total} gelombang</span>
        <div class="flex gap-2">
          <button onclick="PMBModule.loadGelombang(${page-1})" ${page<=1?'disabled':''} class="px-3 py-1 border rounded disabled:opacity-40">‹</button>
          <span>${page}/${meta.total_pages}</span>
          <button onclick="PMBModule.loadGelombang(${page+1})" ${page>=meta.total_pages?'disabled':''} class="px-3 py-1 border rounded disabled:opacity-40">›</button>
        </div>` : ''
    } catch(e) { console.error(e) }
  }

  const filterGelombang = () => loadGelombang(1)

  // ── Pendaftar Tab ─────────────────────────────────────────
  const renderPendaftarTab = () => `
    <div class="bg-white rounded-xl border border-slate-200">
      <div class="p-4 flex flex-wrap gap-3 border-b border-slate-100">
        <input id="p-search" type="text" placeholder="Cari nama / no daftar / sekolah..."
          class="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-48"
          oninput="PMBModule.filterPendaftar()">
        <select id="p-gelombang" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" onchange="PMBModule.filterPendaftar()">
          <option value="">Semua Gelombang</option>
        </select>
        <select id="p-status" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" onchange="PMBModule.filterPendaftar()">
          <option value="">Semua Status</option>
          <option value="menunggu">Menunggu</option>
          <option value="lulus_seleksi">Lulus Seleksi</option>
          <option value="tidak_lulus">Tidak Lulus</option>
          <option value="diterima">Diterima</option>
          <option value="mundur">Mundur</option>
        </select>
        <select id="p-jalur" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" onchange="PMBModule.filterPendaftar()">
          <option value="">Semua Jalur</option>
          <option value="reguler">Reguler</option>
          <option value="beasiswa">Beasiswa</option>
          <option value="transfer">Transfer</option>
          <option value="kerjasama">Kerjasama</option>
        </select>
        <button onclick="PMBModule.openCreatePendaftar()"
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Tambah Pendaftar
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              ${['No Daftar','Nama','Asal Sekolah','Pilihan Prodi','Nilai Rata-rata','Jalur','Status','Aksi']
                .map(h=>`<th class="text-left px-4 py-3 text-slate-600 font-semibold">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody id="pendaftar-tbody" class="divide-y divide-slate-100"></tbody>
        </table>
      </div>
      <div id="pendaftar-pagination" class="p-4 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500"></div>
    </div>`

  let pendaftarPage = 1
  const loadGelombangSelect = async (selectId) => {
    try {
      const r = await fetch(`${API}/gelombang?page=1&per_page=100`)
      const j = await r.json()
      const el = document.getElementById(selectId)
      if (!el) return
      const prefix = selectId === 'p-gelombang' ? '<option value="">Semua Gelombang</option>' : '<option value="">-- Pilih Gelombang --</option>'
      el.innerHTML = prefix + (j.data||[]).map(g =>
        `<option value="${g.id}">${g.nama}</option>`).join('')
    } catch(e) {}
  }

  const loadPendaftar = async (page=1) => {
    pendaftarPage = page
    await loadGelombangSelect('p-gelombang')
    const search     = document.getElementById('p-search')?.value || ''
    const gelombangId = document.getElementById('p-gelombang')?.value || ''
    const status     = document.getElementById('p-status')?.value || ''
    const jalur      = document.getElementById('p-jalur')?.value || ''
    try {
      const q = new URLSearchParams({ page, per_page: 20, search, gelombang_id: gelombangId, status_seleksi: status, jalur })
      const r = await fetch(`${API}/pendaftar?${q}`)
      const j = await r.json()
      const rows = j.data || []
      const tbody = document.getElementById('pendaftar-tbody')
      if (!tbody) return
      tbody.innerHTML = rows.length ? rows.map(p => `
        <tr class="table-row-hover">
          <td class="px-4 py-3 font-mono text-xs text-slate-600">${p.no_daftar}</td>
          <td class="px-4 py-3 font-medium text-slate-800">
            ${p.nama}
            <div class="text-xs text-slate-400">${p.asal_sekolah}</div>
          </td>
          <td class="px-4 py-3 text-slate-600">${p.asal_sekolah}</td>
          <td class="px-4 py-3 text-slate-700">
            <div class="text-xs font-medium">1. ${p.pilihan_prodi_1_nama||'-'}</div>
            <div class="text-xs text-slate-400">2. ${p.pilihan_prodi_2_nama||'-'}</div>
          </td>
          <td class="px-4 py-3 font-semibold text-slate-800">${p.nilai_rata_rata||'-'}</td>
          <td class="px-4 py-3">${jalurBadge(p.jalur)}</td>
          <td class="px-4 py-3">${statusPendaftarBadge(p.status_seleksi)}</td>
          <td class="px-4 py-3">
            <div class="flex gap-1 flex-wrap">
              <button onclick="PMBModule.detailPendaftar('${p.id}')" class="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded">Detail</button>
              ${p.status_seleksi==='menunggu'||p.status_seleksi==='lulus_seleksi' ? `<button onclick="PMBModule.openUpdateStatus('${p.id}')" class="text-xs bg-yellow-50 text-yellow-700 hover:bg-yellow-100 px-2 py-1 rounded">Update Status</button>` : ''}
            </div>
          </td>
        </tr>`).join('') : `<tr><td colspan="8" class="text-center py-12 text-slate-400">Belum ada pendaftar</td></tr>`

      const meta = j.meta
      document.getElementById('pendaftar-pagination').innerHTML = meta ? `
        <span>Total ${meta.total} pendaftar</span>
        <div class="flex gap-2">
          <button onclick="PMBModule.loadPendaftar(${page-1})" ${page<=1?'disabled':''} class="px-3 py-1 border rounded disabled:opacity-40">‹</button>
          <span>${page}/${meta.total_pages}</span>
          <button onclick="PMBModule.loadPendaftar(${page+1})" ${page>=meta.total_pages?'disabled':''} class="px-3 py-1 border rounded disabled:opacity-40">›</button>
        </div>` : ''
    } catch(e) { console.error(e) }
  }

  const filterPendaftar = () => loadPendaftar(1)

  // ── Switch Tab ────────────────────────────────────────────
  const switchTab = (tab) => {
    activeTab = tab
    ;['gelombang','pendaftar'].forEach(t => {
      document.getElementById(`tab-${t}`).className =
        `tab-btn px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          t===tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`
      document.getElementById(`tab-${t}-content`).classList.toggle('hidden', t!==tab)
    })
    if (tab==='gelombang') loadGelombang()
    else loadPendaftar()
  }

  const lihatPendaftar = (gelombangId) => {
    switchTab('pendaftar')
    setTimeout(() => {
      const el = document.getElementById('p-gelombang')
      if (el) { el.value = gelombangId; loadPendaftar(1) }
    }, 300)
  }

  // ── Modal helpers ─────────────────────────────────────────
  const openModal = (html) => {
    document.getElementById('pmb-modal-box').innerHTML = html
    document.getElementById('pmb-modal').classList.remove('hidden')
  }
  const openDetailModal = (html) => {
    document.getElementById('pmb-detail-box').innerHTML = html
    document.getElementById('pmb-detail-modal').classList.remove('hidden')
  }
  const closeModal = () => {
    document.getElementById('pmb-modal').classList.add('hidden')
    document.getElementById('pmb-detail-modal').classList.add('hidden')
  }

  // ── Gelombang Modal ───────────────────────────────────────
  const gelombangForm = (g={}) => `
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-slate-800">${g.id ? 'Edit Gelombang' : 'Buat Gelombang PMB'}</h3>
        <button onclick="PMBModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
      </div>
      <form id="gelombang-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Nama Gelombang</label>
          <input name="nama" required value="${g.nama||''}"
            placeholder="mis: Gelombang 1 TA 2025/2026"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Tahun Akademik</label>
            <input name="tahun_akademik" required value="${g.tahun_akademik||''}"
              placeholder="mis: 2025/2026"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Jalur</label>
            <select name="jalur" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              ${['reguler','beasiswa','transfer','kerjasama'].map(j =>
                `<option value="${j}" ${g.jalur===j?'selected':''}>${j.charAt(0).toUpperCase()+j.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Tanggal Buka</label>
            <input name="tanggal_buka" type="date" required value="${(g.tanggal_buka||'').slice(0,10)}"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Tanggal Tutup</label>
            <input name="tanggal_tutup" type="date" required value="${(g.tanggal_tutup||'').slice(0,10)}"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Kuota</label>
            <input name="kuota" type="number" required value="${g.kuota||100}" min="1"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Biaya Pendaftaran (Rp)</label>
            <input name="biaya_pendaftaran" type="number" required value="${g.biaya_pendaftaran||200000}" min="0"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          </div>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium">
            ${g.id ? 'Simpan' : 'Buat Gelombang'}
          </button>
          <button type="button" onclick="PMBModule.closeModal()" class="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm">Batal</button>
        </div>
      </form>
    </div>`

  const openCreateGelombang = () => {
    openModal(gelombangForm())
    document.getElementById('gelombang-form').onsubmit = (e) => saveGelombang(e)
  }

  const editGelombang = async (id) => {
    const g = currentGelombang.find(x=>x.id===id) || {}
    openModal(gelombangForm(g))
    document.getElementById('gelombang-form').onsubmit = (e) => saveGelombang(e, id)
  }

  const saveGelombang = async (e, id=null) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = Object.fromEntries(fd)
    body.kuota = parseInt(body.kuota)
    body.biaya_pendaftaran = parseInt(body.biaya_pendaftaran)
    try {
      const url = id ? `${API}/gelombang/${id}` : `${API}/gelombang`
      const method = id ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      closeModal(); loadGelombang(gelombangPage); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const hapusGelombang = async (id) => {
    if (!confirm('Hapus gelombang ini?')) return
    try {
      const r = await fetch(`${API}/gelombang/${id}`, { method: 'DELETE' })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      loadGelombang(gelombangPage); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const bukaGelombang = async (id) => {
    try {
      const r = await fetch(`${API}/gelombang/${id}/buka`, { method: 'POST' })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      loadGelombang(gelombangPage); loadStats()
      UI.toast('Gelombang dibuka', 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const tutupGelombang = async (id) => {
    if (!confirm('Tutup pendaftaran dan masuk fase seleksi?')) return
    try {
      const r = await fetch(`${API}/gelombang/${id}/tutup`, { method: 'POST' })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      loadGelombang(gelombangPage); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const selesaikanGelombang = async (id) => {
    if (!confirm('Selesaikan gelombang ini? Proses ini tidak bisa dibatalkan.')) return
    try {
      const r = await fetch(`${API}/gelombang/${id}/selesaikan`, { method: 'POST' })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      loadGelombang(gelombangPage); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  // ── Pendaftar Modal ───────────────────────────────────────
  const openCreatePendaftar = async () => {
    const r = await fetch(`${API}/gelombang?page=1&per_page=100&status=buka`)
    const j = await r.json()
    const gelombangOpts = (j.data||[]).map(g => `<option value="${g.id}">${g.nama}</option>`).join('')
    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-slate-800">Tambah Pendaftar</h3>
          <button onclick="PMBModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>
        <form id="pendaftar-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Gelombang</label>
            <select name="gelombang_id" required class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih Gelombang --</option>${gelombangOpts}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
              <input name="nama" required placeholder="Nama pendaftar"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input name="email" type="email" required placeholder="email@domain.com"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">No. HP</label>
              <input name="no_hp" required placeholder="08xxxxxxxxxx"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Jalur</label>
              <select name="jalur" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="reguler">Reguler</option>
                <option value="beasiswa">Beasiswa</option>
                <option value="transfer">Transfer</option>
                <option value="kerjasama">Kerjasama</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Asal Sekolah</label>
              <input name="asal_sekolah" required placeholder="SMAN 1 ..."
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Jurusan Asal</label>
              <input name="jurusan_asal" required placeholder="IPA / IPS / TKJ ..."
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div class="col-span-2">
              <label class="block text-sm font-medium text-slate-700 mb-1">Pilihan Prodi 1</label>
              <input name="pilihan_prodi_1_nama" required placeholder="mis: Teknik Informatika"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Nilai Rata-rata</label>
              <input name="nilai_rata_rata" type="number" step="0.1" min="0" max="100" required placeholder="85.0"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Pilihan Prodi 2 (opsional)</label>
            <input name="pilihan_prodi_2_nama" placeholder="mis: Sistem Informasi"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          </div>
          <div class="flex gap-3 pt-2">
            <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium">Daftarkan</button>
            <button type="button" onclick="PMBModule.closeModal()" class="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm">Batal</button>
          </div>
        </form>
      </div>`)
    document.getElementById('pendaftar-form').onsubmit = savePendaftar
  }

  const savePendaftar = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = Object.fromEntries(fd)
    body.nilai_rata_rata = parseFloat(body.nilai_rata_rata)
    body.dokumen_lengkap = false
    try {
      const r = await fetch(`${API}/pendaftar`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      closeModal(); loadPendaftar(pendaftarPage); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const detailPendaftar = async (id) => {
    try {
      const r = await fetch(`${API}/pendaftar/${id}`)
      const j = await r.json()
      const p = j.data
      openDetailModal(`
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="font-semibold text-slate-800 text-lg">${p.nama}</h3>
              <p class="text-slate-500 text-sm">${p.no_daftar}</p>
            </div>
            <button onclick="PMBModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
          </div>
          <div class="grid grid-cols-2 gap-6 mb-6">
            <div class="space-y-3">
              <div><p class="text-xs text-slate-400">Email</p><p class="text-sm font-medium">${p.email}</p></div>
              <div><p class="text-xs text-slate-400">No. HP</p><p class="text-sm font-medium">${p.no_hp}</p></div>
              <div><p class="text-xs text-slate-400">Asal Sekolah</p><p class="text-sm font-medium">${p.asal_sekolah}</p></div>
              <div><p class="text-xs text-slate-400">Jurusan Asal</p><p class="text-sm font-medium">${p.jurusan_asal}</p></div>
            </div>
            <div class="space-y-3">
              <div><p class="text-xs text-slate-400">Pilihan Prodi 1</p><p class="text-sm font-medium">${p.pilihan_prodi_1_nama||'-'}</p></div>
              <div><p class="text-xs text-slate-400">Pilihan Prodi 2</p><p class="text-sm font-medium">${p.pilihan_prodi_2_nama||'-'}</p></div>
              <div><p class="text-xs text-slate-400">Nilai Rata-rata</p><p class="text-sm font-bold text-indigo-600">${p.nilai_rata_rata}</p></div>
              <div><p class="text-xs text-slate-400">Jalur</p>${jalurBadge(p.jalur)}</div>
            </div>
          </div>
          <div class="bg-slate-50 rounded-lg p-4 space-y-2 mb-6">
            <div class="flex justify-between items-center">
              <span class="text-sm text-slate-600">Status Seleksi</span>
              ${statusPendaftarBadge(p.status_seleksi)}
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-slate-600">Tgl Pendaftaran</span>
              <span class="text-sm font-medium">${fmtDate(p.tgl_daftar)}</span>
            </div>
            ${p.tgl_seleksi ? `<div class="flex justify-between items-center">
              <span class="text-sm text-slate-600">Tgl Seleksi</span>
              <span class="text-sm font-medium">${fmtDate(p.tgl_seleksi)}</span>
            </div>` : ''}
            ${p.catatan ? `<div class="flex justify-between items-center">
              <span class="text-sm text-slate-600">Catatan</span>
              <span class="text-sm text-slate-700">${p.catatan}</span>
            </div>` : ''}
            <div class="flex justify-between items-center">
              <span class="text-sm text-slate-600">Dokumen Lengkap</span>
              <span class="text-sm font-medium ${p.dokumen_lengkap?'text-green-600':'text-red-500'}">${p.dokumen_lengkap?'Lengkap':'Belum Lengkap'}</span>
            </div>
          </div>
          ${p.status_seleksi==='menunggu'||p.status_seleksi==='lulus_seleksi' ? `
            <div class="border-t border-slate-100 pt-4">
              <p class="text-sm font-medium text-slate-700 mb-3">Update Status Seleksi</p>
              <div id="update-status-area-${p.id}">
                ${renderStatusButtons(p)}
              </div>
            </div>` : ''}
        </div>`)
    } catch(e) { UI.toast('Gagal memuat detail', 'error') }
  }

  const renderStatusButtons = (p) => `
    <div class="space-y-3">
      <div class="flex flex-wrap gap-2">
        ${p.status_seleksi==='menunggu' ? `<button onclick="PMBModule.setStatus('${p.id}','lulus_seleksi')" class="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg text-sm font-medium">✅ Lulus Seleksi</button>` : ''}
        ${p.status_seleksi==='menunggu' ? `<button onclick="PMBModule.setStatus('${p.id}','tidak_lulus')" class="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-lg text-sm font-medium">❌ Tidak Lulus</button>` : ''}
        ${p.status_seleksi==='lulus_seleksi' ? `<button onclick="PMBModule.setStatus('${p.id}','diterima')" class="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-sm font-medium">🎓 Terima</button>` : ''}
        ${p.status_seleksi==='lulus_seleksi' ? `<button onclick="PMBModule.setStatus('${p.id}','mundur')" class="bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1.5 rounded-lg text-sm font-medium">↩️ Mundur</button>` : ''}
      </div>
      <input id="status-catatan-${p.id}" type="text" placeholder="Catatan (opsional)"
        class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
    </div>`

  const openUpdateStatus = (id) => detailPendaftar(id)

  const setStatus = async (id, status) => {
    const catatan = document.getElementById(`status-catatan-${id}`)?.value || ''
    try {
      const r = await fetch(`${API}/pendaftar/${id}/update-status`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ status_seleksi: status, catatan }),
      })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      closeModal(); loadPendaftar(pendaftarPage); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  return {
    render, switchTab,
    filterGelombang, loadGelombang,
    filterPendaftar, loadPendaftar,
    lihatPendaftar,
    openCreateGelombang, editGelombang, saveGelombang, hapusGelombang,
    bukaGelombang, tutupGelombang, selesaikanGelombang,
    openCreatePendaftar, savePendaftar,
    detailPendaftar, openUpdateStatus, setStatus,
    closeModal,
  }
})()
