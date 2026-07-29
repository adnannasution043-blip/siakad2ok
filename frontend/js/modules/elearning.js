// ============================================================
// ELEARNING MODULE — E-Learning
// ============================================================
const ElearningModule = (() => {
  const API = '/api/v1/elearning'
  let activeTab = 'kursus'
  let kursusList = []

  // ── Helpers ──────────────────────────────────────────────
  const statusBadge = (s) => {
    const map = {
      draft:    'bg-slate-100 text-slate-600',
      published:'bg-green-100 text-green-700',
      archived: 'bg-orange-100 text-orange-700',
    }
    const label = { draft:'Draft', published:'Published', archived:'Arsip' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${label[s]||s}</span>`
  }

  const tipeBadge = (t) => {
    const map = {
      video:   'bg-red-100 text-red-700',
      dokumen: 'bg-blue-100 text-blue-700',
      quiz:    'bg-yellow-100 text-yellow-700',
      tugas:   'bg-purple-100 text-purple-700',
    }
    const icon = { video:'▶', dokumen:'📄', quiz:'❓', tugas:'✏️' }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[t]||'bg-gray-100 text-gray-600'}">${icon[t]||''} ${t}</span>`
  }

  const progressBar = (pct) => `
    <div class="flex items-center gap-2">
      <div class="flex-1 bg-slate-100 rounded-full h-1.5">
        <div class="h-1.5 rounded-full ${pct===100?'bg-green-500':'bg-indigo-500'}" style="width:${pct}%"></div>
      </div>
      <span class="text-xs text-slate-600 w-8 text-right">${pct}%</span>
    </div>`

  const fmtDate = (s) => s ? new Date(s).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '-'

  // ── Render Shell ──────────────────────────────────────────
  const render = () => {
    document.getElementById('page-content').innerHTML = `
    Router.setPageMeta('E-Learning', 'Manajemen kursus online, materi, dan peserta')
      <div class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">E-Learning</h1>
          <p class="text-slate-500 text-sm mt-0.5">Manajemen kursus online, materi, dan peserta</p>
        </div>

        <div id="el-stats" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"></div>

        <div class="border-b border-slate-200">
          <nav class="flex gap-1">
            ${['kursus','materi','peserta'].map(t => `
              <button onclick="ElearningModule.switchTab('${t}')"
                id="tab-${t}"
                class="tab-btn px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                  ${activeTab===t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
                ${{kursus:'Kursus',materi:'Materi',peserta:'Peserta'}[t]}
              </button>`).join('')}
          </nav>
        </div>

        <div id="tab-kursus-content"  class="${activeTab==='kursus'?'':'hidden'}">${renderKursusTab()}</div>
        <div id="tab-materi-content"  class="${activeTab==='materi'?'':'hidden'}">${renderMateriTab()}</div>
        <div id="tab-peserta-content" class="${activeTab==='peserta'?'':'hidden'}">${renderPesertaTab()}</div>
      </div>

      <div id="el-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div id="el-modal-box" class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"></div>
      </div>
    `
    loadStats()
    loadKursusCache()
    if (activeTab === 'kursus') loadKursus()
    else if (activeTab === 'materi') loadMateri()
    else loadPeserta()
  }

  // ── Stats ─────────────────────────────────────────────────
  const loadStats = async () => {
    try {
      const r = await fetch(API + '/stats')
      const j = await r.json()
      const d = j.data
      document.getElementById('el-stats').innerHTML = [
        ['Total Kursus',   d.total_kursus,    'text-slate-700',   '📚'],
        ['Published',      d.kursus_published,'text-green-600',   '🌐'],
        ['Total Materi',   d.total_materi,    'text-indigo-600',  '🎬'],
        ['Total Peserta',  d.total_peserta,   'text-blue-600',    '👥'],
        ['Selesai',        d.peserta_selesai, 'text-purple-600',  '🏆'],
        ['Rata Progress',  d.rata_progress+'%','text-teal-600',   '📊'],
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

  const loadKursusCache = async () => {
    try {
      const r = await fetch(`${API}/kursus?per_page=100`)
      const j = await r.json()
      kursusList = j.data || []
    } catch(e) {}
  }

  // ── Kursus Tab ────────────────────────────────────────────
  const renderKursusTab = () => `
    <div class="bg-white rounded-xl border border-slate-200">
      <div class="p-4 flex flex-wrap gap-3 border-b border-slate-100">
        <input id="k-search" type="text" placeholder="Cari mata kuliah / dosen..."
          class="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-48"
          oninput="ElearningModule.filterKursus()">
        <select id="k-status" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" onchange="ElearningModule.filterKursus()">
          <option value="">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Arsip</option>
        </select>
        <button onclick="ElearningModule.openCreateKursus()"
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Buat Kursus
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>${['Mata Kuliah','Dosen','TA / Semester','Materi','Peserta','Status','Aksi']
              .map(h=>`<th class="text-left px-4 py-3 text-slate-600 font-semibold">${h}</th>`).join('')}</tr>
          </thead>
          <tbody id="kursus-tbody" class="divide-y divide-slate-100"></tbody>
        </table>
      </div>
      <div id="kursus-pagination" class="p-4 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500"></div>
    </div>`

  let kursusPage = 1
  const loadKursus = async (page=1) => {
    kursusPage = page
    const search = document.getElementById('k-search')?.value || ''
    const status = document.getElementById('k-status')?.value || ''
    try {
      const q = new URLSearchParams({ page, per_page: 20, search, status })
      const r = await fetch(`${API}/kursus?${q}`)
      const j = await r.json()
      const rows = j.data || []
      const tbody = document.getElementById('kursus-tbody')
      if (!tbody) return
      tbody.innerHTML = rows.length ? rows.map(k => `
        <tr class="table-row-hover">
          <td class="px-4 py-3 font-medium text-slate-800">${k.mata_kuliah_nama}</td>
          <td class="px-4 py-3 text-slate-600">${k.dosen_nama}</td>
          <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${k.tahun_akademik} / ${k.semester}</td>
          <td class="px-4 py-3">
            <button onclick="ElearningModule.lihatMateri('${k.id}')" class="text-indigo-600 hover:underline font-medium">
              ${k.jumlah_materi} materi
            </button>
          </td>
          <td class="px-4 py-3">
            <button onclick="ElearningModule.lihatPeserta('${k.id}')" class="text-indigo-600 hover:underline font-medium">
              ${k.jumlah_peserta} peserta
            </button>
          </td>
          <td class="px-4 py-3">${statusBadge(k.status)}</td>
          <td class="px-4 py-3">
            <div class="flex gap-1 flex-wrap">
              <button onclick="ElearningModule.editKursus('${k.id}')" class="text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded">Edit</button>
              ${k.status==='draft' ? `<button onclick="ElearningModule.publishKursus('${k.id}')" class="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded">Publish</button>` : ''}
              ${k.status==='published' ? `<button onclick="ElearningModule.arsipkanKursus('${k.id}')" class="text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 px-2 py-1 rounded">Arsipkan</button>` : ''}
              ${k.status!=='published' ? `<button onclick="ElearningModule.hapusKursus('${k.id}')" class="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded">Hapus</button>` : ''}
            </div>
          </td>
        </tr>`).join('') : `<tr><td colspan="7" class="text-center py-12 text-slate-400">Belum ada kursus</td></tr>`

      const meta = j.meta
      document.getElementById('kursus-pagination').innerHTML = meta ? `
        <span>Total ${meta.total} kursus</span>
        <div class="flex gap-2">
          <button onclick="ElearningModule.loadKursus(${page-1})" ${page<=1?'disabled':''} class="px-3 py-1 border rounded disabled:opacity-40">‹</button>
          <span>${page}/${meta.total_pages}</span>
          <button onclick="ElearningModule.loadKursus(${page+1})" ${page>=meta.total_pages?'disabled':''} class="px-3 py-1 border rounded disabled:opacity-40">›</button>
        </div>` : ''
    } catch(e) { console.error(e) }
  }

  const filterKursus = () => loadKursus(1)

  // ── Materi Tab ────────────────────────────────────────────
  const renderMateriTab = () => `
    <div class="bg-white rounded-xl border border-slate-200">
      <div class="p-4 flex flex-wrap gap-3 border-b border-slate-100">
        <input id="m-search" type="text" placeholder="Cari materi..."
          class="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-48"
          oninput="ElearningModule.filterMateri()">
        <select id="m-kursus" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" onchange="ElearningModule.filterMateri()">
          <option value="">Semua Kursus</option>
        </select>
        <select id="m-tipe" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" onchange="ElearningModule.filterMateri()">
          <option value="">Semua Tipe</option>
          <option value="video">Video</option>
          <option value="dokumen">Dokumen</option>
          <option value="quiz">Quiz</option>
          <option value="tugas">Tugas</option>
        </select>
        <button onclick="ElearningModule.openCreateMateri()"
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Tambah Materi
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>${['#','Judul Materi','Kursus','Tipe','Durasi','Status','Aksi']
              .map(h=>`<th class="text-left px-4 py-3 text-slate-600 font-semibold">${h}</th>`).join('')}</tr>
          </thead>
          <tbody id="materi-tbody" class="divide-y divide-slate-100"></tbody>
        </table>
      </div>
      <div id="materi-pagination" class="p-4 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500"></div>
    </div>`

  let materiPage = 1
  const fillKursusSelect = (selectId) => {
    const el = document.getElementById(selectId)
    if (!el) return
    const prefix = selectId.includes('m-kursus') || selectId.includes('e-kursus')
      ? '<option value="">Semua Kursus</option>'
      : '<option value="">-- Pilih Kursus --</option>'
    el.innerHTML = prefix + kursusList.map(k => `<option value="${k.id}">${k.mata_kuliah_nama} (${k.tahun_akademik})</option>`).join('')
  }

  const loadMateri = async (page=1) => {
    materiPage = page
    fillKursusSelect('m-kursus')
    const search  = document.getElementById('m-search')?.value || ''
    const kursusId = document.getElementById('m-kursus')?.value || ''
    const tipe    = document.getElementById('m-tipe')?.value || ''
    try {
      const q = new URLSearchParams({ page, per_page: 30, search, kursus_id: kursusId, tipe })
      const r = await fetch(`${API}/materi?${q}`)
      const j = await r.json()
      const rows = j.data || []
      const tbody = document.getElementById('materi-tbody')
      if (!tbody) return
      tbody.innerHTML = rows.length ? rows.map(m => {
        const kursus = kursusList.find(k=>k.id===m.kursus_id)
        return `
        <tr class="table-row-hover">
          <td class="px-4 py-3 text-slate-400 text-center">${m.urutan}</td>
          <td class="px-4 py-3 font-medium text-slate-800">${m.judul}</td>
          <td class="px-4 py-3 text-slate-600 text-xs">${kursus?.mata_kuliah_nama||m.kursus_id}</td>
          <td class="px-4 py-3">${tipeBadge(m.tipe)}</td>
          <td class="px-4 py-3 text-slate-600">${m.durasi_menit ? m.durasi_menit+' mnt' : '-'}</td>
          <td class="px-4 py-3">
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${m.is_published?'bg-green-100 text-green-700':'bg-slate-100 text-slate-500'}">
              ${m.is_published?'Publik':'Draft'}
            </span>
          </td>
          <td class="px-4 py-3">
            <div class="flex gap-1">
              <button onclick="ElearningModule.editMateri('${m.id}')" class="text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded">Edit</button>
              <button onclick="ElearningModule.hapusMateri('${m.id}')" class="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded">Hapus</button>
            </div>
          </td>
        </tr>`}).join('') : `<tr><td colspan="7" class="text-center py-12 text-slate-400">Belum ada materi</td></tr>`

      const meta = j.meta
      document.getElementById('materi-pagination').innerHTML = meta ? `
        <span>Total ${meta.total} materi</span>
        <div class="flex gap-2">
          <button onclick="ElearningModule.loadMateri(${page-1})" ${page<=1?'disabled':''} class="px-3 py-1 border rounded disabled:opacity-40">‹</button>
          <span>${page}/${meta.total_pages}</span>
          <button onclick="ElearningModule.loadMateri(${page+1})" ${page>=meta.total_pages?'disabled':''} class="px-3 py-1 border rounded disabled:opacity-40">›</button>
        </div>` : ''
    } catch(e) { console.error(e) }
  }

  const filterMateri = () => loadMateri(1)

  // ── Peserta Tab ───────────────────────────────────────────
  const renderPesertaTab = () => `
    <div class="bg-white rounded-xl border border-slate-200">
      <div class="p-4 flex flex-wrap gap-3 border-b border-slate-100">
        <input id="e-search" type="text" placeholder="Cari nama / NIM..."
          class="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-48"
          oninput="ElearningModule.filterPeserta()">
        <select id="e-kursus" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" onchange="ElearningModule.filterPeserta()">
          <option value="">Semua Kursus</option>
        </select>
        <select id="e-status" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" onchange="ElearningModule.filterPeserta()">
          <option value="">Semua Status</option>
          <option value="aktif">Aktif</option>
          <option value="selesai">Selesai</option>
        </select>
        <button onclick="ElearningModule.openEnroll()"
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Tambah Peserta
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>${['Mahasiswa','Kursus','Progress','Status','Tgl Daftar','Tgl Selesai','Aksi']
              .map(h=>`<th class="text-left px-4 py-3 text-slate-600 font-semibold">${h}</th>`).join('')}</tr>
          </thead>
          <tbody id="peserta-tbody" class="divide-y divide-slate-100"></tbody>
        </table>
      </div>
      <div id="peserta-pagination" class="p-4 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500"></div>
    </div>`

  let pesertaPage = 1
  const loadPeserta = async (page=1) => {
    pesertaPage = page
    fillKursusSelect('e-kursus')
    const search  = document.getElementById('e-search')?.value || ''
    const kursusId = document.getElementById('e-kursus')?.value || ''
    const status  = document.getElementById('e-status')?.value || ''
    try {
      const q = new URLSearchParams({ page, per_page: 20, search, kursus_id: kursusId, status })
      const r = await fetch(`${API}/enrollment?${q}`)
      const j = await r.json()
      const rows = j.data || []
      const tbody = document.getElementById('peserta-tbody')
      if (!tbody) return
      tbody.innerHTML = rows.length ? rows.map(e => `
        <tr class="table-row-hover">
          <td class="px-4 py-3">
            <p class="font-medium text-slate-800">${e.mahasiswa_nama}</p>
            <p class="text-xs text-slate-400">${e.mahasiswa_nim}</p>
          </td>
          <td class="px-4 py-3 text-slate-600 text-xs max-w-40 truncate">${e.mata_kuliah_nama}</td>
          <td class="px-4 py-3 min-w-32">${progressBar(e.progress_persen||0)}</td>
          <td class="px-4 py-3">
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${e.status==='selesai'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}">
              ${e.status==='selesai'?'Selesai':'Aktif'}
            </span>
          </td>
          <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${fmtDate(e.tgl_enroll)}</td>
          <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${fmtDate(e.tgl_selesai)}</td>
          <td class="px-4 py-3">
            <div class="flex gap-1">
              <button onclick="ElearningModule.updateProgress('${e.id}', ${e.progress_persen||0})" class="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded">Progress</button>
              <button onclick="ElearningModule.hapusEnrollment('${e.id}')" class="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded">Hapus</button>
            </div>
          </td>
        </tr>`).join('') : `<tr><td colspan="7" class="text-center py-12 text-slate-400">Belum ada peserta</td></tr>`

      const meta = j.meta
      document.getElementById('peserta-pagination').innerHTML = meta ? `
        <span>Total ${meta.total} peserta</span>
        <div class="flex gap-2">
          <button onclick="ElearningModule.loadPeserta(${page-1})" ${page<=1?'disabled':''} class="px-3 py-1 border rounded disabled:opacity-40">‹</button>
          <span>${page}/${meta.total_pages}</span>
          <button onclick="ElearningModule.loadPeserta(${page+1})" ${page>=meta.total_pages?'disabled':''} class="px-3 py-1 border rounded disabled:opacity-40">›</button>
        </div>` : ''
    } catch(e) { console.error(e) }
  }

  const filterPeserta = () => loadPeserta(1)

  // ── Switch Tab ────────────────────────────────────────────
  const switchTab = (tab) => {
    activeTab = tab
    ;['kursus','materi','peserta'].forEach(t => {
      document.getElementById(`tab-${t}`).className =
        `tab-btn px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          t===tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`
      document.getElementById(`tab-${t}-content`).classList.toggle('hidden', t!==tab)
    })
    if (tab==='kursus') loadKursus()
    else if (tab==='materi') loadMateri()
    else loadPeserta()
  }

  const lihatMateri  = (kursusId) => { switchTab('materi');  setTimeout(() => { const el=document.getElementById('m-kursus'); if(el){el.value=kursusId; loadMateri(1)} }, 200) }
  const lihatPeserta = (kursusId) => { switchTab('peserta'); setTimeout(() => { const el=document.getElementById('e-kursus'); if(el){el.value=kursusId; loadPeserta(1)} }, 200) }

  // ── Modal helpers ─────────────────────────────────────────
  const openModal = (html) => {
    document.getElementById('el-modal-box').innerHTML = html
    document.getElementById('el-modal').classList.remove('hidden')
  }
  const closeModal = () => document.getElementById('el-modal').classList.add('hidden')

  // ── Kursus Modals ─────────────────────────────────────────
  const kursusForm = (k={}) => `
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-slate-800">${k.id ? 'Edit Kursus' : 'Buat Kursus Baru'}</h3>
        <button onclick="ElearningModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
      </div>
      <form id="kursus-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Mata Kuliah</label>
          <input name="mata_kuliah_nama" required value="${k.mata_kuliah_nama||''}" placeholder="Nama mata kuliah"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Dosen</label>
          <input name="dosen_nama" required value="${k.dosen_nama||''}" placeholder="Nama dosen pengampu"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Tahun Akademik</label>
            <input name="tahun_akademik" required value="${k.tahun_akademik||''}" placeholder="2025/2026"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Semester</label>
            <select name="semester" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              ${['Ganjil','Genap'].map(s=>`<option value="${s}" ${k.semester===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Deskripsi</label>
          <textarea name="deskripsi" rows="3" placeholder="Deskripsi singkat kursus..."
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">${k.deskripsi||''}</textarea>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium">
            ${k.id ? 'Simpan' : 'Buat Kursus'}
          </button>
          <button type="button" onclick="ElearningModule.closeModal()" class="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm">Batal</button>
        </div>
      </form>
    </div>`

  const openCreateKursus = () => {
    openModal(kursusForm())
    document.getElementById('kursus-form').onsubmit = (e) => saveKursus(e)
  }

  const editKursus = (id) => {
    const k = kursusList.find(x=>x.id===id) || {}
    openModal(kursusForm(k))
    document.getElementById('kursus-form').onsubmit = (e) => saveKursus(e, id)
  }

  const saveKursus = async (e, id=null) => {
    e.preventDefault()
    const body = Object.fromEntries(new FormData(e.target))
    try {
      const r = await fetch(id ? `${API}/kursus/${id}` : `${API}/kursus`, {
        method: id ? 'PUT' : 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      closeModal(); loadKursus(kursusPage); loadKursusCache(); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const hapusKursus = async (id) => {
    if (!confirm('Hapus kursus ini?')) return
    try {
      const r = await fetch(`${API}/kursus/${id}`, { method:'DELETE' })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      loadKursus(kursusPage); loadKursusCache(); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const publishKursus = async (id) => {
    try {
      const r = await fetch(`${API}/kursus/${id}/publish`, { method:'POST' })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      loadKursus(kursusPage); loadKursusCache(); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const arsipkanKursus = async (id) => {
    if (!confirm('Arsipkan kursus ini? Mahasiswa tidak bisa enroll kursus yang diarsipkan.')) return
    try {
      const r = await fetch(`${API}/kursus/${id}/arsipkan`, { method:'POST' })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      loadKursus(kursusPage); loadKursusCache(); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  // ── Materi Modals ─────────────────────────────────────────
  const materiForm = (m={}) => {
    const kursusOpts = kursusList.map(k =>
      `<option value="${k.id}" ${m.kursus_id===k.id?'selected':''}>${k.mata_kuliah_nama} (${k.tahun_akademik})</option>`).join('')
    return `
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-slate-800">${m.id ? 'Edit Materi' : 'Tambah Materi'}</h3>
        <button onclick="ElearningModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
      </div>
      <form id="materi-form" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Kursus</label>
          <select name="kursus_id" required id="materi-kursus-sel" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">-- Pilih Kursus --</option>${kursusOpts}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Tipe</label>
            <select name="tipe" id="materi-tipe-sel" onchange="ElearningModule.onTipeChange()" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              ${['video','dokumen','quiz','tugas'].map(t=>`<option value="${t}" ${m.tipe===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Urutan</label>
            <input name="urutan" type="number" min="1" value="${m.urutan||1}"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Judul Materi</label>
          <input name="judul" required value="${m.judul||''}" placeholder="Judul materi"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
        </div>
        <div id="url-field">
          <label class="block text-sm font-medium text-slate-700 mb-1">URL / Link</label>
          <input name="url" value="${m.url||''}" placeholder="https://..."
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
        </div>
        <div id="durasi-field">
          <label class="block text-sm font-medium text-slate-700 mb-1">Durasi (menit)</label>
          <input name="durasi_menit" type="number" min="1" value="${m.durasi_menit||''}" placeholder="30"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Deskripsi</label>
          <textarea name="deskripsi" rows="2" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">${m.deskripsi||''}</textarea>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium">
            ${m.id ? 'Simpan' : 'Tambah'}
          </button>
          <button type="button" onclick="ElearningModule.closeModal()" class="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm">Batal</button>
        </div>
      </form>
    </div>`
  }

  const onTipeChange = () => {
    const tipe = document.getElementById('materi-tipe-sel')?.value
    const durasiFld = document.getElementById('durasi-field')
    const urlFld    = document.getElementById('url-field')
    if (durasiFld) durasiFld.classList.toggle('hidden', tipe !== 'video')
    if (urlFld)    urlFld.classList.toggle('hidden', tipe === 'quiz')
  }

  const openCreateMateri = () => {
    openModal(materiForm())
    document.getElementById('materi-form').onsubmit = (e) => saveMateri(e)
    onTipeChange()
  }

  const editMateri = async (id) => {
    const r = await fetch(`${API}/materi?per_page=200`)
    const j = await r.json()
    const m = (j.data||[]).find(x=>x.id===id) || {}
    openModal(materiForm(m))
    document.getElementById('materi-form').onsubmit = (e) => saveMateri(e, id)
    onTipeChange()
  }

  const saveMateri = async (e, id=null) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = Object.fromEntries(fd)
    body.urutan = parseInt(body.urutan) || 1
    if (body.durasi_menit) body.durasi_menit = parseInt(body.durasi_menit)
    else delete body.durasi_menit
    body.is_published = true
    const kursusId = body.kursus_id
    delete body.kursus_id
    try {
      const url  = id ? `${API}/materi/${id}` : `${API}/kursus/${kursusId}/materi`
      const meth = id ? 'PUT' : 'POST'
      const r = await fetch(url, { method:meth, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      closeModal(); loadMateri(materiPage); loadKursusCache(); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const hapusMateri = async (id) => {
    if (!confirm('Hapus materi ini?')) return
    try {
      const r = await fetch(`${API}/materi/${id}`, { method:'DELETE' })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      loadMateri(materiPage); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  // ── Enrollment Modals ─────────────────────────────────────
  const openEnroll = () => {
    const kursusOpts = kursusList.filter(k=>k.status==='published').map(k =>
      `<option value="${k.id}">${k.mata_kuliah_nama} (${k.tahun_akademik})</option>`).join('')
    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-slate-800">Tambah Peserta</h3>
          <button onclick="ElearningModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>
        <form id="enroll-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Kursus</label>
            <select name="kursus_id" required class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih Kursus --</option>${kursusOpts}
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
          <div class="flex gap-3 pt-2">
            <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium">Daftarkan</button>
            <button type="button" onclick="ElearningModule.closeModal()" class="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm">Batal</button>
          </div>
        </form>
      </div>`)
    document.getElementById('enroll-form').onsubmit = saveEnroll
  }

  const saveEnroll = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const body = Object.fromEntries(fd)
    const kursusId = body.kursus_id
    delete body.kursus_id
    body.mahasiswa_id = `mhs-${body.mahasiswa_nim}`
    try {
      const r = await fetch(`${API}/kursus/${kursusId}/enroll`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      closeModal(); loadPeserta(pesertaPage); loadKursusCache(); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const updateProgress = (id, current) => {
    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-slate-800">Update Progress</h3>
          <button onclick="ElearningModule.closeModal()" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Progress: <span id="prog-val">${current}</span>%</label>
            <input type="range" id="prog-slider" min="0" max="100" step="25" value="${current}"
              class="w-full" oninput="document.getElementById('prog-val').textContent=this.value">
          </div>
          <div class="flex gap-3">
            <button onclick="ElearningModule.submitProgress('${id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium">Simpan</button>
            <button onclick="ElearningModule.closeModal()" class="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm">Batal</button>
          </div>
        </div>
      </div>`)
  }

  const submitProgress = async (id) => {
    const pct = parseInt(document.getElementById('prog-slider')?.value || 0)
    try {
      const r = await fetch(`${API}/enrollment/${id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ progress_persen: pct }),
      })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      closeModal(); loadPeserta(pesertaPage); loadStats()
      UI.toast('Progress diperbarui', 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  const hapusEnrollment = async (id) => {
    if (!confirm('Hapus peserta dari kursus ini?')) return
    try {
      const r = await fetch(`${API}/enrollment/${id}`, { method:'DELETE' })
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      loadPeserta(pesertaPage); loadKursusCache(); loadStats()
      UI.toast(j.message, 'success')
    } catch(err) { UI.toast(err.message, 'error') }
  }

  return {
    render, switchTab,
    filterKursus, loadKursus,
    filterMateri, loadMateri,
    filterPeserta, loadPeserta,
    lihatMateri, lihatPeserta,
    openCreateKursus, editKursus, saveKursus, hapusKursus,
    publishKursus, arsipkanKursus,
    openCreateMateri, editMateri, saveMateri, hapusMateri,
    onTipeChange,
    openEnroll, saveEnroll, updateProgress, submitProgress, hapusEnrollment,
    closeModal,
  }
})()
