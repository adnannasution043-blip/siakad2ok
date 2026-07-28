// ============================================================
// PENGATURAN.JS — Informasi sistem
// ============================================================
const PengaturanModule = (() => {

  const render = () => {
    Router.setPageMeta('Pengaturan', 'Konfigurasi dan informasi sistem')
    const user = Auth.getUser()

    document.getElementById('page-content').innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-4">
          ${UI.card(`
            <div class="px-5 py-4 border-b border-slate-200">
              <h3 class="font-semibold text-slate-700 text-sm">Profil Akun</h3>
            </div>
            <div class="p-5">
              <div class="flex items-center gap-4 mb-5">
                <div class="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl">
                  ${(user?.nama || 'A').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p class="font-semibold text-slate-800">${user?.nama || '—'}</p>
                  <p class="text-sm text-slate-500">${user?.email || '—'}</p>
                  <span class="badge bg-primary-100 text-primary-700 mt-1">${formatRole(user?.role)}</span>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="p-3 bg-slate-50 rounded-lg">
                  <p class="text-xs text-slate-500 mb-1">ID Pengguna</p>
                  <p class="text-sm font-mono text-slate-700">${user?.id || '—'}</p>
                </div>
                <div class="p-3 bg-slate-50 rounded-lg">
                  <p class="text-xs text-slate-500 mb-1">Role</p>
                  <p class="text-sm font-medium text-slate-700">${formatRole(user?.role)}</p>
                </div>
              </div>
            </div>
          `)}

          ${UI.card(`
            <div class="px-5 py-4 border-b border-slate-200">
              <h3 class="font-semibold text-slate-700 text-sm">Informasi Sistem</h3>
            </div>
            <div class="p-5 space-y-3">
              ${infoRow('Nama Sistem', 'SIAKAD — Sistem Informasi Akademik')}
              ${infoRow('Versi', '1.0.0-dev')}
              ${infoRow('Mode', DEV_MODE ? '<span class="badge bg-yellow-100 text-yellow-700">Development</span>' : '<span class="badge bg-green-100 text-green-700">Production</span>')}
              ${infoRow('Backend', 'FastAPI (Python) + JSON Storage')}
              ${infoRow('Frontend', 'Vanilla JS + Tailwind CSS')}
              ${infoRow('Tahun Akademik Aktif', '2024/2025')}
            </div>
          `)}
        </div>

        <div class="space-y-4">
          ${UI.card(`
            <div class="px-5 py-4 border-b border-slate-200">
              <h3 class="font-semibold text-slate-700 text-sm">Modul Aktif</h3>
            </div>
            <div class="p-4 space-y-2">
              ${[
                ['Dashboard', true],
                ['Mahasiswa', true],
                ['Dosen', true],
                ['KRS', true],
                ['Penilaian', true],
                ['Presensi', true],
                ['Keuangan', true],
                ['Pengaturan', true],
              ].map(([name, active]) => `
                <div class="flex items-center justify-between py-1">
                  <span class="text-sm text-slate-700">${name}</span>
                  ${active
                    ? `<span class="badge bg-green-100 text-green-600">Aktif</span>`
                    : `<span class="badge bg-slate-100 text-slate-500">Belum</span>`}
                </div>`).join('')}
            </div>
          `)}

          ${DEV_MODE ? UI.card(`
            <div class="px-5 py-4 border-b border-slate-200">
              <h3 class="font-semibold text-yellow-700 text-sm">⚠ Dev Mode Aktif</h3>
            </div>
            <div class="p-4 space-y-2 text-xs text-slate-600">
              <p>Autentikasi dinonaktifkan — semua request otomatis sebagai <strong>super_admin</strong>.</p>
              <p class="mt-2">Untuk mengaktifkan login:</p>
              <ol class="list-decimal list-inside space-y-1 text-slate-500 mt-1">
                <li>Set <code class="bg-slate-100 px-1 rounded">DEV_MODE = false</code> di <code class="bg-slate-100 px-1 rounded">auth.js</code></li>
                <li>Set <code class="bg-slate-100 px-1 rounded">DEV_MODE = False</code> di <code class="bg-slate-100 px-1 rounded">dev.py</code></li>
              </ol>
            </div>
          `) : ''}
        </div>
      </div>
    `
  }

  const formatRole = (role) => {
    const map = {
      super_admin: 'Super Admin', admin_akademik: 'Admin Akademik',
      admin_keuangan: 'Admin Keuangan', kaprodi: 'Kaprodi',
      dosen: 'Dosen', mahasiswa: 'Mahasiswa', staf: 'Staf', lppm: 'LPPM',
    }
    return map[role] || role || '—'
  }

  const infoRow = (label, value) => `
    <div class="flex items-start justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
      <span class="text-sm text-slate-500 shrink-0">${label}</span>
      <span class="text-sm text-slate-800 text-right">${value}</span>
    </div>`

  return { render }
})()
