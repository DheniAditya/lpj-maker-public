// Membuat PDF LPJ langsung di browser dengan jsPDF.
// Gaya: monokrom, IBM Plex Sans untuk teks dan IBM Plex Mono untuk angka.
import { terbilang, tanggalIndo } from './format.js';

const INK = [17, 17, 17];
const GRAY = [102, 102, 102];
const LIGHT = [204, 204, 204];
const BOX = [242, 242, 242];

const FONTS = [
  ['IBMPlexSans-Regular.ttf', 'Plex', 'normal'],
  ['IBMPlexSans-SemiBold.ttf', 'Plex', 'bold'],
  ['IBMPlexSans-Italic.ttf', 'Plex', 'italic'],
  ['IBMPlexMono-Regular.ttf', 'PlexMono', 'normal'],
  ['IBMPlexMono-SemiBold.ttf', 'PlexMono', 'bold'],
];
let fontData = null;

async function loadFonts() {
  if (fontData) return fontData;
  const base = new URL('../fonts/', import.meta.url);
  fontData = await Promise.all(FONTS.map(async ([file]) => {
    const buf = new Uint8Array(await (await fetch(new URL(file, base))).arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(bin);
  }));
  return fontData;
}

const num = (n) => Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
/** Angka akuntansi: minus ditulis dalam kurung, contoh (194). */
const acc = (n, rp = false) => (n < 0 ? `(${rp ? 'Rp' : ''}${num(n)})` : `${rp ? 'Rp' : ''}${num(n)}`);

export async function buildPdf(state) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const fonts = await loadFonts();
  FONTS.forEach(([file, family, style], i) => {
    doc.addFileToVFS(file, fonts[i]);
    doc.addFont(file, family, style);
  });

  const W = 210, H = 297, M = 17, CW = W - 2 * M;
  let y = 20;
  const color = (c) => doc.setTextColor(...c);
  const font = (f, s, size) => { doc.setFont(f, s); doc.setFontSize(size); };
  const text = (s, x, yy, opt = {}) => doc.text(Array.isArray(s) ? s : String(s), x, yy, opt);
  const rule = (yy, w = 0.25, x0 = M, x1 = W - M) => { doc.setDrawColor(...INK); doc.setLineWidth(w); doc.line(x0, yy, x1, yy); };

  // ---------- Judul ----------
  let tx = M;
  if (state.logo) {
    const lh = 14, lw = Math.min(28, (state.logo.w / state.logo.h) * lh);
    doc.addImage(state.logo.src, 'PNG', W - M - lw, y - 3, lw, lh);
  }
  font('Plex', 'normal', 7.5); color(GRAY);
  doc.setCharSpace(0.9); text('LAPORAN PERTANGGUNGJAWABAN', tx, y); doc.setCharSpace(0);
  font('Plex', 'bold', 17); color(INK);
  const title = doc.splitTextToSize(state.title || 'Laporan Pertanggungjawaban', CW - (state.logo ? 34 : 0));
  text(title, tx, y + 8.5);
  y += 8.5 + (title.length - 1) * 7;
  const sub = [state.org, state.city].filter(Boolean).join(' · ');
  if (sub) { font('Plex', 'normal', 9); color(GRAY); text(sub, tx, y + 5.5); y += 5.5; }
  y += 5;
  rule(y, 0.5);
  y += 8;

  // ---------- Penanggung jawab & tanggal ----------
  const pj = state.pj?.trim() || state.signers.find((s) => s.name)?.name || '-';
  font('Plex', 'normal', 9); color(GRAY);
  text('Penanggungjawab', M, y);
  text('Tanggal Laporan', W - M, y, { align: 'right' });
  font('Plex', 'bold', 9.5); color(INK);
  text(pj, M, y + 6);
  text(tanggalIndo(state.date), W - M, y + 6, { align: 'right' });
  y += 13;

  // ---------- Tabel ----------
  const cols = [
    { t: 'No', w: 13, a: 'center' },
    { t: 'Keterangan', w: 62, a: 'left' },
    { t: 'Bukti', w: 29, a: 'left' },
    { t: 'Debit', w: 24, a: 'right' },
    { t: 'Kredit', w: 24, a: 'right' },
    { t: 'Saldo', w: CW - 13 - 62 - 29 - 24 - 24, a: 'right' },
  ];
  const cx = []; cols.reduce((x, c) => (cx.push(x), x + c.w), M);
  const pad = 2;
  const at = (i) => (cols[i].a === 'left' ? cx[i] + pad : cols[i].a === 'right' ? cx[i] + cols[i].w - pad : cx[i] + cols[i].w / 2);

  const header = () => {
    rule(y, 0.3);
    font('Plex', 'bold', 9); color(INK);
    cols.forEach((c, i) => text(c.t, at(i), y + 5.6, { align: c.a }));
    y += 8.5;
    rule(y, 0.3);
  };
  header();

  let saldo = 0, td = 0, tc = 0;
  state.entries.forEach((e, idx) => {
    const d = e.type === 'debit';
    if (d) { td += e.amount; saldo += e.amount; } else { tc += e.amount; saldo -= e.amount; }
    font('Plex', 'normal', 9);
    const lines = doc.splitTextToSize(e.desc, cols[1].w - 2 * pad);
    const h = Math.max(8.5, lines.length * 4.3 + 4.2);
    if (y + h > H - 40) { doc.addPage(); y = 20; header(); }
    const base = y + 5.6;
    color(INK);
    text(String(idx + 1), at(0), base, { align: 'center' });
    text(lines, at(1), base);
    const n = e.images.length;
    text(n ? 'Terlampir' + (n > 1 ? ` (${n})` : '') : d ? '-' : 'Tidak terlampir', at(2), base);
    font('PlexMono', 'normal', 9);
    text(d ? num(e.amount) : '-', at(3), base, { align: 'right' });
    text(d ? '-' : num(e.amount), at(4), base, { align: 'right' });
    text(acc(saldo), at(5), base, { align: 'right' });
    y += h;
    if (idx < state.entries.length - 1) { doc.setDrawColor(...LIGHT); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); }
  });
  rule(y, 0.3);
  y += 7;

  // ---------- Ringkasan ----------
  if (y + 52 > H - 20) { doc.addPage(); y = 20; }
  const sx = M + CW * 0.55, ex = W - M;
  const sumRow = (label, val, bold = false) => {
    font('Plex', bold ? 'bold' : 'normal', 9); color(bold ? INK : GRAY); text(label, sx, y);
    font('PlexMono', bold ? 'bold' : 'normal', 9); color(INK); text(val, ex, y, { align: 'right' });
  };
  sumRow('Total Debit (dana masuk)', 'Rp' + num(td)); y += 6;
  sumRow('Total Kredit (pengeluaran)', 'Rp' + num(tc)); y += 3.2;
  rule(y, 0.5, sx, ex); y += 5.6;
  sumRow('Saldo Akhir', acc(saldo, true), true); y += 7;

  // Terbilang + catatan
  const terb = `${saldo < 0 ? 'Minus ' : ''}${terbilang(Math.abs(saldo))} Rupiah`;
  font('Plex', 'italic', 8.5);
  const terbLines = doc.splitTextToSize(terb, CW - 30);
  const boxH = 4.6 + terbLines.length * 4.2 + 3;
  doc.setFillColor(...BOX); doc.rect(M, y, CW, boxH, 'F');
  font('Plex', 'bold', 8.5); color(INK); text('Terbilang:', M + 4, y + 5.6);
  const lw = doc.getTextWidth('Terbilang:') + 1.6;
  font('Plex', 'italic', 8.5); text(terbLines, M + 4 + lw, y + 5.6);
  y += boxH + 14;

  // ---------- Tanda tangan ----------
  // Hanya kolom yang diisi pengguna: 1 kolom untuk 1 penanda tangan, 2 untuk 2, dst.
  const signers = state.signers.filter((x) => x.name?.trim() || x.role?.trim() || x.sig);
  if (signers.length) {
    const n = signers.length, perRow = n === 4 ? 2 : Math.min(n, 3);
    const gapX = 12, colW = n === 1 ? (CW - gapX) / 2 : (CW - gapX * (perRow - 1)) / perRow, rowH = 40;
    signers.forEach((sg, i) => {
      const col = i % perRow, row = Math.floor(i / perRow);
      if (col === 0 && y + row * rowH + rowH > H - 18) { doc.addPage(); y = 24 - row * rowH; }
      const x = n === 1 ? W - M - colW : M + col * (colW + gapX);
      const yy = y + row * rowH;
      if (sg.sig) {
        const maxW = colW * 0.7, maxH = 20;
        let w = maxW, h = (sg.sig.h / sg.sig.w) * w;
        if (h > maxH) { h = maxH; w = (sg.sig.w / sg.sig.h) * h; }
        doc.addImage(sg.sig.src, 'PNG', x + 2, yy + (maxH - h), w, h);
      }
      rule(yy + 22, 0.25, x, x + colW);
      font('Plex', 'bold', 9.5); color(INK); text(sg.name || '', x, yy + 27.5);
      font('Plex', 'normal', 9); color(GRAY); text(sg.role || '', x, yy + 32.5);
    });
  }

  // ---------- Lampiran nota ----------
  const atts = [];
  state.entries.forEach((e, i) => e.images.forEach((img, k) => atts.push({ no: i + 1, e, img, k, n: e.images.length })));
  if (atts.length) {
    const gap = 6, top0 = 34, cellW = (CW - gap) / 2, cellH = (H - top0 - 22 - gap) / 2;
    atts.forEach((a, j) => {
      const slot = j % 4;
      if (slot === 0) {
        doc.addPage();
        font('Plex', 'normal', 7.5); color(GRAY);
        doc.setCharSpace(0.9); text('LAMPIRAN BUKTI TRANSAKSI', M, 20); doc.setCharSpace(0);
        font('Plex', 'bold', 13); color(INK); text(state.title || 'Laporan Pertanggungjawaban', M, 27);
        rule(30, 0.5);
      }
      const x = M + (slot % 2) * (cellW + gap);
      const yy = top0 + Math.floor(slot / 2) * (cellH + gap);
      doc.setDrawColor(...LIGHT); doc.setLineWidth(0.25); doc.rect(x, yy, cellW, cellH);
      font('PlexMono', 'bold', 9); color(INK); text(String(a.no).padStart(2, '0'), x + 4, yy + 6.5);
      font('Plex', 'normal', 8.5);
      const cap = doc.splitTextToSize(a.e.desc + (a.n > 1 ? ` (${a.k + 1}/${a.n})` : ''), cellW - 18);
      text(cap.slice(0, 2), x + 12, yy + 6.5);
      const top = yy + 15, bottom = yy + cellH - 11, maxW = cellW - 8, maxH = bottom - top;
      let iw = maxW, ih = (a.img.h / a.img.w) * iw;
      if (ih > maxH) { ih = maxH; iw = (a.img.w / a.img.h) * ih; }
      doc.addImage(a.img.src, 'JPEG', x + (cellW - iw) / 2, top + (maxH - ih) / 2, iw, ih, undefined, 'FAST');
      doc.setDrawColor(...LIGHT); doc.line(x + 4, yy + cellH - 8, x + cellW - 4, yy + cellH - 8);
      font('PlexMono', 'normal', 9); color(INK); text((a.e.type === 'debit' ? '+' : '-') + num(a.e.amount), x + cellW - 4, yy + cellH - 3.3, { align: 'right' });
    });
  }

  // Nomor halaman
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    font('PlexMono', 'normal', 9.5); color(INK);
    text(`page ${p}/${pages}`, W / 2, H - 12, { align: 'center' });
  }

  doc.setProperties({ title: state.title || 'LPJ', creator: 'LPJ Maker' });
  return doc;
}
