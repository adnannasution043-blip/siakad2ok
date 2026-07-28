// Laporan & Statistik Module
const LaporanModule = (() => {
  const API = '/api/v1/laporan'
  let activeTab = 'ringkasan'

  // ── Formatters ─────────────────────────────────────────────────────────────

  const fmtRupiah = (v) => {
    if (!v) return 'Rp 0'
    return 'Rp ' + Number(v).toLocaleString('id-ID')
  }

  const fmtNum = (v) => Number(v || 0).toLocaleString('id-ID')

  // ── Bar Chart (CSS-based) ───────────────────────────────────────────────────

  const barChart = (data, colorClass = 'bg-blue-500', maxOverride = null) => {
    const entries = Object.entries(data).filter(([k, v]) => v > 0)
    if (!entries.length) return '<p class="text-slate-400 text-sm">Tidak ada data</p>'
    const max = maxOverride || Math.max(...entries.map(([, v]) => v))
    return `<div class="space-y-2">
      ${entries.map(([label, val]) => `
        <div>
          <div class="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
            <span>${label}</span><span class="font-medium">${fmtNum(val)}</span>
          </div>
          <div class="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div class="${colorClass} h-2 rounded-full transition-all duration-500"
              style="width: ${max ? Math.round(val/max*100) : 0}%"></div>
          </div>
        </div>`).join('')}
    </div>`
  }

  const pieChart = (data, colors) => {
    const entries = Object.entries(data)
    const total = entries.reduce((s, [, v]) => s + v, 0)
    if (!total) return '<p class="text-slate-400 text-sm">Tidak ada data</p>'
    const defaultColors = ['bg-blue-500','bg-green-500','bg-yellow-500','bg-purple-500','bg-red-500','bg-teal-500','bg-orange-500','bg-pink-500']
    return `<div class="space-y-2">
      ${entries.map(([label, val], i) => {
        const pct = Math.round(val / total * 100)
        const cls = (colors && colors[i]) || defaultColors[i % defaultColors.length]
        return `<div class="flex items-center gap-2 text-sm">
          <div class="w-3 h-3 rounded-full flex-shrink-0 ${cls}"></div>
          <span class="flex-1 text-slate-700 dark:text-slate-300 truncate">${label}</span>
          <span class="font-medium text-slate-800 dark:text-slate-100">${fmtNum(val)}</span>
          <span class="text-xs text-slate-400 w-9 text-right">${pct}%</span>
        </div>`
      }).join('')}
    </div>`
  }

  const statCard = (label, value, sub = '', color = 'blue') => {
    const colors = {
      blue: 'text-blue-700 dark:text-blue-400',
      green: 'text-green-700 dark:text-green-400',
      yellow: 'text-yellow-700 dark:text-yellow-400',
      red: 'text-red-700 dark:text-red-400',
      purple: 'text-purple-700 dark:text-purple-400',
      teal: 'text-teal-700 dark:text-teal-400',
    }
    return `
      <div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
        <div class="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">${label}</div>
        <div class="text-2xl font-bold ${colors[color] || colors.blue}">${value}</div>
        ${sub ? `<div class="text-xs text-slate-400 mt-0.5">${sub}</div>` : ''}
      </div>`
  }

  const section = (title, content) => `
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
      <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-4">${title}</h3>
      ${content}
    </div>`

  // ── Tab: Ringkasan ──────────────────────────────────────────────────────────

  const loadRingkasan = async () => {
    const pane = document.getElementById('lap-pane-ringkasan')
    if (!pane) return
    pane.innerHTML = '<div class="p-8 text-center text-slate-400">Memuat data...</div>'
    try {
      const r = await fetch(`${API}/ringkasan`)
      const j = await r.json()
      const d = j.data || {}
      const mhs = d.mahasiswa || {}
      const keu = d.keuangan || {}

      pane.innerHTML = `
        <div class="space-y-6">
          <!-- SDM Cards -->
          <div>
            <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Sumber Daya Manusia</h3>
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
              ${statCard('Total Mahasiswa', fmtNum(mhs.total), `${mhs.aktif} aktif · ${mhs.cuti} cuti`, 'blue')}
              ${statCard('Dosen', fmtNum(d.dosen), 'Tenaga pendidik', 'teal')}
              ${statCard('Pegawai', fmtNum(d.pegawai), 'Tenaga kependidikan', 'purple')}
              ${statCard('Alumni', fmtNum(d.alumni), 'Sudah yudisium', 'green')}
            </div>
          </div>
          <!-- Akademik Cards -->
          <div>
            <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Kegiatan Akademik</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              ${statCard('Penelitian Aktif', fmtNum(d.penelitian_aktif), '', 'blue')}
              ${statCard('PKM Aktif', fmtNum(d.pkm_aktif), '', 'green')}
              ${statCard('TA Berjalan', fmtNum(d.ta_berjalan), '', 'yellow')}
              ${statCard('Magang Aktif', fmtNum(d.magang_aktif), '', 'purple')}
            </div>
          </div>
          <!-- Keuangan Progress -->
          <div>
            <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Penerimaan Keuangan</h3>
            <div class="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
              <div class="flex justify-between items-end mb-2">
                <div>
                  <div class="text-xs text-slate-500">Total Tagihan</div>
                  <div class="text-xl font-bold text-slate-800 dark:text-slate-100">${fmtRupiah(keu.total_tagihan)}</div>
                </div>
                <div class="text-right">
                  <div class="text-xs text-slate-500">Terkumpul</div>
                  <div class="text-xl font-bold text-green-600">${fmtRupiah(keu.terkumpul)}</div>
                </div>
              </div>
              <div class="h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div class="h-4 bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-700"
                  style="width: ${keu.persentase || 0}%"></div>
              </div>
              <div class="text-right text-sm font-medium text-green-600 mt-1">${keu.persentase || 0}% terkumpul</div>
            </div>
          </div>
          <!-- Mahasiswa Status -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${section('Status Mahasiswa', pieChart({
              'Aktif': mhs.aktif || 0,
              'Lulus': mhs.lulus || 0,
              'Cuti': mhs.cuti || 0,
              'DO': mhs.do || 0,
            }, ['bg-blue-500','bg-green-500','bg-yellow-500','bg-red-500']))}
            ${section('Info Lainnya', `
              <div class="grid grid-cols-2 gap-3">
                ${statCard('Beasiswa Aktif', fmtNum(d.beasiswa_aktif), '', 'green')}
                ${statCard('Mahasiswa DO', fmtNum(mhs.do), '', 'red')}
                ${statCard('Mahasiswa Cuti', fmtNum(mhs.cuti), '', 'yellow')}
                ${statCard('Alumni Terdaftar', fmtNum(d.alumni), '', 'teal')}
              </div>`)}
          </div>
        </div>`
    } catch (e) {
      pane.innerHTML = '<div class="p-8 text-center text-red-400">Gagal memuat data ringkasan</div>'
    }
  }

  // ── Tab: Mahasiswa ──────────────────────────────────────────────────────────

  const loadMahasiswa = async () => {
    const pane = document.getElementById('lap-pane-mahasiswa')
    if (!pane) return
    pane.innerHTML = '<div class="p-8 text-center text-slate-400">Memuat data...</div>'
    try {
      const r = await fetch(`${API}/mahasiswa`)
      const j = await r.json()
      const d = j.data || {}

      pane.innerHTML = `
        <div class="space-y-4">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${statCard('Total Mahasiswa', fmtNum(d.total), '', 'blue')}
            ${statCard('Rata-rata IPK', d.rata_rata_ipk || '-', 'Seluruh mahasiswa', 'green')}
            ${statCard('Mahasiswa Aktif', fmtNum((d.by_status || {}).aktif || 0), '', 'teal')}
            ${statCard('Mahasiswa Lulus', fmtNum((d.by_status || {}).lulus || 0), '', 'purple')}
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${section('Distribusi per Program Studi', barChart(d.by_prodi || {}, 'bg-blue-500'))}
            ${section('Distribusi per Angkatan', barChart(d.by_angkatan || {}, 'bg-purple-500'))}
            ${section('Status Mahasiswa', pieChart(d.by_status || {}, ['bg-blue-500','bg-green-500','bg-yellow-500','bg-red-500']))}
            ${section('Distribusi IPK', barChart(d.ipk_distribution || {}, 'bg-teal-500'))}
            ${section('Jenis Kelamin', pieChart(d.by_jenis_kelamin || {}))}
          </div>
        </div>`
    } catch (e) {
      pane.innerHTML = '<div class="p-8 text-center text-red-400">Gagal memuat data</div>'
    }
  }

  // ── Tab: Akademik ───────────────────────────────────────────────────────────

  const loadAkademik = async () => {
    const pane = document.getElementById('lap-pane-akademik')
    if (!pane) return
    pane.innerHTML = '<div class="p-8 text-center text-slate-400">Memuat data...</div>'
    try {
      const r = await fetch(`${API}/akademik`)
      const j = await r.json()
      const d = j.data || {}
      const nilai = d.nilai || {}
      const krs = d.krs || {}
      const kelas = d.kelas || {}

      pane.innerHTML = `
        <div class="space-y-4">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${statCard('Total Nilai', fmtNum(nilai.total), 'Data penilaian', 'blue')}
            ${statCard('Rata-rata Nilai', nilai.rata_rata || '-', 'Dari semua MK', 'green')}
            ${statCard('Total KRS', fmtNum(krs.total), 'Semua semester', 'purple')}
            ${statCard('Total Kelas', fmtNum(kelas.total), 'Kelas aktif', 'teal')}
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${section('Distribusi Nilai (Grade)', barChart(nilai.distribusi || {}, 'bg-indigo-500'))}
            ${section('Status KRS', pieChart(krs.by_status || {}))}
          </div>
          ${section('Daftar Kelas', `
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th class="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Kode</th>
                    <th class="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Mata Kuliah</th>
                    <th class="px-4 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">Kapasitas</th>
                    <th class="px-4 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">Terisi</th>
                    <th class="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Kepadatan</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
                  ${(kelas.data || []).map(k => {
                    const pct = k.kapasitas ? Math.round(k.terisi / k.kapasitas * 100) : 0
                    const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                    return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td class="px-4 py-2 font-mono text-xs">${k.kode}</td>
                      <td class="px-4 py-2">${k.mata_kuliah || '-'}</td>
                      <td class="px-4 py-2 text-center">${k.kapasitas}</td>
                      <td class="px-4 py-2 text-center">${k.terisi}</td>
                      <td class="px-4 py-2 w-32">
                        <div class="flex items-center gap-2">
                          <div class="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div class="${barColor} h-2 rounded-full" style="width:${pct}%"></div>
                          </div>
                          <span class="text-xs text-slate-500 w-8">${pct}%</span>
                        </div>
                      </td>
                    </tr>`
                  }).join('')}
                </tbody>
              </table>
            </div>`)}
        </div>`
    } catch (e) {
      pane.innerHTML = '<div class="p-8 text-center text-red-400">Gagal memuat data</div>'
    }
  }

  // ── Tab: Keuangan ───────────────────────────────────────────────────────────

  const loadKeuangan = async () => {
    const pane = document.getElementById('lap-pane-keuangan')
    if (!pane) return
    pane.innerHTML = '<div class="p-8 text-center text-slate-400">Memuat data...</div>'
    try {
      const r = await fetch(`${API}/keuangan`)
      const j = await r.json()
      const d = j.data || {}

      pane.innerHTML = `
        <div class="space-y-4">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${statCard('Total Tagihan', fmtRupiah(d.total_tagihan), fmtNum(d.jumlah_tagihan) + ' tagihan', 'blue')}
            ${statCard('Sudah Lunas', fmtRupiah(d.total_lunas), d.persentase_lunas + '% terkumpul', 'green')}
            ${statCard('Belum Lunas', fmtRupiah(d.total_belum_lunas), '', 'red')}
            ${statCard('Cicilan', fmtRupiah(d.total_cicilan), '', 'yellow')}
          </div>
          <!-- Progress bar -->
          <div class="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <div class="flex justify-between text-sm mb-2">
              <span class="font-medium text-slate-700 dark:text-slate-300">Realisasi Penerimaan</span>
              <span class="font-bold text-green-600">${d.persentase_lunas || 0}%</span>
            </div>
            <div class="h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div class="h-5 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-end pr-2 transition-all duration-700"
                style="width: ${d.persentase_lunas || 0}%">
                <span class="text-white text-xs font-bold">${d.persentase_lunas || 0}%</span>
              </div>
            </div>
            <div class="flex justify-between text-xs text-slate-400 mt-1">
              <span>Rp 0</span>
              <span>${fmtRupiah(d.total_tagihan)}</span>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${section('Status Tagihan (Jumlah Record)', pieChart(d.by_status || {}, ['bg-green-500','bg-yellow-500','bg-red-500']))}
            ${section('Jenis Tagihan', pieChart(d.by_jenis || {}))}
            ${section('Metode Pembayaran', pieChart(d.by_metode_pembayaran || {}))}
            ${section('Penerimaan per Semester', barChart(d.by_semester ? Object.fromEntries(Object.entries(d.by_semester).map(([k, v]) => [k, v.lunas])) : {}, 'bg-green-500'))}
          </div>
        </div>`
    } catch (e) {
      pane.innerHTML = '<div class="p-8 text-center text-red-400">Gagal memuat data</div>'
    }
  }

  // ── Tab: Riset ──────────────────────────────────────────────────────────────

  const loadRiset = async () => {
    const pane = document.getElementById('lap-pane-riset')
    if (!pane) return
    pane.innerHTML = '<div class="p-8 text-center text-slate-400">Memuat data...</div>'
    try {
      const r = await fetch(`${API}/riset`)
      const j = await r.json()
      const d = j.data || {}
      const pen = d.penelitian || {}
      const pkm = d.pkm || {}

      pane.innerHTML = `
        <div class="space-y-4">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${statCard('Total Penelitian', fmtNum(pen.total), fmtNum(pen.luaran) + ' luaran', 'blue')}
            ${statCard('Dana Penelitian', fmtRupiah(pen.total_dana), '', 'green')}
            ${statCard('Total PKM', fmtNum(pkm.total), fmtNum(pkm.luaran) + ' luaran', 'purple')}
            ${statCard('Dana PKM', fmtRupiah(pkm.total_dana), '', 'teal')}
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${section('Status Penelitian', pieChart(pen.by_status || {}))}
            ${section('Skema Penelitian', barChart(pen.by_skema || {}, 'bg-blue-500'))}
            ${section('Luaran Penelitian (Jenis)', pieChart(pen.luaran_by_jenis || {}))}
            ${section('Status PKM', pieChart(pkm.by_status || {}))}
            ${section('Skema PKM', barChart(pkm.by_skema || {}, 'bg-purple-500'))}
            ${section('Luaran PKM (Jenis)', pieChart(pkm.luaran_by_jenis || {}))}
          </div>
        </div>`
    } catch (e) {
      pane.innerHTML = '<div class="p-8 text-center text-red-400">Gagal memuat data</div>'
    }
  }

  // ── Tab: SDM ────────────────────────────────────────────────────────────────

  const loadSDM = async () => {
    const pane = document.getElementById('lap-pane-sdm')
    if (!pane) return
    pane.innerHTML = '<div class="p-8 text-center text-slate-400">Memuat data...</div>'
    try {
      const r = await fetch(`${API}/sdm`)
      const j = await r.json()
      const d = j.data || {}
      const dos = d.dosen || {}
      const peg = d.pegawai || {}
      const akr = d.akreditasi || {}

      pane.innerHTML = `
        <div class="space-y-4">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${statCard('Total Dosen', fmtNum(dos.total), '', 'blue')}
            ${statCard('Total Pegawai', fmtNum(peg.total), '', 'teal')}
            ${statCard('Total Gaji/Bln', fmtRupiah(peg.total_gaji_per_bulan), 'Inc. tunjangan', 'green')}
            ${statCard('Akreditasi Prodi', fmtNum(akr.total_prodi), akr.akan_berakhir_180_hari + ' akan berakhir', akr.akan_berakhir_180_hari > 0 ? 'red' : 'purple')}
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${section('Jabatan Fungsional Dosen', barChart(dos.by_jabatan || {}, 'bg-blue-500'))}
            ${section('Pendidikan Terakhir Dosen', pieChart(dos.by_pendidikan || {}))}
            ${section('Status Pegawai', pieChart(peg.by_status || {}, ['bg-blue-500','bg-yellow-500','bg-orange-500']))}
            ${section('Pegawai per Unit Kerja', barChart(peg.by_unit || {}, 'bg-teal-500'))}
            ${section('Peringkat Akreditasi Prodi', barChart(akr.by_peringkat || {}, 'bg-indigo-500'))}
          </div>
        </div>`
    } catch (e) {
      pane.innerHTML = '<div class="p-8 text-center text-red-400">Gagal memuat data</div>'
    }
  }

  // ── Tab: Kemahasiswaan ──────────────────────────────────────────────────────

  const loadKemahasiswaan = async () => {
    const pane = document.getElementById('lap-pane-kemahasiswaan')
    if (!pane) return
    pane.innerHTML = '<div class="p-8 text-center text-slate-400">Memuat data...</div>'
    try {
      const r = await fetch(`${API}/kemahasiswaan`)
      const j = await r.json()
      const d = j.data || {}
      const ta = d.ta || {}
      const mag = d.magang || {}
      const bea = d.beasiswa || {}
      const alm = d.alumni || {}
      const pmb = d.pmb || {}
      const sur = d.surat || {}

      pane.innerHTML = `
        <div class="space-y-4">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${statCard('Tugas Akhir', fmtNum(ta.total), '', 'blue')}
            ${statCard('Magang/PKL', fmtNum(mag.total), '', 'teal')}
            ${statCard('Pend. Beasiswa', fmtNum(bea.total_pendaftar), '', 'green')}
            ${statCard('Anggota UKM', fmtNum((d.ukm || {}).total_anggota), '', 'purple')}
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${section('Status Tugas Akhir', pieChart(ta.by_status || {}))}
            ${section('Status Magang', pieChart(mag.by_status || {}))}
            ${section('Alumni — Serapan Kerja', `
              <div class="text-center py-4">
                <div class="text-4xl font-bold text-teal-600 dark:text-teal-400">${alm.rasio_bekerja || 0}%</div>
                <div class="text-sm text-slate-500 mt-1">Rasio alumni bekerja</div>
                <div class="mt-4 grid grid-cols-2 gap-3">
                  ${statCard('Sudah Bekerja', fmtNum(alm.sudah_bekerja), '', 'green')}
                  ${statCard('Belum Bekerja', fmtNum(alm.belum_bekerja), '', 'yellow')}
                </div>
              </div>`)}
            ${section('PMB — Pendaftar & Diterima', `
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-sm text-slate-600 dark:text-slate-300">Total Pendaftar</span>
                  <span class="font-bold text-blue-600">${fmtNum(pmb.total_pendaftar)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-slate-600 dark:text-slate-300">Diterima</span>
                  <span class="font-bold text-green-600">${fmtNum(pmb.diterima)}</span>
                </div>
                <div class="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div class="h-2 bg-green-500 rounded-full" style="width:${pmb.total_pendaftar ? Math.round(pmb.diterima/pmb.total_pendaftar*100) : 0}%"></div>
                </div>
              </div>`)}
            ${section('Pengajuan Surat (Jenis)', barChart(sur.by_jenis || {}, 'bg-orange-500'))}
            ${section('Status Surat', pieChart(sur.by_status || {}))}
          </div>
        </div>`
    } catch (e) {
      pane.innerHTML = '<div class="p-8 text-center text-red-400">Gagal memuat data</div>'
    }
  }

  // ── Tab Switching ───────────────────────────────────────────────────────────

  const TABS = [
    { id: 'ringkasan', label: 'Ringkasan', load: loadRingkasan },
    { id: 'mahasiswa', label: 'Mahasiswa', load: loadMahasiswa },
    { id: 'akademik', label: 'Akademik', load: loadAkademik },
    { id: 'keuangan', label: 'Keuangan', load: loadKeuangan },
    { id: 'riset', label: 'Riset', load: loadRiset },
    { id: 'sdm', label: 'SDM & Aset', load: loadSDM },
    { id: 'kemahasiswaan', label: 'Kemahasiswaan', load: loadKemahasiswaan },
  ]

  const switchTab = (tabId) => {
    activeTab = tabId
    TABS.forEach(t => {
      const btn = document.getElementById(`lap-tab-${t.id}`)
      const pane = document.getElementById(`lap-pane-${t.id}`)
      if (!btn || !pane) return
      if (t.id === tabId) {
        btn.classList.add('border-b-2', 'border-blue-600', 'text-blue-600')
        btn.classList.remove('text-slate-500')
        pane.classList.remove('hidden')
        t.load()
      } else {
        btn.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600')
        btn.classList.add('text-slate-500')
        pane.classList.add('hidden')
      }
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const render = () => {
    const el = document.getElementById('page-content')
    if (!el) return
    el.innerHTML = `
    <div class="p-6 space-y-6">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">Laporan & Statistik</h1>
          <p class="text-sm text-slate-500 mt-0.5">Rekap data seluruh modul sistem akademik</p>
        </div>
        <div class="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Data real-time dari database
        </div>
      </div>

      <!-- Tabs -->
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div class="flex overflow-x-auto border-b border-slate-200 dark:border-slate-700 px-4 gap-1">
          ${TABS.map((t, i) => `
            <button id="lap-tab-${t.id}" onclick="LaporanModule.switchTab('${t.id}')"
              class="py-3 px-4 text-sm font-medium whitespace-nowrap -mb-px ${i === 0 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}">
              ${t.label}
            </button>`).join('')}
        </div>

        <div class="p-4">
          ${TABS.map((t, i) => `
            <div id="lap-pane-${t.id}" class="${i === 0 ? '' : 'hidden'}">
              <div class="p-8 text-center text-slate-400">Memuat data...</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`

    loadRingkasan()
  }

  return { render, switchTab }
})()
