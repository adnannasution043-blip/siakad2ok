// ============================================================
// KEUANGAN.JS — Tagihan, Pembayaran & Laporan
// ============================================================
const KeuanganModule = (() => {

  let state = {
    tab: 'tagihan',
    semesters: [],
    ringkasan: null,
    // tagihan
    tagihanList: [], tagihanMeta: null, tagihanPage: 1,
    tagihanSearch: '', tagihanStatus: '', tagihanSem: '', tagihanJenis: '',
    // pembayaran
    pmbList: [], pmbMeta: null, pmbPage: 1,
    pmbSearch: '', pmbStatus: '', pmbMetode: '',
  }

  const fmt = (n) => 'Rp ' + (n || 0).toLocaleString('id-ID')

  // ── FETCH ──────────────────────────────────────────────────
  const fetchSemesters = async () => {
    if (state.semesters.length) return
    const res = await API.get('/keuangan/tagihan/semesters')
    state.semesters = res.data || []
    if (!state.tagihanSem && state.semesters.length)
      state.tagihanSem = state.semesters[0]
  }

  const fetchRingkasan = async () => {
    const res = await API.get('/keuangan/ringkasan', { semester_akademik: state.tagihanSem })
    state.ringkasan = res.data
    renderRingkasan()
  }

  const fetchTagihan = async () => {
    const res = await API.get('/keuangan/tagihan', {
      page: state.tagihanPage, per_page: 20,
      search: state.tagihanSearch, status: state.tagihanStatus,
      semester_akademik: state.tagihanSem, jenis: state.tagihanJenis,
    })
    state.tagihanList = res.data || []
    state.tagihanMeta = res.meta
    renderTagihanTable()
  }

  const fetchPembayaran = async () => {
    const res = await API.get('/keuangan/pembayaran', {
      page: state.pmbPage, per_page: 20,
      search: state.pmbSearch, status: state.pmbStatus, metode: state.pmbMetode,
    })
    state.pmbList = res.data || []
    state.pmbMeta = res.meta
    renderPmbTable()
  }

  // ── RENDER MAIN ────────────────────────────────────────────
  const render = async () => {
    Router.setPageMeta('Keuangan', 'Tagihan dan pembayaran mahasiswa')
    await fetchSemesters()

    document.getElementById('page-content').innerHTML = `
      <!-- Ringkasan cards -->
      <div id="keu-ringkasan" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5"></div>

      <!-- Tabs -->
      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-5">
        <button id="tab-tagihan"    onclick="KeuanganModule.switchTab('tagihan')"
          class="tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-all">Tagihan</button>
        <button id="tab-pembayaran" onclick="KeuanganModule.switchTab('pembayaran')"
          class="tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-all">Riwayat Bayar</button>
        <button id="tab-laporan"    onclick="KeuanganModule.switchTab('laporan')"
          class="tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-all">Laporan</button>
      </div>

      <div id="tab-content-tagihan"></div>
      <div id="tab-content-pembayaran" class="hidden"></div>
      <div id="tab-content-laporan"    class="hidden"></div>

      <!-- Modal: Buat Tagihan -->
      <div id="tagihan-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" onclick="KeuanganModule.closeTagihanModal()"></div>
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div class="px-6 py-4 border-b flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-800">Buat Tagihan</h3>
            <button onclick="KeuanganModule.closeTagihanModal()" class="text-slate-400 hover:text-slate-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <form id="tagihan-form" onsubmit="KeuanganModule.submitTagihan(event)" class="px-6 py-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Mahasiswa</label>
              <select id="tagihan-mhs" name="mahasiswa_id" required
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                <option value="">— Pilih Mahasiswa —</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Jenis</label>
                <select name="jenis"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                  <option value="SPP">SPP</option>
                  <option value="SKS">SKS</option>
                  <option value="Ujian">Ujian</option>
                  <option value="Wisuda">Wisuda</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Semester</label>
                <input type="text" name="semester_akademik" placeholder="cth: 2025/2026-1"
                  value="${state.tagihanSem}"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" required/>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Jumlah (Rp)</label>
                <input type="number" name="jumlah" min="0" step="1000" placeholder="4000000" required
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Jatuh Tempo</label>
                <input type="date" name="jatuh_tempo"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Keterangan</label>
              <input type="text" name="keterangan" placeholder="Opsional"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            </div>
            <div class="flex gap-3 pt-2">
              <button type="button" onclick="KeuanganModule.closeTagihanModal()"
                class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button>
              <button type="submit" class="flex-1 btn-primary px-4 py-2 rounded-lg text-sm font-medium">Buat</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal: Generate Massal -->
      <div id="massal-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" onclick="KeuanganModule.closeMassalModal()"></div>
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div class="px-6 py-4 border-b flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-800">Generate Tagihan Massal</h3>
            <button onclick="KeuanganModule.closeMassalModal()" class="text-slate-400 hover:text-slate-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <form id="massal-form" onsubmit="KeuanganModule.submitMassal(event)" class="px-6 py-4 space-y-4">
            <p class="text-sm text-slate-500">Generate tagihan untuk semua mahasiswa aktif sekaligus. Mahasiswa yang sudah memiliki tagihan di semester/jenis yang sama akan dilewati.</p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Jenis</label>
                <select name="jenis"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                  <option value="SPP">SPP</option>
                  <option value="SKS">SKS</option>
                  <option value="Ujian">Ujian</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Semester</label>
                <input type="text" name="semester_akademik" placeholder="cth: 2025/2026-1"
                  value="${state.tagihanSem}"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" required/>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Jumlah per Mahasiswa (Rp)</label>
                <input type="number" name="jumlah" min="0" step="1000" placeholder="4000000" required
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Jatuh Tempo</label>
                <input type="date" name="jatuh_tempo"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
              </div>
            </div>
            <div class="flex gap-3 pt-2">
              <button type="button" onclick="KeuanganModule.closeMassalModal()"
                class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button>
              <button type="submit" class="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">Generate</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal: Input Pembayaran -->
      <div id="bayar-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" onclick="KeuanganModule.closeBayarModal()"></div>
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div class="px-6 py-4 border-b flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-800">Input Pembayaran</h3>
            <button onclick="KeuanganModule.closeBayarModal()" class="text-slate-400 hover:text-slate-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <form id="bayar-form" onsubmit="KeuanganModule.submitBayar(event)" class="px-6 py-4 space-y-4">
            <div id="bayar-tagihan-info" class="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 space-y-1"></div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Jumlah Dibayar (Rp)</label>
                <input id="bayar-jumlah" type="number" name="jumlah" min="0" step="1000" required
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Metode</label>
                <select name="metode"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                  <option value="transfer">Transfer Bank</option>
                  <option value="qris">QRIS</option>
                  <option value="tunai">Tunai</option>
                  <option value="va">Virtual Account</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Kode Transaksi</label>
                <input type="text" name="kode_transaksi" placeholder="Otomatis jika kosong"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Tanggal Bayar</label>
                <input type="datetime-local" name="tgl_bayar"
                  value="${new Date().toISOString().slice(0,16)}"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Keterangan</label>
              <input type="text" name="keterangan" placeholder="Opsional"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
            </div>
            <div class="flex gap-3 pt-2">
              <button type="button" onclick="KeuanganModule.closeBayarModal()"
                class="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Batal</button>
              <button type="submit" class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">Konfirmasi Bayar</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal: Detail Tagihan -->
      <div id="detail-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" onclick="KeuanganModule.closeDetailModal()"></div>
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
          <div class="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
            <h3 class="text-lg font-semibold text-slate-800">Detail Tagihan</h3>
            <button onclick="KeuanganModule.closeDetailModal()" class="text-slate-400 hover:text-slate-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div id="detail-content" class="px-6 py-4"></div>
        </div>
      </div>
    `

    switchTab(state.tab)
    await fetchRingkasan()
  }

  // ── TAB SWITCH ─────────────────────────────────────────────
  const switchTab = (tab) => {
    state.tab = tab
    ;['tagihan', 'pembayaran', 'laporan'].forEach(t => {
      const btn = document.getElementById(`tab-${t}`)
      const content = document.getElementById(`tab-content-${t}`)
      if (!btn || !content) return
      const active = t === tab
      btn.className = `tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-all ${active ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`
      content.classList.toggle('hidden', !active)
    })
    if (tab === 'tagihan')    renderTagihanView()
    if (tab === 'pembayaran') renderPembayaranView()
    if (tab === 'laporan')    renderLaporanView()
  }

  // ── RINGKASAN CARDS ────────────────────────────────────────
  const renderRingkasan = () => {
    const r = state.ringkasan || {}
    document.getElementById('keu-ringkasan').innerHTML = [
      { label: 'Total Tagihan',    val: r.total_tagihan || 0,      sub: fmt(r.nominal_total),   color: 'text-slate-700',  bg: 'bg-slate-50'  },
      { label: 'Lunas',            val: r.tagihan_lunas || 0,       sub: fmt(r.nominal_lunas),   color: 'text-green-600',  bg: 'bg-green-50'  },
      { label: 'Belum Lunas',      val: r.tagihan_belum_lunas || 0, sub: fmt(r.nominal_belum),   color: 'text-red-600',    bg: 'bg-red-50'    },
      { label: 'Masuk Bulan Ini',  val: fmt(r.masuk_bulan_ini),     sub: `${r.total_pembayaran || 0} transaksi`,  color: 'text-indigo-600', bg: 'bg-indigo-50' },
    ].map(c => `
      <div class="${c.bg} rounded-xl p-4 flex flex-col gap-1">
        <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">${c.label}</span>
        <span class="text-2xl font-bold ${c.color}">${c.val}</span>
        ${c.sub ? `<span class="text-xs text-slate-400">${c.sub}</span>` : ''}
      </div>`).join('')
  }

  // ── TAGIHAN TAB ────────────────────────────────────────────
  const renderTagihanView = () => {
    document.getElementById('tab-content-tagihan').innerHTML = `
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div class="flex-1 min-w-48">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" placeholder="Cari nama atau NIM..." value="${state.tagihanSearch}"
              class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              oninput="KeuanganModule.onTagihanSearch(this.value)"/>
          </div>
        </div>
        <select onchange="KeuanganModule.onTagihanFilter('tagihanSem', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Semester</option>
          ${state.semesters.map(s => `<option value="${s}" ${state.tagihanSem===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <select onchange="KeuanganModule.onTagihanFilter('tagihanStatus', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Status</option>
          <option value="lunas">Lunas</option>
          <option value="belum_lunas">Belum Lunas</option>
          <option value="cicilan">Cicilan</option>
        </select>
        <select onchange="KeuanganModule.onTagihanFilter('tagihanJenis', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Jenis</option>
          <option value="SPP">SPP</option>
          <option value="SKS">SKS</option>
          <option value="Ujian">Ujian</option>
          <option value="Wisuda">Wisuda</option>
        </select>
        <div class="flex gap-2">
          <button onclick="KeuanganModule.openTagihanModal()"
            class="btn-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Buat Tagihan
          </button>
          <button onclick="KeuanganModule.openMassalModal()"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
            </svg>
            Generate Massal
          </button>
        </div>
      </div>
      ${UI.card(`<div id="tagihan-table-wrap"></div><div id="tagihan-pagination"></div>`)}
    `
    fetchTagihan()
  }

  const statusBadge = (s) => {
    const map = { lunas: 'bg-green-100 text-green-700', belum_lunas: 'bg-red-100 text-red-700', cicilan: 'bg-amber-100 text-amber-700', dibatalkan: 'bg-slate-100 text-slate-500' }
    const label = { lunas: 'Lunas', belum_lunas: 'Belum Lunas', cicilan: 'Cicilan', dibatalkan: 'Dibatalkan' }
    return `<span class="badge ${map[s] || 'bg-slate-100 text-slate-600'}">${label[s] || s}</span>`
  }

  const renderTagihanTable = () => {
    const el = document.getElementById('tagihan-table-wrap')
    if (!el) return
    el.innerHTML = UI.renderTable({
      headers: ['Mahasiswa', 'Semester', 'Jenis', 'Jumlah', 'Jatuh Tempo', 'Status', 'Aksi'],
      emptyText: 'Tidak ada data tagihan',
      rows: state.tagihanList.map(t => {
        const overdue = t.status === 'belum_lunas' && t.jatuh_tempo && new Date(t.jatuh_tempo) < new Date()
        return `
          <td class="px-4 py-3">
            <div class="font-medium text-slate-800 text-sm">${t.mahasiswa_nama}</div>
            <div class="text-xs text-slate-400 font-mono">${t.mahasiswa_nim}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">${t.semester_akademik}</td>
          <td class="px-4 py-3 text-sm text-slate-600">${t.jenis}</td>
          <td class="px-4 py-3 text-sm font-semibold text-slate-800">${fmt(t.jumlah)}</td>
          <td class="px-4 py-3 text-sm ${overdue ? 'text-red-600 font-medium' : 'text-slate-500'}">
            ${t.jatuh_tempo || '—'}${overdue ? ' ⚠' : ''}
          </td>
          <td class="px-4 py-3">${statusBadge(t.status)}</td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-center gap-1">
              <button onclick="KeuanganModule.openDetail('${t.id}')"
                title="Detail" class="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </button>
              ${t.status !== 'lunas' && t.status !== 'dibatalkan' ? `
                <button onclick="KeuanganModule.openBayar('${t.id}', '${t.mahasiswa_nama.replace(/'/g,"\\'")}', ${t.jumlah}, '${t.jenis}', '${t.semester_akademik}')"
                  title="Input pembayaran" class="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                </button>` : ''}
            </div>
          </td>`
      })
    })
    document.getElementById('tagihan-pagination').innerHTML =
      UI.renderPagination(state.tagihanMeta, 'KeuanganModule.goTagihanPage')
  }

  // ── PEMBAYARAN TAB ─────────────────────────────────────────
  const renderPembayaranView = () => {
    document.getElementById('tab-content-pembayaran').innerHTML = `
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div class="flex-1 min-w-48">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" placeholder="Cari kode transaksi atau nama..." value="${state.pmbSearch}"
              class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              oninput="KeuanganModule.onPmbSearch(this.value)"/>
          </div>
        </div>
        <select onchange="KeuanganModule.onPmbFilter('pmbStatus', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Status</option>
          <option value="sukses">Sukses</option>
          <option value="dibatalkan">Dibatalkan</option>
        </select>
        <select onchange="KeuanganModule.onPmbFilter('pmbMetode', this.value)"
          class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
          <option value="">Semua Metode</option>
          <option value="transfer">Transfer</option>
          <option value="qris">QRIS</option>
          <option value="tunai">Tunai</option>
          <option value="va">Virtual Account</option>
        </select>
      </div>
      ${UI.card(`<div id="pmb-table-wrap"></div><div id="pmb-pagination"></div>`)}
    `
    fetchPembayaran()
  }

  const renderPmbTable = () => {
    const el = document.getElementById('pmb-table-wrap')
    if (!el) return
    const metodeBadge = (m) => {
      const map = { transfer: 'bg-blue-100 text-blue-700', qris: 'bg-purple-100 text-purple-700', tunai: 'bg-green-100 text-green-700', va: 'bg-indigo-100 text-indigo-700' }
      return `<span class="badge ${map[m] || 'bg-slate-100 text-slate-600'}">${m || '—'}</span>`
    }
    el.innerHTML = UI.renderTable({
      headers: ['Mahasiswa', 'Kode Transaksi', 'Jumlah', 'Metode', 'Tanggal', 'Status', 'Aksi'],
      emptyText: 'Tidak ada riwayat pembayaran',
      rows: state.pmbList.map(p => `
        <td class="px-4 py-3">
          <div class="text-sm font-medium text-slate-800">${p.mahasiswa_nama || '—'}</div>
          <div class="text-xs text-slate-400 font-mono">${p.mahasiswa_nim || ''}</div>
        </td>
        <td class="px-4 py-3 text-sm font-mono text-slate-600">${p.kode_transaksi}</td>
        <td class="px-4 py-3 text-sm font-semibold text-slate-800">${fmt(p.jumlah)}</td>
        <td class="px-4 py-3">${metodeBadge(p.metode)}</td>
        <td class="px-4 py-3 text-sm text-slate-500">
          ${p.tgl_bayar ? new Date(p.tgl_bayar).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'}) : '—'}
        </td>
        <td class="px-4 py-3">
          ${p.status === 'sukses'
            ? '<span class="badge bg-green-100 text-green-700">Sukses</span>'
            : '<span class="badge bg-slate-100 text-slate-500">Dibatalkan</span>'}
        </td>
        <td class="px-4 py-3 text-center">
          ${p.status === 'sukses' ? `
            <button onclick="KeuanganModule.batalkanPmb('${p.id}', '${p.kode_transaksi}')"
              title="Batalkan" class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>` : '—'}
        </td>`)
    })
    document.getElementById('pmb-pagination').innerHTML =
      UI.renderPagination(state.pmbMeta, 'KeuanganModule.goPmbPage')
  }

  // ── LAPORAN TAB ────────────────────────────────────────────
  const renderLaporanView = () => {
    const r = state.ringkasan || {}
    const lunas  = r.nominal_lunas  || 0
    const belum  = r.nominal_belum  || 0
    const total  = r.nominal_total  || 1
    const pctLunas = Math.round(lunas / total * 100)
    const pctBelum = Math.round(belum / total * 100)

    document.getElementById('tab-content-laporan').innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        ${UI.card(`
          <h3 class="text-sm font-semibold text-slate-700 mb-4">Realisasi Penerimaan</h3>
          <div class="space-y-3">
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-slate-600">Lunas</span>
                <span class="font-medium text-green-600">${fmt(lunas)} (${pctLunas}%)</span>
              </div>
              <div class="bg-slate-100 rounded-full h-3 overflow-hidden">
                <div class="bg-green-500 h-3 rounded-full" style="width:${pctLunas}%"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-slate-600">Belum Lunas</span>
                <span class="font-medium text-red-500">${fmt(belum)} (${pctBelum}%)</span>
              </div>
              <div class="bg-slate-100 rounded-full h-3 overflow-hidden">
                <div class="bg-red-400 h-3 rounded-full" style="width:${pctBelum}%"></div>
              </div>
            </div>
          </div>
          <div class="mt-4 pt-4 border-t flex justify-between text-sm">
            <span class="text-slate-500">Total Target</span>
            <span class="font-bold text-slate-800">${fmt(total)}</span>
          </div>
        `)}

        ${UI.card(`
          <h3 class="text-sm font-semibold text-slate-700 mb-4">Statistik Tagihan</h3>
          <div class="space-y-3">
            ${[
              { label: 'Total Tagihan', val: r.total_tagihan || 0, color: 'text-slate-700' },
              { label: 'Lunas',         val: r.tagihan_lunas || 0, color: 'text-green-600' },
              { label: 'Cicilan',       val: r.tagihan_cicilan || 0, color: 'text-amber-600' },
              { label: 'Belum Lunas',   val: r.tagihan_belum_lunas || 0, color: 'text-red-600' },
              { label: 'Total Transaksi', val: r.total_pembayaran || 0, color: 'text-indigo-600' },
              { label: 'Masuk Bulan Ini', val: fmt(r.masuk_bulan_ini), color: 'text-indigo-600' },
            ].map(item => `
              <div class="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                <span class="text-sm text-slate-500">${item.label}</span>
                <span class="text-sm font-semibold ${item.color}">${item.val}</span>
              </div>`).join('')}
          </div>
        `)}
      </div>
    `
  }

  // ── MODAL: TAGIHAN ─────────────────────────────────────────
  const openTagihanModal = async () => {
    const sel = document.getElementById('tagihan-mhs')
    if (sel && sel.options.length <= 1) {
      const res = await API.get('/mahasiswa', { per_page: 500, status: 'aktif' })
      sel.innerHTML = `<option value="">— Pilih Mahasiswa —</option>` +
        (res.data || []).map(m => `<option value="${m.id}">${m.nama_lengkap} (${m.nim})</option>`).join('')
    }
    document.getElementById('tagihan-form').reset()
    document.getElementById('tagihan-modal').classList.remove('hidden')
  }
  const closeTagihanModal = () => document.getElementById('tagihan-modal').classList.add('hidden')

  const submitTagihan = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const btn = e.target.querySelector('[type="submit"]')
    btn.disabled = true
    try {
      await API.post('/keuangan/tagihan', {
        mahasiswa_id:    fd.get('mahasiswa_id'),
        semester_akademik: fd.get('semester_akademik'),
        jenis:           fd.get('jenis'),
        jumlah:          parseFloat(fd.get('jumlah')),
        jatuh_tempo:     fd.get('jatuh_tempo') || null,
        keterangan:      fd.get('keterangan') || null,
      })
      UI.toast('Tagihan berhasil dibuat', 'success')
      closeTagihanModal()
      await Promise.all([fetchTagihan(), fetchRingkasan()])
    } catch(err) {
      UI.toast(err.message || 'Gagal membuat tagihan', 'error')
    } finally { btn.disabled = false }
  }

  // ── MODAL: GENERATE MASSAL ─────────────────────────────────
  const openMassalModal = () => {
    document.getElementById('massal-form').reset()
    document.getElementById('massal-modal').classList.remove('hidden')
  }
  const closeMassalModal = () => document.getElementById('massal-modal').classList.add('hidden')

  const submitMassal = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const btn = e.target.querySelector('[type="submit"]')
    btn.disabled = true
    btn.textContent = 'Memproses...'
    try {
      const res = await API.post('/keuangan/tagihan/generate-massal', {
        semester_akademik: fd.get('semester_akademik'),
        jenis:             fd.get('jenis'),
        jumlah:            parseFloat(fd.get('jumlah')),
        jatuh_tempo:       fd.get('jatuh_tempo') || null,
      })
      UI.toast(res.message || 'Generate selesai', 'success')
      closeMassalModal()
      await Promise.all([fetchTagihan(), fetchRingkasan()])
    } catch(err) {
      UI.toast(err.message || 'Gagal generate tagihan', 'error')
    } finally { btn.disabled = false; btn.textContent = 'Generate' }
  }

  // ── MODAL: BAYAR ───────────────────────────────────────────
  let _bayarTagihanId = null

  const openBayar = (id, nama, jumlah, jenis, sem) => {
    _bayarTagihanId = id
    document.getElementById('bayar-tagihan-info').innerHTML = `
      <div class="font-medium">${nama}</div>
      <div class="text-slate-500">${jenis} — ${sem}</div>
      <div class="text-slate-500">Tagihan: <span class="font-semibold text-slate-700">${fmt(jumlah)}</span></div>`
    document.getElementById('bayar-jumlah').value = jumlah
    document.getElementById('bayar-form').querySelector('[name="tgl_bayar"]').value = new Date().toISOString().slice(0,16)
    document.getElementById('bayar-modal').classList.remove('hidden')
  }
  const closeBayarModal = () => { document.getElementById('bayar-modal').classList.add('hidden'); _bayarTagihanId = null }

  const submitBayar = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const btn = e.target.querySelector('[type="submit"]')
    btn.disabled = true
    try {
      const res = await API.post('/keuangan/pembayaran', {
        tagihan_id:     _bayarTagihanId,
        jumlah:         parseFloat(fd.get('jumlah')),
        metode:         fd.get('metode'),
        kode_transaksi: fd.get('kode_transaksi') || null,
        tgl_bayar:      fd.get('tgl_bayar') || null,
        keterangan:     fd.get('keterangan') || null,
      })
      UI.toast(res.message || 'Pembayaran berhasil dicatat', 'success')
      closeBayarModal()
      await Promise.all([fetchTagihan(), fetchPembayaran(), fetchRingkasan()])
    } catch(err) {
      UI.toast(err.message || 'Gagal mencatat pembayaran', 'error')
    } finally { btn.disabled = false }
  }

  // ── MODAL: DETAIL TAGIHAN ──────────────────────────────────
  const openDetail = async (id) => {
    document.getElementById('detail-content').innerHTML = `<div class="text-center py-8 text-slate-400 text-sm">Memuat...</div>`
    document.getElementById('detail-modal').classList.remove('hidden')
    try {
      const res = await API.get(`/keuangan/tagihan/${id}`)
      const t = res.data
      const pmbRows = (t.pembayaran || []).map(p => `
        <tr>
          <td class="px-3 py-2 text-sm font-mono text-slate-600">${p.kode_transaksi}</td>
          <td class="px-3 py-2 text-sm text-slate-800 font-medium">${fmt(p.jumlah)}</td>
          <td class="px-3 py-2 text-sm text-slate-500">${p.metode}</td>
          <td class="px-3 py-2 text-sm text-slate-500">${p.tgl_bayar ? new Date(p.tgl_bayar).toLocaleDateString('id-ID') : '—'}</td>
          <td class="px-3 py-2">
            ${p.status === 'sukses' ? '<span class="badge bg-green-100 text-green-700">Sukses</span>' : '<span class="badge bg-slate-100 text-slate-400">Dibatalkan</span>'}
          </td>
        </tr>`).join('')
      document.getElementById('detail-content').innerHTML = `
        <div class="space-y-4">
          <div class="p-3 bg-slate-50 rounded-lg text-sm space-y-1">
            <div class="font-semibold text-slate-800">${t.mahasiswa_nama} <span class="font-normal text-slate-400">(${t.mahasiswa_nim})</span></div>
            <div class="text-slate-500">${t.jenis} — ${t.semester_akademik}</div>
            <div class="flex gap-4 pt-1">
              <span>Tagihan: <b class="text-slate-800">${fmt(t.jumlah)}</b></span>
              <span>Terbayar: <b class="text-green-600">${fmt(t.total_terbayar)}</b></span>
              <span>Sisa: <b class="text-red-600">${fmt(t.sisa)}</b></span>
            </div>
            <div class="pt-1">${statusBadge(t.status)}</div>
          </div>
          <div>
            <h4 class="text-sm font-semibold text-slate-700 mb-2">Riwayat Pembayaran</h4>
            ${t.pembayaran.length === 0
              ? `<p class="text-sm text-slate-400 text-center py-4">Belum ada pembayaran</p>`
              : `<table class="w-full text-sm">
                  <thead><tr class="border-b">
                    <th class="px-3 py-2 text-left text-xs text-slate-500">Kode</th>
                    <th class="px-3 py-2 text-left text-xs text-slate-500">Jumlah</th>
                    <th class="px-3 py-2 text-left text-xs text-slate-500">Metode</th>
                    <th class="px-3 py-2 text-left text-xs text-slate-500">Tanggal</th>
                    <th class="px-3 py-2 text-left text-xs text-slate-500">Status</th>
                  </tr></thead>
                  <tbody class="divide-y divide-slate-100">${pmbRows}</tbody>
                </table>`}
          </div>
          ${t.status !== 'lunas' && t.status !== 'dibatalkan' ? `
            <button onclick="KeuanganModule.openBayar('${t.id}', '${t.mahasiswa_nama.replace(/'/g,"\\'")}', ${t.jumlah}, '${t.jenis}', '${t.semester_akademik}'); KeuanganModule.closeDetailModal()"
              class="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
              Input Pembayaran
            </button>` : ''}
        </div>`
    } catch(err) {
      document.getElementById('detail-content').innerHTML = `<p class="text-sm text-red-500">Gagal memuat detail</p>`
    }
  }
  const closeDetailModal = () => document.getElementById('detail-modal').classList.add('hidden')

  // ── BATALKAN PEMBAYARAN ────────────────────────────────────
  const batalkanPmb = async (id, kode) => {
    const alasan = prompt(`Batalkan pembayaran ${kode}?\nMasukkan alasan:`)
    if (alasan === null) return
    try {
      await API.post(`/keuangan/pembayaran/${id}/batalkan`, { alasan })
      UI.toast('Pembayaran dibatalkan', 'success')
      await Promise.all([fetchPembayaran(), fetchTagihan(), fetchRingkasan()])
    } catch(err) { UI.toast(err.message || 'Gagal membatalkan', 'error') }
  }

  // ── FILTER / SEARCH / PAGINATION ───────────────────────────
  let tSearch = null
  const onTagihanSearch = (v) => { clearTimeout(tSearch); tSearch = setTimeout(() => { state.tagihanSearch = v; state.tagihanPage = 1; fetchTagihan() }, 400) }
  const onTagihanFilter = (key, val) => {
    state[key] = val; state.tagihanPage = 1
    if (key === 'tagihanSem') fetchRingkasan()
    fetchTagihan()
  }
  const goTagihanPage = (p) => { state.tagihanPage = p; fetchTagihan() }

  let pSearch = null
  const onPmbSearch = (v) => { clearTimeout(pSearch); pSearch = setTimeout(() => { state.pmbSearch = v; state.pmbPage = 1; fetchPembayaran() }, 400) }
  const onPmbFilter = (key, val) => { state[key] = val; state.pmbPage = 1; fetchPembayaran() }
  const goPmbPage = (p) => { state.pmbPage = p; fetchPembayaran() }

  return {
    render, switchTab,
    openTagihanModal, closeTagihanModal, submitTagihan,
    openMassalModal, closeMassalModal, submitMassal,
    openBayar, closeBayarModal, submitBayar,
    openDetail, closeDetailModal,
    batalkanPmb,
    onTagihanSearch, onTagihanFilter, goTagihanPage,
    onPmbSearch, onPmbFilter, goPmbPage,
  }
})()
