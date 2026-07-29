// ============================================================
// SURAT MODULE — Surat Menyurat
// ============================================================
const SuratModule = (() => {
  const API = '/api/v1/surat'
  let activeTab = 'pengajuan'
  let templates = []

  // ── Helpers ──────────────────────────────────────────────
  const statusBadge = (s) => {
    const map = {
      menunggu: 'bg-yellow-100 text-yellow-700',
      diproses: 'bg-blue-100 text-blue-700',
      selesai:  'bg-green-100 text-green-700',
      ditolak:  'bg-red-100 text-red-700',
    }
    const label = { menunggu:'Menunggu', diproses:'Diproses', selesai:'Selesai', ditolak:'Ditolak' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${label[s]||s}</span>`
  }

  const jenisBadge = (j) => {
    const colors = [
      'bg-indigo-100 text-indigo-700','bg-purple-100 text-purple-700',
      'bg-teal-100 text-teal-700','bg-pink-100 text-pink-700',
      'bg-orange-100 text-orange-700','bg-cyan-100 text-cyan-700',
    ]
    const label = {
      surat_keterangan_aktif:   'Ket. Aktif',
      surat_keterangan_lulus:   'Ket. Lulus',
      surat_keterangan_mahasiswa:'Ket. Mahasiswa',
      surat_rekomendasi:        'Rekomendasi',
      surat_cuti:               'Cuti Akademik',
      transkrip_sementara:      'Transkrip',
    }
    const keys = Object.keys(label)
    const idx  = keys.indexOf(j) % colors.length
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${colors[idx>=0?idx:0]}">${label[j]||j}</span>`
  }

  const fmtDate = (s) => s ? new Date(s).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '-'

  // ── Render Shell ──────────────────────────────────────────
  const render = () => {
    document.getElementById('page-content').innerHTML = `
    Router.setPageMeta('Surat Menyurat', 'Pengelolaan pengajuan dan template surat')
      <div class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Surat Menyurat</h1>
          <p class="text-slate-500 text-sm mt-0.5">Pengelolaan pengajuan dan template surat</p>
        </div>

        <!-- Stats -->
        <div id="surat-stats" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"></div>

        <!-- Tabs -->
        <div class="border-b border-slate-200">
          <nav class="flex gap-1">
            ${['pengajuan','template'].map(t => `
              <button onclick="SuratModule.switchTab('${t}')"
                id="tab-${t}"
                class="tab-btn px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                  ${activeTab===t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
                ${t === 'pengajuan' ? 'Pengajuan Surat' : 'Template Surat'}
              </button>`).join('')}
          </nav>
        </div>

        <div id="tab-pengajuan-content" class="${activeTab==='pengajuan'?'':'hidden'}">
          ${renderPengajuanTab()}
        </div>
        <div id="tab-template-content" class="${activeTab==='template'?'':'hidden'}">
          ${renderTemplateTab()}
        </div>
      </div>

      <!-- Modal -->
      <div id="surat-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div id="surat-modal-box" class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"></div>
      </div>
      <!-- Detail Modal -->
      <div id="surat-detail-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div id="surat-detail-box" class="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"></div>
      </div>
    `
    loadStats()
    loadTemplateCache()
    if (activeTab === 'pengajuan') loadPengajuan()
    else loadTemplate()
  }

  const loadStats = async () => {
    try {
      const r = await fetch(API + '/stats')
      const j = await r.json()
      const d = j.data
      document.getElementById('surat-stats').innerHTML = [
        ['Total Pengajuan', d.total_pengajuan, 'text-slate-700',   '📋'],
        ['Menunggu',        d.menunggu,         'text-yellow-600',  '⏳'],
        ['Diproses',        d.diproses,         'text-blue-600',    '🔄'],
        ['Selesai',         d.selesai,          'text-green-600',   '✅'],
        ['Ditolak',         d.ditolak,          'text-red-600',     '❌'],
        ['Template',        d.total_template,   'text-indigo-600',  '📄'],
      ].map(([label, val, cls, icon]) => `
        <div class="bg-white rounded-xl border border-slate-200 p-4">
          <div class="flex items-center gap-3">
            <span class="text-2xl">${icon}</span>
            <div>
              <p class="text-xs text-slate-500">${label}</p>
              <p class="text-2xl font-bold ${cls}">${val}</p>
            </div>
          </div>
        </div>`).join('')
    } catch(e) { console.error(e) }
  }

  const loadTemplateCache = async () => {
    try {
      const r = await fetch(`${API}/template?per_page=100`)
      const j = await r.json()
      templates = j.data || []
    } catch(e) {}
  }

  // ── Pengajuan Tab ─────────────────────────────────────────
  const renderPengajuanTab = () => `
    <div class="bg-white rounded-xl border border-slate-200">
      <div class="p-4 flex flex-wrap gap-3 border-b border-slate-100">
        <input id="pj-search" type="text" placeholder="Cari nama / NIM / no surat..."
          class="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-48"
          oninput="SuratModule.filterPengajuan()">
        <select id="pj-status" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" onchange="SuratModule.filterPengajuan()">
          <option value="">Semua Status</option>
          <option value="menunggu">Menunggu</option>
          <option value="diproses">Diproses</option>
          <option value="selesai">Selesai</option>
          <option value="ditolak">Ditolak</option>
        </select>
        <select id="pj-jenis" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" onchange="SuratModule.filterPengajuan()">
          <option value="">Semua Jenis</option>
          <option value="surat_keterangan_aktif">Ket. Aktif</option>
          <option value="surat_keterangan_lulus">Ket. Lulus</option>
          <option value="surat_keterangan_mahasiswa">Ket. Mahasiswa</option>
          <option value="surat_rekomendasi">Rekomendasi</option>
          <option value="surat_cuti">Cuti Akademik</option>
          <option value="transkrip_sementara">Transkrip</option>
        </select>
        <button onclick="SuratModule.openCreatePengajuan()"
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Buat Pengajuan
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              ${['Mahasiswa','Jenis Surat','Keperluan','No Surat','Tgl Pengajuan','Tgl Selesai','Status','Aksi']
                .map(h=>`<th class="text-left px-4 py-3 text-slate-600 font-semibold">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody id="pengajuan-tbody" class="divide-y divide-slate-100"></tbody>
        </table>
      </div>
      <div id="pengajuan-pagination" class="p-4 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500"></div>
    </div>`

  let pengajuanPage = 1
  const loadPengajuan = async (page=1) => {
    pengajuanPage = page
    const search = document.getElementById('pj-search')?.value || ''
    const status = document.getElementById('pj-status')?.value || ''
    const jenis  = document.getElementById('pj-jenis')?.value || ''
    try {
      const q = new URLSearchParams({ page, per_page: 20, search, status, jenis_surat: jenis })
      const r = await fetch(`${API}/pengajuan?${q}`)
      const j = await r.json()
      const rows = j.data || []
      const tbody = document.getElementById('pengajuan-tbody')
      if (!tbody) return
      tbody.innerHTML = rows.length ? rows.map(p => `
        <tr class="table-row-hover">
          <td class="px-4 py-3">
            <p class="font-medium text-slate-800">${p.mahasiswa_nama}</p>
            <p class="text-xs text-slate-400">${p.mahasiswa_nim}</p>
          </td>
          <td class="px-4 py-3">${jenisBadge(p.jenis_surat)}</td>
          <td class="px-4 py-3 text-slate-600 max-w-48 truncate">${p.keperluan||'-'}</td>
          <td class="px-4 py-3 font-mono text-xs text-slate-600">${p.no_surat||'-'}</td>
          <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${fmtDate(p.tgl_pengajuan)}</td>
          <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${fmtDate(p.tgl_selesai)}</td>
          <td class="px-4 py-3">${statusBadge(p.status)}</td>
          <td class="px-4 py-3">
            <div class="flex gap-1 flex-wrap">
              <button onclick="SuratModule.detailPengajuan('${p.id}')" class="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded">Detail</button>
              ${p.status==='menunggu' ? `
                <button onclick="SuratModule.prosesPengajuan('${p.id}')" class="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded">Proses</button>
                <button onclick="SuratModule.openTolak('${p.id}')" class="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded">Tolak</button>` : ''}
              ${p.status==='diproses' ? `
                <button onclick="SuratModule.selesaikanPengajuan('${p.id}')" class="text-xs bg-green-50 text-green-600 hover:bg-green-100 px-2 py-1 rounded">Selesaikan</button>
                <button onclick="SuratModule.openTolak('${p.id}')" class="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded">Tolak</button>` : ''}
              ${p.status==='menunggu' ? `<button onclick="SuratModule.hapusPengajuan('${p.id}')" class="text-xs bg-slate-50 text-slate-500 hover:bg-slate-100 px-2 py-1 rounded">Hapus</button>` : ''}
            </div>
          </td>
        </tr>`).join('') : `<tr><td colspan="8" class="text-center py-12 text-slate-400">Belum ada pengajuan surat</td></tr>`

      const meta = j.meta
      document.getElementById('pengajuan-pagination').innerHTML = meta ? `
        <span>Total ${meta.total} pengajuan</span>
        <div class="flex gap-2">
          <button onclick="SuratModule.loadPengajuan(${page-1})" ${page<=1?'disabled':''} class="px-3 py-1 border rounded disabled:opacity-40">‹</button>
          <span>${page}/${meta.total_pages}</span>
          <button onclick="SuratModule.loadPengajuan(${page+1})" ${page>=meta.total_pages?'disabled':''} class="px-3 py-1 border rounded disabled:opacity-40">›</button>
        </div>` : ''
    } catch(e) { console.error(e) }
  }

  const filterPengajuan = () => loadPengajuan(1)

  // ── Template Tab ──────────────────────────────────────────
  const renderTemplateTab = () => `
    <div class="bg-white rounded-xl border border-slate-200">
      <div class="p-4 flex flex-wrap gap-3 border-b border-slate-100 justify-between">
        <input id="tmpl-search" type="text" placeholder="Cari template..."
          class="border border-slate-200 rounded-lg px-3 py-2 text-sm w-64"
          oninput="SuratModule.filterTemplate()">
        <button onclick="SuratModule.openCreateTemplate()"
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Tambah Template
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              ${['Kode','Nama Surat','Jenis','Deskripsi','Estimasi','Status','Aksi']
                .map(h=>`<th class="text-left px-4 py-3 text-slate-600 font-semibold">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody id="template-tbody" class="divide-y divide-slate-100"></tbody>
        </table>
      </div>
    </div>`

  const loadTemplate = async () => {
    const search = document.getElementById('tmpl-search')?.value || ''
    try {
      const r = await fetch(`${API}/template?per_page=100&search=${encodeURIComponent(search)}`)
      const j = await r.json()
      templates = j.data || []
      const tbody = document.getElementById('template-tbody')
      if (!tbody) return
      tbody.innerHTML = templates.length ? templates.map(t => `
        <tr class="table-row-hover">
          <td class="px-4 py-3 font-mono font-semibold text-indigo-600">${t.kode}</td>
          <td class="px-4 py-3 font-medium text-slate-800">${t.nama}</td>
          <td class="px-4 py-3">${jenisBadge(t.jenis)}</td>
          <td class="px-4 py-3 text-slate-600 max-w-xs">${t.deskripsi||'-'}</td>
          <td class="px-4 py-3 text-slate-700">${t.estimasi_hari} hari</td>
          <td class="px-4 py-3">
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${t.is_active?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}">
              ${t.is_active?'Aktif':'Nonaktif'}
            </span>
          </td>
          <td class="px-4 py-3">
            <div class="flex gap-1">
              <button onclick="SuratModule.editTemplate('${t.id}')" class="text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded">Edit</button>
              <button onclick="SuratModule.toggleTemplate('${t.id}',${!t.is_active})" class="text-xs ${t.is_active?'bg-yellow-50 text-yellow-700 hover:bg-yellow-100':'bg-green-50 text-green-700 hover:bg-green-100'} px-2 py-1 rounded">
                ${t.is_active?'Nonaktifkan':'Aktifkan'}
              </button>
              <button onclick="SuratModule.hapusTemplate('${t.id}')" class="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded">Hapus</button>
            </div>
          </td>
        </tr>`).join('') : `<tr><td colspan="7" class="text-center py-12 text-slate-400">Belum ada template</td></tr>`
    } catch(e) { console.error(e) }
  }

  const filterTemplate = () => loadTemplate()

  // ── Switch Tab ────────────────────────────────────────────
  const switchTab = (tab) => {
    activeTab = tab
    ;['pengajuan','template'].forEach(t => {
      document.getElementById(`tab-${t}`).className =
        `tab-btn px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          t===tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`
      document.getElementById(`tab-${t}-content`).classList.toggle('hidden', t!==tab)
    })
    if (tab==='pengajuan') loadPengajuan()
    else loadTemplate()
  }

  // ── Modal helpers ─────────────────────────────────────────
  const openModal = (html) => {
    document.getElementById('surat-modal-box').innerHTML = html
    document.getElementById('surat-modal').classList.remove('hidden')
  }
  const openDetailModal = (html) => {
    document.getElementById('surat-detail-box').innerHTML = html
    document.getElementById('surat-detail-modal').classList.remove('hidden')
  }
  const closeModal = () => {
    document.getElementById('surat-modal').classList.add('hidden')
    document.getElementById('surat-detail-modal').classList.add('hidden')
  }

  // ── Pengajuan Modals ──────────────────────────────────────
  const openCreatePengajuan = () => {
    const tmplOpts = templates.filter(t=>t.is_active).map(t =>
      `<option value="${t.id}" data-jenis="${t.jenis}" data-hari="${t.estimasi_hari}">${t.nama} (±${t.estimasi_hari} hari)</option>`).join('')
    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-slate-800">Buat Pengajuan Surat</h3>
          <button onclick="SuratModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>
        <form id="pengajuan-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Jenis Surat</label>
            <select name="template_id" required class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih Jenis Surat --</option>${tmplOpts}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Nama Mahasiswa</label>
              <input name="mahasiswa_nama" required placeholder="Nama lengkap"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">NIM</label>
              <input name="mahasiswa_nim" required placeholder="20XXXX"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Keperluan</label>
            <input name="keperluan" required placeholder="Tujuan pengajuan surat ini..."
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Catatan Tambahan</label>
            <textarea name="catatan" rows="2" placeholder="Keterangan tambahan (opsional)"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"></textarea>
          </div>
          <div class="flex gap-3 pt-2">
            <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium">Ajukan</button>
            <button type="button" onclick="SuratModule.closeModal()" class="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm">Batal</button>
          </div>
        </form>
      </div>`)
    document.getElementById('pengajuan-form').onsubmit = savePengajuan
  }

  const savePengajuan = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = Object.fromEntries(fd)
    body.mahasiswa_id = `mhs-${body.mahasiswa_nim}`
    try {
      const r = await fetch(`${API}/pengajuan`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      closeModal(); loadPengajuan(pengajuanPage); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const detailPengajuan = async (id) => {
    try {
      const r = await fetch(`${API}/pengajuan/${id}`)
      const j = await r.json()
      const p = j.data
      openDetailModal(`
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="font-semibold text-slate-800 text-lg">${p.nama_surat}</h3>
              <p class="text-slate-500 text-sm">${p.mahasiswa_nama} · ${p.mahasiswa_nim}</p>
            </div>
            <button onclick="SuratModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
          </div>

          <div class="space-y-3 mb-6">
            <div class="flex justify-between"><span class="text-sm text-slate-500">Jenis Surat</span>${jenisBadge(p.jenis_surat)}</div>
            <div class="flex justify-between"><span class="text-sm text-slate-500">Keperluan</span><span class="text-sm font-medium max-w-xs text-right">${p.keperluan||'-'}</span></div>
            <div class="flex justify-between"><span class="text-sm text-slate-500">Tgl Pengajuan</span><span class="text-sm font-medium">${fmtDate(p.tgl_pengajuan)}</span></div>
            <div class="flex justify-between"><span class="text-sm text-slate-500">No Surat</span><span class="text-sm font-mono">${p.no_surat||'-'}</span></div>
            <div class="flex justify-between"><span class="text-sm text-slate-500">Tgl Selesai</span><span class="text-sm font-medium">${fmtDate(p.tgl_selesai)}</span></div>
            <div class="flex justify-between"><span class="text-sm text-slate-500">Status</span>${statusBadge(p.status)}</div>
            ${p.catatan ? `<div class="flex justify-between"><span class="text-sm text-slate-500">Catatan</span><span class="text-sm">${p.catatan}</span></div>` : ''}
            ${p.catatan_admin ? `<div class="flex justify-between items-start"><span class="text-sm text-slate-500">Catatan Admin</span><span class="text-sm text-red-600 max-w-xs text-right">${p.catatan_admin}</span></div>` : ''}
          </div>

          ${p.status === 'menunggu' || p.status === 'diproses' ? `
            <div class="border-t border-slate-100 pt-4 space-y-3">
              <p class="text-sm font-medium text-slate-700">Aksi</p>
              ${p.status==='menunggu' ? `<button onclick="SuratModule.prosesPengajuan('${p.id}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium">Proses Pengajuan</button>` : ''}
              ${p.status==='diproses' ? `<button onclick="SuratModule.selesaikanPengajuan('${p.id}')" class="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium">Selesaikan & Terbitkan Nomor</button>` : ''}
              <button onclick="SuratModule.openTolak('${p.id}')" class="w-full border border-red-200 text-red-600 hover:bg-red-50 py-2 rounded-lg text-sm font-medium">Tolak Pengajuan</button>
            </div>` : ''}
        </div>`)
    } catch(e) { UI.toast('Gagal memuat detail', 'error') }
  }

  const prosesPengajuan = async (id) => {
    try {
      const r = await fetch(`${API}/pengajuan/${id}/proses`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      closeModal(); loadPengajuan(pengajuanPage); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const selesaikanPengajuan = async (id) => {
    try {
      const r = await fetch(`${API}/pengajuan/${id}/selesai`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      closeModal(); loadPengajuan(pengajuanPage); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const openTolak = (id) => {
    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-slate-800">Tolak Pengajuan</h3>
          <button onclick="SuratModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Alasan Penolakan <span class="text-red-500">*</span></label>
            <textarea id="tolak-alasan" rows="3" required placeholder="Jelaskan alasan penolakan..."
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"></textarea>
          </div>
          <div class="flex gap-3">
            <button onclick="SuratModule.submitTolak('${id}')" class="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium">Tolak Pengajuan</button>
            <button onclick="SuratModule.closeModal()" class="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm">Batal</button>
          </div>
        </div>
      </div>`)
  }

  const submitTolak = async (id) => {
    const alasan = document.getElementById('tolak-alasan')?.value?.trim()
    if (!alasan) { UI.toast('Alasan penolakan wajib diisi', 'error'); return }
    try {
      const r = await fetch(`${API}/pengajuan/${id}/tolak`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ catatan_admin: alasan }),
      })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      closeModal(); loadPengajuan(pengajuanPage); loadStats()
      UI.toast('Pengajuan ditolak', 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const hapusPengajuan = async (id) => {
    if (!confirm('Hapus pengajuan ini?')) return
    try {
      const r = await fetch(`${API}/pengajuan/${id}`, { method:'DELETE' })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      loadPengajuan(pengajuanPage); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  // ── Template Modals ───────────────────────────────────────
  const templateForm = (t={}) => `
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-slate-800">${t.id ? 'Edit Template' : 'Tambah Template'}</h3>
        <button onclick="SuratModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
      </div>
      <form id="template-form" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Kode</label>
            <input name="kode" required value="${t.kode||''}" placeholder="mis: SKA"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nama Surat</label>
            <input name="nama" required value="${t.nama||''}" placeholder="Surat Keterangan Aktif"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Jenis</label>
          <select name="jenis" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            ${[
              ['surat_keterangan_aktif','Surat Keterangan Aktif'],
              ['surat_keterangan_lulus','Surat Keterangan Lulus'],
              ['surat_keterangan_mahasiswa','Surat Keterangan Mahasiswa'],
              ['surat_rekomendasi','Surat Rekomendasi'],
              ['surat_cuti','Surat Cuti Akademik'],
              ['transkrip_sementara','Transkrip Sementara'],
            ].map(([v,l])=>`<option value="${v}" ${t.jenis===v?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Deskripsi</label>
          <textarea name="deskripsi" rows="2" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">${t.deskripsi||''}</textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Syarat (satu per baris)</label>
          <textarea name="syarat_raw" rows="3" placeholder="Satu syarat per baris"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">${(t.syarat||[]).join('\n')}</textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Estimasi Selesai (hari)</label>
          <input name="estimasi_hari" type="number" min="1" required value="${t.estimasi_hari||2}"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
        </div>
        <div class="flex gap-3 pt-2">
          <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium">
            ${t.id ? 'Simpan' : 'Tambah'}
          </button>
          <button type="button" onclick="SuratModule.closeModal()" class="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm">Batal</button>
        </div>
      </form>
    </div>`

  const openCreateTemplate = () => {
    openModal(templateForm())
    document.getElementById('template-form').onsubmit = (e) => saveTemplate(e)
  }

  const editTemplate = (id) => {
    const t = templates.find(x=>x.id===id) || {}
    openModal(templateForm(t))
    document.getElementById('template-form').onsubmit = (e) => saveTemplate(e, id)
  }

  const saveTemplate = async (e, id=null) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = Object.fromEntries(fd)
    body.estimasi_hari = parseInt(body.estimasi_hari)
    body.syarat = (body.syarat_raw||'').split('\n').map(s=>s.trim()).filter(Boolean)
    delete body.syarat_raw
    try {
      const url  = id ? `${API}/template/${id}` : `${API}/template`
      const meth = id ? 'PUT' : 'POST'
      const r = await fetch(url, { method:meth, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      closeModal(); loadTemplate(); loadTemplateCache(); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const toggleTemplate = async (id, active) => {
    try {
      const r = await fetch(`${API}/template/${id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ is_active: active }),
      })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      loadTemplate(); loadTemplateCache()
      UI.toast(active ? 'Template diaktifkan' : 'Template dinonaktifkan', 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const hapusTemplate = async (id) => {
    if (!confirm('Hapus template ini?')) return
    try {
      const r = await fetch(`${API}/template/${id}`, { method:'DELETE' })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      loadTemplate(); loadTemplateCache(); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  return {
    render, switchTab,
    filterPengajuan, loadPengajuan,
    filterTemplate, loadTemplate,
    openCreatePengajuan, savePengajuan,
    detailPengajuan, prosesPengajuan, selesaikanPengajuan,
    openTolak, submitTolak, hapusPengajuan,
    openCreateTemplate, editTemplate, saveTemplate,
    toggleTemplate, hapusTemplate,
    closeModal,
  }
})()
