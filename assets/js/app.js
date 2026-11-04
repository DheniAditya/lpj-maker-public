import { loadDraft, saveDraft, clearDraft } from './storage.js';
import { compressPhoto, compressLogo, cleanSignature, loadImage, readAsDataURL } from './image.js';
import { buildPdf } from './pdf.js';
import { rupiah, todayIso, parseNominal, escapeHtml } from './format.js';

const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);

const blank = () => ({
  title: '', org: '', city: '', date: todayIso(), logo: null,
  entries: [],
  signers: [{ id: uid(), role: 'Penanggung Jawab', name: '', sig: null }],
});

let state = blank();
let editingId = null;      // transaksi yang sedang diedit
let pendingImages = [];    // foto nota di form transaksi

// ---------- Simpan draf otomatis ----------
let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const ok = await saveDraft(state);
    $('#saved-status').textContent = ok ? 'Draf tersimpan di perangkat ini.' : '';
  }, 400);
  updateDownloadState();
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 2600);
}

// ---------- Info laporan ----------
const infoFields = { title: '#f-title', org: '#f-org', city: '#f-city', date: '#f-date' };
function renderInfo() {
  for (const [k, sel] of Object.entries(infoFields)) $(sel).value = state[k] || '';
  $('#logo-preview').hidden = !state.logo;
  $('#logo-remove').hidden = !state.logo;
  if (state.logo) $('#logo-preview').src = state.logo.src;
}
for (const [k, sel] of Object.entries(infoFields)) {
  $(sel).addEventListener('input', (e) => { state[k] = e.target.value; persist(); });
}
$('#f-logo').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { state.logo = await compressLogo(f); renderInfo(); persist(); } catch { toast('Logo tidak bisa dibaca.'); }
});
$('#logo-remove').addEventListener('click', () => { state.logo = null; renderInfo(); persist(); });

// ---------- Form transaksi ----------
const amountInput = $('#tx-amount');
amountInput.addEventListener('input', () => {
  const n = parseNominal(amountInput.value);
  amountInput.value = n ? rupiah(n, false) : '';
});

async function addFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith('image/')) { toast('Bukti transaksi harus berupa gambar.'); continue; }
    try { pendingImages.push({ id: uid(), ...(await compressPhoto(f)) }); } catch { toast('Ada gambar yang tidak bisa dibaca.'); }
  }
  renderThumbs();
}
['#tx-files', '#tx-camera'].forEach((sel) => $(sel).addEventListener('change', async (e) => {
  const files = [...e.target.files]; e.target.value = '';
  await addFiles(files);
}));

function renderThumbs() {
  $('#tx-thumbs').innerHTML = pendingImages.map((img) =>
    `<div class="thumb"><img src="${img.src}" alt="Nota"><button type="button" data-rm="${img.id}" aria-label="Hapus nota">✕</button></div>`).join('');
}
$('#tx-thumbs').addEventListener('click', (e) => {
  const id = e.target.dataset.rm;
  if (id) { pendingImages = pendingImages.filter((i) => i.id !== id); renderThumbs(); }
});

function resetTxForm() {
  editingId = null; pendingImages = [];
  $('#tx-desc').value = ''; amountInput.value = '';
  document.querySelector('input[name=type][value=credit]').checked = true;
  $('#tx-submit').textContent = 'Simpan Transaksi';
  $('#tx-cancel').hidden = true;
  renderThumbs();
}
$('#tx-cancel').addEventListener('click', resetTxForm);

$('#tx-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const desc = $('#tx-desc').value.trim();
  const amount = parseNominal(amountInput.value);
  const type = document.querySelector('input[name=type]:checked').value;
  if (!desc) return toast('Isi keterangan transaksi.');
  if (!amount) return toast('Isi nominal transaksi.');
  const entry = { id: editingId || uid(), type, desc, amount, images: pendingImages };
  if (editingId) state.entries = state.entries.map((x) => (x.id === editingId ? entry : x));
  else state.entries.push(entry);
  toast(editingId ? 'Transaksi diperbarui.' : 'Transaksi disimpan.');
  resetTxForm(); renderEntries(); persist();
});

