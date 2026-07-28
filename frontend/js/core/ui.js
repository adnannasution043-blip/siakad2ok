// ============================================================
// UI.JS — Komponen UI reusable
// ============================================================
const UI = (() => {

  // Toast notification
  const toast = (message, type = 'success', duration = 3500) => {
    const colors = {
      success: 'bg-green-600', error: 'bg-red-600',
      warning: 'bg-yellow-500', info: 'bg-blue-600'
    }
    const icons = {
      success: '✓', error: '✕', warning: '⚠', info: 'ℹ'
    }
    const el = document.createElement('div')
    el.className = `flex items-center gap-2 px-4 py-3 rounded-lg text-white text-sm shadow-lg ${colors[type]} transform translate-y-2 opacity-0 transition-all duration-300`
    el.innerHTML = `<span class="font-bold">${icons[type]}</span><span>${message}</span>`
    document.getElementById('toast-container').appendChild(el)
    requestAnimationFrame(() => {
      el.classList.remove('translate-y-2', 'opacity-0')
      setTimeout(() => {
        el.classList.add('translate-y-2', 'opacity-0')
        setTimeout(() => el.remove(), 300)
      }, duration)
    })
  }

  // Modal
  const openModal = (html) => {
    document.getElementById('modal-box').innerHTML = html
    document.getElementById('modal-overlay').classList.remove('hidden')
  }

  const closeModal = () => {
    document.getElementById('modal-overlay').classList.add('hidden')
    document.getElementById('modal-box').innerHTML = ''
  }

  // Loading state untuk page content
  const setLoading = (on) => {
    document.getElementById('page-content').classList.toggle('loading', on)
  }

  // Render tabel generik
  const renderTable = ({ headers, rows, emptyText = 'Tidak ada data' }) => {
    if (!rows.length) {
      return `<div class="text-center py-16 text-slate-400">
        <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
        </svg>
        <p class="text-sm">${emptyText}</p>
      </div>`
    }
    return `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200">
              ${headers.map(h => `<th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${rows.map(r => `<tr class="table-row-hover">${r}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  // Pagination
  const renderPagination = (meta, onPage) => {
    if (!meta || meta.total_pages <= 1) return ''
    const pages = []
    for (let i = 1; i <= meta.total_pages; i++) {
      if (i === 1 || i === meta.total_pages || (i >= meta.page - 2 && i <= meta.page + 2)) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...')
      }
    }
    return `
      <div class="flex items-center justify-between px-4 py-3 border-t border-slate-200 mt-2">
        <p class="text-xs text-slate-500">
          Menampilkan ${((meta.page-1)*meta.per_page)+1}–${Math.min(meta.page*meta.per_page, meta.total)} dari ${meta.total} data
        </p>
        <div class="flex gap-1">
          ${pages.map(p => p === '...'
            ? `<span class="px-2 py-1 text-xs text-slate-400">...</span>`
            : `<button onclick="(${onPage})(${p})"
                class="px-3 py-1 text-xs rounded ${p === meta.page
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'}">${p}</button>`
          ).join('')}
        </div>
      </div>
    `
  }

  // Badge status mahasiswa
  const statusBadge = (status) => {
    const map = {
      aktif:     'bg-green-100 text-green-700',
      cuti:      'bg-yellow-100 text-yellow-700',
      non_aktif: 'bg-slate-100 text-slate-600',
      DO:        'bg-red-100 text-red-700',
      lulus:     'bg-blue-100 text-blue-700',
    }
    return `<span class="badge ${map[status] || 'bg-slate-100 text-slate-600'}">${status}</span>`
  }

  // Card wrapper
  const card = (content, classes = '') =>
    `<div class="bg-white rounded-xl border border-slate-200 ${classes}">${content}</div>`

  // Page header
  const pageHeader = (title, subtitle = '', actions = '') => `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-semibold text-slate-800">${title}</h2>
        ${subtitle ? `<p class="text-sm text-slate-500 mt-0.5">${subtitle}</p>` : ''}
      </div>
      ${actions ? `<div class="flex items-center gap-2">${actions}</div>` : ''}
    </div>
  `

  // Tombol standar
  const btn = {
    primary: (label, onclick, extra = '') =>
      `<button onclick="${onclick}" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors ${extra}">${label}</button>`,
    secondary: (label, onclick, extra = '') =>
      `<button onclick="${onclick}" class="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors ${extra}">${label}</button>`,
    danger: (label, onclick, extra = '') =>
      `<button onclick="${onclick}" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors ${extra}">${label}</button>`,
    icon: (icon, onclick, title = '', extra = '') =>
      `<button onclick="${onclick}" title="${title}" class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors ${extra}">${icon}</button>`,
  }

  // Input text standar
  const input = (name, label, type = 'text', value = '', placeholder = '', required = false) => `
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">${label}${required ? ' <span class="text-red-500">*</span>' : ''}</label>
      <input type="${type}" name="${name}" value="${value}" placeholder="${placeholder}" ${required ? 'required' : ''}
        class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
    </div>
  `

  // Select standar
  const select = (name, label, options, value = '', required = false) => `
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">${label}${required ? ' <span class="text-red-500">*</span>' : ''}</label>
      <select name="${name}" ${required ? 'required' : ''}
        class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
        <option value="">-- Pilih --</option>
        ${options.map(o => `<option value="${o.value}" ${o.value == value ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>
    </div>
  `

  // Klik di luar modal untuk tutup
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal()
  })

  return { toast, openModal, closeModal, setLoading, renderTable, renderPagination, statusBadge, card, pageHeader, btn, input, select }
})()
