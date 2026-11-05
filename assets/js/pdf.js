// Membuat PDF LPJ langsung di browser dengan jsPDF.
import { rupiah, terbilang, tanggalIndo } from './format.js';

const NAVY = [15, 42, 74];
const SKY = [191, 219, 254];
const GREEN = [5, 150, 105];
const RED = [225, 29, 72];
const INK = [30, 41, 59];
const MUTED = [100, 116, 139];
const LINE = [226, 232, 240];
const ZEBRA = [248, 250, 252];

export function buildPdf(state) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 16, CW = W - 2 * M;
  const F = 'times';
  let y = M;

  const setColor = (c) => doc.setTextColor(...c);
  const text = (s, x, yy, opt = {}) => doc.text(Array.isArray(s) ? s : String(s), x, yy, opt);

  // ---------- Kop ----------
  let kopX = M;
  if (state.logo) {
    const lh = 16, lw = Math.min(30, (state.logo.w / state.logo.h) * lh);
    doc.addImage(state.logo.src, 'PNG', M, y, lw, lh);
    kopX = M + lw + 5;
  }
  doc.setFont(F, 'normal'); doc.setFontSize(8.5); setColor(MUTED);
  doc.setCharSpace(0.6);
  text('LEMBAR PERTANGGUNGJAWABAN ANGGARAN', kopX, y + 4);
  doc.setCharSpace(0);
  doc.setFont(F, 'bold'); doc.setFontSize(17); setColor(NAVY);
  const titleLines = doc.splitTextToSize(state.title || 'Laporan Pertanggungjawaban', W - M - kopX);
  text(titleLines, kopX, y + 11);
  let hy = y + 11 + (titleLines.length - 1) * 6.5;
  if (state.org) {
    doc.setFont(F, 'normal'); doc.setFontSize(11); setColor(INK);
    text(state.org, kopX, hy + 6); hy += 6;
  }
  if (state.city) {
    doc.setFont(F, 'normal'); doc.setFontSize(9); setColor(MUTED);
    const al = doc.splitTextToSize(state.city, W - M - kopX);
    text(al, kopX, hy + 5); hy += 5 + (al.length - 1) * 4;
  }
  y = Math.max(y + (state.logo ? 18 : 0), hy + 4);
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);
  doc.setDrawColor(...SKY); doc.setLineWidth(0.3); doc.line(M, y + 1, W - M, y + 1);
  y += 7;

  // Meta: penanggung jawab & tanggal
  const pj = state.pj?.trim() || state.signers.find((s) => s.name)?.name || '-';
  doc.setFont(F, 'normal'); doc.setFontSize(8); setColor(MUTED);
  text('PENANGGUNG JAWAB', M, y);
  text('TANGGAL', W - M, y, { align: 'right' });
  doc.setFont(F, 'bold'); doc.setFontSize(11); setColor(INK);
  text(pj, M, y + 5.5);
  text(tanggalIndo(state.date), W - M, y + 5.5, { align: 'right' });
  y += 12;

  // ---------- Tabel transaksi ----------
  const cols = [
    { k: 'no', t: 'NO', w: 11, a: 'center' },
    { k: 'desc', t: 'KETERANGAN', w: 73, a: 'left' },
    { k: 'nota', t: 'NOTA', w: 28, a: 'center' },
    { k: 'debit', t: 'DEBIT (RP)', w: 33, a: 'right' },
    { k: 'credit', t: 'KREDIT (RP)', w: CW - 11 - 73 - 28 - 33, a: 'right' },
  ];
  const colX = []; cols.reduce((x, c) => (colX.push(x), x + c.w), M);
  const pad = 2.6;

  const header = () => {
    doc.setFillColor(...NAVY);
    doc.roundedRect(M, y, CW, 9, 1.5, 1.5, 'F');
    doc.rect(M, y + 4, CW, 5, 'F');
    doc.setFont(F, 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
    cols.forEach((c, i) => {
      const x = c.a === 'left' ? colX[i] + pad : c.a === 'right' ? colX[i] + c.w - pad : colX[i] + c.w / 2;
      text(c.t, x, y + 5.8, { align: c.a });
    });
    y += 9;
  };
  const newPage = () => { doc.addPage(); y = M; header(); };

  header();
  let td = 0, tc = 0;
  state.entries.forEach((e, idx) => {
    const isDebit = e.type === 'debit';
    if (isDebit) td += e.amount; else tc += e.amount;
    doc.setFont(F, 'normal'); doc.setFontSize(10);
    const descLines = doc.splitTextToSize(e.desc, cols[1].w - 2 * pad);
    const h = Math.max(8.5, descLines.length * 4.6 + 4);
    if (y + h > H - M - 30) newPage();
    if (idx % 2 === 1) { doc.setFillColor(...ZEBRA); doc.rect(M, y, CW, h, 'F'); }
    const mid = y + h / 2 + 1.3;
    setColor(MUTED); text(String(idx + 1), colX[0] + cols[0].w / 2, mid, { align: 'center' });
    setColor(INK); text(descLines, colX[1] + pad, y + 5.3);
    doc.setFontSize(8.5);
    const n = e.images.length;
    setColor(n || isDebit ? MUTED : [190, 18, 60]);
    text(n ? (n > 1 ? `Terlampir (${n})` : 'Terlampir') : isDebit ? '—' : 'Tidak terlampir', colX[2] + cols[2].w / 2, mid, { align: 'center' });
    doc.setFontSize(10);
    if (isDebit) { setColor(GREEN); text(rupiah(e.amount, false), colX[3] + cols[3].w - pad, mid, { align: 'right' }); }
    else { setColor(MUTED); text('—', colX[3] + cols[3].w - pad, mid, { align: 'right' }); }
    if (!isDebit) { setColor(RED); text(rupiah(e.amount, false), colX[4] + cols[4].w - pad, mid, { align: 'right' }); }
    else { setColor(MUTED); text('—', colX[4] + cols[4].w - pad, mid, { align: 'right' }); }
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, y + h, W - M, y + h);
    y += h;
  });

  // Total & saldo
  if (y + 30 > H - M) newPage();
  doc.setFont(F, 'bold'); doc.setFontSize(10.5); setColor(INK);
  text('Total', colX[2] + cols[2].w - pad, y + 6, { align: 'right' });
  setColor(GREEN); text(rupiah(td, false), colX[3] + cols[3].w - pad, y + 6, { align: 'right' });
  setColor(RED); text(rupiah(tc, false), colX[4] + cols[4].w - pad, y + 6, { align: 'right' });
  y += 9.5;
  const bal = td - tc;
  doc.setFillColor(...NAVY); doc.roundedRect(M, y, CW, 16, 2, 2, 'F');
  doc.setFont(F, 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.setCharSpace(0.8); text('SALDO AKHIR', M + 6, y + 7); doc.setCharSpace(0);
  doc.setFont(F, 'italic'); doc.setFontSize(8.5); setColor(SKY);
  text(bal < 0 ? 'Pengeluaran melebihi dana masuk' : bal > 0 ? 'Sisa dana' : 'Dana habis terpakai', M + 6, y + 12);
  doc.setFont(F, 'bold'); doc.setFontSize(15);
  if (bal < 0) doc.setTextColor(253, 164, 175); else doc.setTextColor(167, 243, 208);
  text(rupiah(bal), W - M - 6, y + 10.3, { align: 'right' });
  y += 20;
  doc.setFont(F, 'italic'); doc.setFontSize(9); setColor(MUTED);
  const terb = doc.splitTextToSize(`Terbilang: ${terbilang(Math.abs(bal))} Rupiah${bal < 0 ? ' (minus)' : ''}`, CW);
  text(terb, M, y + 2); y += terb.length * 4.2 + 6;

  // ---------- Tanda tangan ----------
  const signers = state.signers.filter((s) => s.name || s.role || s.sig);
  if (signers.length) {
    const blockH = 48;
    if (y + blockH > H - M) { doc.addPage(); y = M + 4; }
    doc.setFont(F, 'normal'); doc.setFontSize(10.5); setColor(INK);
    const n = signers.length;
    const slotW = Math.min(62, CW / n);
    const startX = n === 1 ? W - M - slotW : M + (CW - slotW * n) / 2 + (n === 2 ? 0 : 0);
    const xs = signers.map((_, i) => (n === 1 ? startX : n === 2 ? (i === 0 ? M : W - M - slotW) : startX + i * slotW));
    signers.forEach((s, i) => {
      const cx = xs[i] + slotW / 2;
      doc.setFont(F, 'normal'); doc.setFontSize(10.5); setColor(INK);
      text(s.role || '', cx, y, { align: 'center' });
      if (s.sig) {
        const maxW = slotW - 8, maxH = 22;
        let sw = maxW, sh = (s.sig.h / s.sig.w) * sw;
        if (sh > maxH) { sh = maxH; sw = (s.sig.w / s.sig.h) * sh; }
        doc.addImage(s.sig.src, 'PNG', cx - sw / 2, y + 3 + (maxH - sh), sw, sh);
      }
      doc.setDrawColor(...INK); doc.setLineWidth(0.25);
      doc.line(cx - slotW / 2 + 6, y + 28, cx + slotW / 2 - 6, y + 28);
      doc.setFont(F, 'bold'); doc.setFontSize(10.5);
      text(s.name || '', cx, y + 33, { align: 'center' });
    });
    y += 38;
  }

  // ---------- Lampiran nota ----------
  const atts = [];
  state.entries.forEach((e, i) => e.images.forEach((img, k) => atts.push({ no: i + 1, e, img, k, n: e.images.length })));
  if (atts.length) {
    const gap = 6, cellW = (CW - gap) / 2, cellH = (H - 2 * M - 14 - gap) / 2;
    atts.forEach((a, j) => {
      const slot = j % 4;
      if (slot === 0) {
        doc.addPage();
        doc.setFont(F, 'bold'); doc.setFontSize(13); setColor(NAVY);
        text('Lampiran Bukti Transaksi', M, M + 4);
        doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, M + 7, W - M, M + 7);
      }
      const x = M + (slot % 2) * (cellW + gap);
      const yy = M + 12 + Math.floor(slot / 2) * (cellH + gap);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.roundedRect(x, yy, cellW, cellH, 2.5, 2.5, 'S');
      // Nomor + keterangan
      doc.setFillColor(...NAVY); doc.roundedRect(x + 4, yy + 4, 7, 6, 1.2, 1.2, 'F');
      doc.setFont(F, 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
      text(String(a.no), x + 7.5, yy + 8.2, { align: 'center' });
      setColor(INK); doc.setFontSize(9.5);
      const cap = doc.splitTextToSize(a.e.desc + (a.n > 1 ? ` (${a.k + 1}/${a.n})` : ''), cellW - 18);
      text(cap.slice(0, 2), x + 13, yy + 8.2);
      // Gambar
      const top = yy + 16, bottom = yy + cellH - 11;
      const maxW = cellW - 10, maxH = bottom - top;
      let iw = maxW, ih = (a.img.h / a.img.w) * iw;
      if (ih > maxH) { ih = maxH; iw = (a.img.w / a.img.h) * ih; }
      doc.addImage(a.img.src, 'JPEG', x + (cellW - iw) / 2, top + (maxH - ih) / 2, iw, ih, undefined, 'FAST');
      // Nominal
      doc.setDrawColor(...LINE); doc.line(x + 4, yy + cellH - 8, x + cellW - 4, yy + cellH - 8);
      doc.setFont(F, 'bold'); doc.setFontSize(9);
      setColor(a.e.type === 'debit' ? GREEN : RED);
      text(`${a.e.type === 'debit' ? 'Debit' : 'Kredit'} · ${rupiah(a.e.amount)}`, x + cellW - 4, yy + cellH - 3.2, { align: 'right' });
    });
  }

  // Nomor halaman
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont(F, 'normal'); doc.setFontSize(8); setColor(MUTED);
    text(`Halaman ${p} dari ${pages}`, W - M, H - 8, { align: 'right' });
    text('Dibuat dengan LPJ Maker', M, H - 8);
  }

  doc.setProperties({ title: state.title || 'LPJ', creator: 'LPJ Maker' });
  return doc;
}