function renderEntries() {
  const body = $('#tx-body');
  if (!state.entries.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">Belum ada transaksi</td></tr>';
  } else {
    body.innerHTML = state.entries.map((e, i) => {
      const n = e.images.length;
      const nota = n ? `<span class="badge">${n} nota</span>` : e.type === 'debit' ? '<span class="muted">—</span>' : '<span class="badge none">Belum ada nota</span>';
      return `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(e.desc)}<div class="nota-m">${nota}</div></td>
        <td>${nota}</td>
        <td class="r amount ${e.type}">${e.type === 'debit' ? '+' : '-'} ${rupiah(e.amount, false)}</td>
        <td class="r"><span class="row-actions">
          <button type="button" data-edit="${e.id}">Ubah</button>
          <button type="button" data-del="${e.id}">Hapus</button>
        </span></td></tr>`;
    }).join('');
  }
  const d = state.entries.filter((e) => e.type === 'debit').reduce((s, e) => s + e.amount, 0);
  const c = state.entries.filter((e) => e.type === 'credit').reduce((s, e) => s + e.amount, 0);
  $('#sum-debit').textContent = rupiah(d);
  $('#sum-credit').textContent = rupiah(c);
  const bal = $('#sum-balance');
  bal.textContent = rupiah(d - c);
  bal.className = 'r ' + (d - c < 0 ? 'credit' : 'debit');
}
$('#tx-body').addEventListener('click', (e) => {
  const edit = e.target.dataset.edit, del = e.target.dataset.del;
  if (edit) {
    const x = state.entries.find((i) => i.id === edit);
    editingId = x.id; pendingImages = [...x.images];
    $('#tx-desc').value = x.desc; amountInput.value = rupiah(x.amount, false);
    document.querySelector(`input[name=type][value=${x.type}]`).checked = true;
    $('#tx-submit').textContent = 'Simpan Perubahan';
    $('#tx-cancel').hidden = false;
    renderThumbs();
    $('#tx-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (del && confirm('Hapus transaksi ini beserta notanya?')) {
    state.entries = state.entries.filter((i) => i.id !== del);
    if (editingId === del) resetTxForm();
    renderEntries(); persist();
  }
});

// ---------- Penanda tangan ----------
function renderSigners() {
  $('#signers').innerHTML = state.signers.map((s, i) => `
    <div class="signer" data-id="${s.id}">
      <div class="signer-head"><span>Penanda tangan ${i + 1}</span>
        ${state.signers.length > 1 ? `<button type="button" class="btn btn-ghost btn-sm" data-rm-signer="${s.id}">Hapus</button>` : ''}</div>
      <label class="field">Jabatan<input type="text" data-k="role" value="${escapeHtml(s.role)}" placeholder="Contoh: Ketua Panitia"></label>
      <label class="field">Nama<input type="text" data-k="name" value="${escapeHtml(s.name)}" placeholder="Nama lengkap"></label>
      <div class="sig-box" data-sign="${s.id}" role="button" tabindex="0">
        ${s.sig ? `<img src="${s.sig.src}" alt="Tanda tangan ${escapeHtml(s.name)}">` : 'Klik untuk tanda tangan'}
      </div>
    </div>`).join('');
}
$('#signers').addEventListener('input', (e) => {
  const k = e.target.dataset.k; if (!k) return;
  const s = state.signers.find((x) => x.id === e.target.closest('.signer').dataset.id);
  s[k] = e.target.value; persist();
});
$('#signers').addEventListener('click', (e) => {
  const rm = e.target.closest('[data-rm-signer]');
  if (rm) { state.signers = state.signers.filter((s) => s.id !== rm.dataset.rmSigner); renderSigners(); persist(); return; }
  const box = e.target.closest('[data-sign]');
  if (box) openSignature(box.dataset.sign);
});
$('#signers').addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.sign) { e.preventDefault(); openSignature(e.target.dataset.sign); }
});
$('#add-signer').addEventListener('click', () => {
  if (state.signers.length >= 4) return toast('Maksimal 4 penanda tangan.');
  state.signers.push({ id: uid(), role: state.signers.length === 1 ? 'Mengetahui' : '', name: '', sig: null });
  renderSigners(); persist();
});

