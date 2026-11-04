const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** 1250000 → "Rp 1.250.000" (minus ditulis "-Rp 1.250.000"). */
export function rupiah(n, prefix = true) {
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-' : '') + (prefix ? 'Rp ' : '') + s;
}

/** "2026-11-04" → "4 November 2026". */
export function tanggalIndo(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
}

export function todayIso() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

const SATUAN = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

/** 7735000 → "Tujuh Juta Tujuh Ratus Tiga Puluh Lima Ribu". */
export function terbilang(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'Nol';
  const t = (x) => {
    if (x < 12) return SATUAN[x];
    if (x < 20) return `${t(x - 10)} Belas`;
    if (x < 100) return `${t(Math.floor(x / 10))} Puluh${x % 10 ? ' ' + t(x % 10) : ''}`;
    if (x < 200) return `Seratus${x - 100 ? ' ' + t(x - 100) : ''}`;
    if (x < 1000) return `${t(Math.floor(x / 100))} Ratus${x % 100 ? ' ' + t(x % 100) : ''}`;
    if (x < 2000) return `Seribu${x - 1000 ? ' ' + t(x - 1000) : ''}`;
    if (x < 1e6) return `${t(Math.floor(x / 1000))} Ribu${x % 1000 ? ' ' + t(x % 1000) : ''}`;
    if (x < 1e9) return `${t(Math.floor(x / 1e6))} Juta${x % 1e6 ? ' ' + t(x % 1e6) : ''}`;
    if (x < 1e12) return `${t(Math.floor(x / 1e9))} Miliar${x % 1e9 ? ' ' + t(x % 1e9) : ''}`;
    return `${t(Math.floor(x / 1e12))} Triliun${x % 1e12 ? ' ' + t(x % 1e12) : ''}`;
  };
  return t(n);
}

export function parseNominal(s) {
  return Number(String(s).replace(/\D/g, '')) || 0;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
