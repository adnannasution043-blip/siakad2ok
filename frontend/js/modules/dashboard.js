// ============================================================
// DASHBOARD.JS — Halaman dashboard dengan data real
// ============================================================
const DashboardModule = (() => {

  const render = async () => {
    Router.setPageMeta('Dashboard', 'Ringkasan sistem akademik')

    document.getElementById('page-content').innerHTML = `
      <div id="dash-stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        ${skeletonStat(4)}
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div class="lg:col-span-2">
          ${UI.card(`
            <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 class="font-semibold text-slate-700 text-sm">Statistik Mahasiswa</h3>
            </div>
            <div id="dash-mhs-stats" class="p-5 grid grid-cols-2 gap-3">
              <div class="animate-pulse h-16 bg-slate-100 rounded-lg"></div>
              <div class="animate-pulse h-16 bg-slate-100 rounded-lg"></div>
              <div class="animate-pulse h-16 bg-slate-100 rounded-lg"></div>
              <div class="animate-pulse h-16 bg-slate-100 rounded-lg"></div>
            </div>
          `)}
        </div>
        <div>
          ${UI.card(`
            <div class="px-5 py-4 border-b border-slate-200">
              <h3 class="font-semibold text-slate-700 text-sm">Status Tagihan</h3>
            </div>
            <div id="dash-keuangan" class="p-5 space-y-3">
              <div class="animate-pulse h-12 bg-slate-100 rounded-lg"></div>
              <div class="animate-pulse h-12 bg-slate-100 rounded-lg"></div>
              <div class="animate-pulse h-12 bg-slate-100 rounded-lg"></div>
            </div>
          `)}
        </div>
      </div>
      <div>
        ${UI.card(`
          <div class="px-5 py-4 border-b border-slate-200">
            <h3 class="font-semibold text-slate-700 text-sm">Aktivitas Terbaru</h3>
          </div>
          <div id="dash-activity" class="p-5">
            <div class="animate-pulse space-y-3">
              ${[1,2,3,4,5].map(() => `<div class="h-10 bg-slate-100 rounded-lg"></div>`).join('')}
            </div>
          </div>
        `)}
      </div>
    `

    try {
      const [statsRes, actRes] = await Promise.all([
        API.get('/dashboard/stats'),
        API.get('/dashboard/aktivitas', { limit: 8 }),
      ])
      renderStats(statsRes.data)
      renderActivity(actRes.data || [])
    } catch (e) {
      document.getElementById('dash-stats').innerHTML = `
        <div class="col-span-4 text-center py-6 text-slate-400 text-sm">
          Gagal memuat data: ${e.message}
        </div>`
    }
  }

  const skeletonStat = (n) => Array(n).fill(0).map(() => `
    <div class="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
      <div class="h-3 bg-slate-100 rounded w-2/3 mb-4"></div>
      <div class="h-7 bg-slate-100 rounded w-1/2"></div>
    </div>`).join('')

  const renderStats = (s) => {
    document.getElementById('dash-stats').innerHTML = `
      ${statCard('Total Mahasiswa', s.total_mahasiswa, 'bg-blue-50 text-blue-600', svgUsers())}
      ${statCard('Mahasiswa Aktif', s.mahasiswa_aktif, 'bg-green-50 text-green-600', svgCheck())}
      ${statCard('Total Dosen', s.total_dosen, 'bg-purple-50 text-purple-600', svgUser())}
      ${statCard('Program Studi', s.total_prodi, 'bg-orange-50 text-orange-600', svgBook())}
    `
    document.getElementById('dash-mhs-stats').innerHTML = `
      ${miniStat('Aktif', s.mahasiswa_aktif, 'text-green-600 bg-green-50')}
      ${miniStat('Cuti', s.mahasiswa_cuti, 'text-yellow-600 bg-yellow-50')}
      ${miniStat('Lulus', s.mahasiswa_lulus, 'text-blue-600 bg-blue-50')}
      ${miniStat('Mahasiswa Baru', s.mahasiswa_baru, 'text-indigo-600 bg-indigo-50')}
    `
    const totalTag = s.total_tagihan || 1
    document.getElementById('dash-keuangan').innerHTML = `
      ${keuanganBar('Lunas', s.tagihan_lunas, totalTag, 'bg-green-500')}
      ${keuanganBar('Cicilan', s.tagihan_cicilan, totalTag, 'bg-yellow-400')}
      ${keuanganBar('Belum Lunas', s.tagihan_belum_lunas, totalTag, 'bg-red-400')}
      <p class="text-xs text-slate-400 text-center mt-1">${s.total_tagihan} total tagihan SPP</p>
    `
  }

  const statCard = (label, value, colorClass, icon) => `
    <div class="bg-white rounded-xl border border-slate-200 p-5">
      <div class="flex items-center justify-between mb-3">
        <p class="text-xs font-medium text-slate-500 uppercase tracking-wider">${label}</p>
        <div class="w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center">${icon}</div>
      </div>
      <p class="text-2xl font-bold text-slate-800">${value ?? '—'}</p>
    </div>`

  const miniStat = (label, value, cls) => `
    <div class="flex items-center justify-between p-3 rounded-lg ${cls.split(' ')[1]}">
      <span class="text-sm font-medium text-slate-700">${label}</span>
      <span class="text-lg font-bold ${cls.split(' ')[0]}">${value ?? 0}</span>
    </div>`

  const keuanganBar = (label, val, total, color) => {
    const pct = total > 0 ? Math.round(val / total * 100) : 0
    return `
      <div>
        <div class="flex justify-between text-xs mb-1">
          <span class="text-slate-600">${label}</span>
          <span class="font-medium text-slate-800">${val} <span class="text-slate-400">(${pct}%)</span></span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2">
          <div class="${color} h-2 rounded-full transition-all" style="width:${pct}%"></div>
        </div>
      </div>`
  }

  const renderActivity = (activities) => {
    const typeColors = {
      mahasiswa: 'bg-blue-100 text-blue-600',
      krs: 'bg-green-100 text-green-600',
      nilai: 'bg-purple-100 text-purple-600',
    }
    const typeLabels = { mahasiswa: 'Mhs', krs: 'KRS', nilai: 'Nilai' }

    if (!activities.length) {
      document.getElementById('dash-activity').innerHTML = `
        <div class="text-center py-6 text-slate-400 text-sm">Belum ada aktivitas</div>`
      return
    }

    document.getElementById('dash-activity').innerHTML = `
      <div class="space-y-2">
        ${activities.map(a => {
          const cls = typeColors[a.type] || 'bg-slate-100 text-slate-600'
          const lbl = typeLabels[a.type] || a.type
          const time = a.time ? new Date(a.time).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'}) : ''
          return `
            <div class="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
              <span class="inline-flex items-center justify-center text-xs font-bold px-2 py-0.5 rounded ${cls} shrink-0 mt-0.5">${lbl}</span>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-slate-700 truncate">${a.text}</p>
                ${a.sub ? `<p class="text-xs text-slate-400">${a.sub}</p>` : ''}
              </div>
              <span class="text-xs text-slate-400 shrink-0">${time}</span>
            </div>`
        }).join('')}
      </div>`
  }

  const svgUsers = () => `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`
  const svgCheck = () => `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
  const svgUser = () => `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>`
  const svgBook = () => `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`

  return { render }
})()