// ---------- Dialog tanda tangan ----------
const dlg = $('#sig-dialog'), canvas = $('#sig-canvas'), ctx = canvas.getContext('2d');
let signingId = null, drawn = false, sigFileImg = null;

function fitCanvas() {
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111827';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, r.width, r.height);
  drawn = false;
}
function setMode(mode) {
  $('#sig-draw').hidden = mode !== 'draw';
  $('#sig-image').hidden = mode !== 'image';
  if (mode === 'draw') requestAnimationFrame(fitCanvas);
}
document.querySelectorAll('input[name=sigmode]').forEach((r) => r.addEventListener('change', () => setMode(r.value)));

function openSignature(id) {
  signingId = id; sigFileImg = null;
  $('#sig-file-preview').hidden = true;
  document.querySelector('input[name=sigmode][value=draw]').checked = true;
  dlg.showModal(); setMode('draw');
}
let last = null;
const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); last = pos(e); ctx.beginPath(); ctx.arc(last.x, last.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = '#111827'; ctx.fill(); drawn = true; });
canvas.addEventListener('pointermove', (e) => {
  if (!last) return;
  const p = pos(e);
  ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
  last = p;
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => canvas.addEventListener(ev, () => (last = null)));
$('#sig-clear').addEventListener('click', fitCanvas);
$('#sig-file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    sigFileImg = await loadImage(await readAsDataURL(f));
    $('#sig-file-preview').src = sigFileImg.src; $('#sig-file-preview').hidden = false;
  } catch { toast('Gambar tidak bisa dibaca.'); }
});
$('#sig-save').addEventListener('click', (e) => {
  const mode = document.querySelector('input[name=sigmode]:checked').value;
  const source = mode === 'draw' ? (drawn ? canvas : null) : sigFileImg;
  const sig = source && cleanSignature(source);
  if (!sig) { e.preventDefault(); toast(mode === 'draw' ? 'Tulis tanda tangan dulu.' : 'Pilih gambar tanda tangan dulu.'); return; }
  const s = state.signers.find((x) => x.id === signingId);
  if (s) { s.sig = sig; renderSigners(); persist(); }
});

// ---------- Download & reset ----------
function updateDownloadState() {
  const ready = state.title.trim() && state.entries.length;
  $('#btn-pdf').disabled = !ready;
  $('#dl-hint').textContent = ready ? 'PDF dibuat di perangkatmu, tidak diunggah ke mana pun.' : 'Lengkapi judul dan minimal satu transaksi.';
}
$('#btn-pdf').addEventListener('click', async () => {
  const btn = $('#btn-pdf');
  btn.disabled = true; btn.textContent = 'Membuat PDF...';
  try {
    await new Promise((r) => setTimeout(r, 30));
    const doc = buildPdf(state);
    const name = (state.title.trim() || 'LPJ').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
    doc.save(`LPJ - ${name}.pdf`);
  } catch (err) {
    console.error(err); toast('Gagal membuat PDF. Coba lagi.');
  } finally {
    btn.textContent = 'Download PDF'; updateDownloadState();
  }
});
$('#btn-reset').addEventListener('click', async () => {
  if (!confirm('Mulai LPJ baru? Semua data LPJ ini (termasuk foto nota dan tanda tangan) dihapus dari perangkat ini.')) return;
  await clearDraft(); state = blank(); resetTxForm(); renderAll(); persist();
  toast('Siap untuk LPJ baru.');
});

function renderAll() { renderInfo(); renderEntries(); renderSigners(); updateDownloadState(); }

(async () => {
  const saved = await loadDraft();
  if (saved) { state = { ...blank(), ...saved }; $('#saved-status').textContent = 'Draf sebelumnya dimuat dari perangkat ini.'; }
  renderAll();
})();
