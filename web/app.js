const gallery = document.getElementById('gallery');
const search = document.getElementById('search');
const count = document.getElementById('count');
const refreshBtn = document.getElementById('refreshBtn');

const dropzone = document.getElementById('dropzone');
const browseBtn = document.getElementById('browseBtn');
const fileInput = document.getElementById('fileInput');
const queue = document.getElementById('queue');

function showQueueItem(file) {
  const el = document.createElement('div');
  el.className = 'queue-item';
  el.innerHTML = `
    <div>
      <div><strong>${file.name}</strong> <span class="status">(${(file.size/1e6).toFixed(2)} MB)</span></div>
      <div class="progress"><span></span></div>
    </div>
    <div class="status" data-status>Waiting…</div>
  `;
  queue.prepend(el);
  return el;
}

async function getSasUrl(filename, contentType) {
  const qs = new URLSearchParams({ filename, contentType });
  const res = await fetch(`/api/getSasUrl?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to get SAS URL');
  return await res.json();
}

function uploadWithProgress(file, uploadUrl, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress((e.loaded / e.total) * 100);
      }
    });
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('Upload failed: ' + xhr.status));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });
}

async function handleFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('video/')) continue;
    const row = showQueueItem(file);
    const bar = row.querySelector('.progress > span');
    const status = row.querySelector('[data-status]');
    try {
      status.textContent = 'Requesting SAS…';
      const meta = await getSasUrl(file.name, file.type);
      status.textContent = 'Uploading…';
      await uploadWithProgress(file, meta.uploadUrl, (pct) => {
        bar.style.width = pct.toFixed(1) + '%';
      });
      status.textContent = 'Uploaded ✓';
      status.style.color = 'var(--success)';
      await new Promise(r => setTimeout(r, 300));
      await loadVideos();
    } catch (err) {
      console.error(err);
      status.textContent = 'Error';
      status.style.color = 'var(--danger)';
    }
  }
}

browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFiles(fileInput.files));

;['dragenter','dragover'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.style.borderColor = 'rgba(124,58,237,0.5)'; });
});
;['dragleave','drop'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.style.borderColor = 'rgba(255,255,255,0.18)'; });
});
dropzone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
dropzone.addEventListener('click', () => fileInput.click());

let allVideos = [];

function starSvg(fill) {
  return `<svg class="star" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3.6l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.8 6.6 20.4l1-6.1L3.2 10l6.1-.9L12 3.6z" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor"'} />
  </svg>`;
}

function starsMarkup(avg) {
  const full = Math.round(avg);
  let html = `<div class="stars" title="${avg.toFixed(1)} / 5">`;
  for (let i=1;i<=5;i++) html += starSvg(i <= full);
  return html + `</div>`;
}

async function fetchMeta(name) {
  const res = await fetch(`/api/getVideoMeta?blobName=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error('meta fetch failed');
  return await res.json();
}

async function addComment(name, author, text) {
  const res = await fetch('/api/addComment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blobName: name, author, text })
  });
  if (!res.ok) throw new Error('add comment failed');
  return await res.json();
}

async function rateVideo(name, rating) {
  const res = await fetch('/api/rateVideo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blobName: name, rating })
  });
  if (!res.ok) throw new Error('rate failed');
  return await res.json();
}

function renderCard(v) {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <video src="${v.url}" controls playsinline preload="metadata"></video>
    <div class="meta">
      <div class="title" title="${v.name}">${v.name}</div>
      <div class="kit">
        <span class="rating" data-rating>Loading…</span>
        <button class="pill" data-toggle>Comments</button>
        <button class="pill" data-copy="${v.url}">Copy link</button>
      </div>
    </div>
    <div class="details" hidden>
      <div class="rate-box">
        <span>Rate:</span>
        <div class="rate-stars" role="radiogroup" aria-label="Rate this video">
          ${[1,2,3,4,5].map(i=>`<button class="rate" data-r="${i}" aria-label="${i} star">${starSvg(false)}</button>`).join('')}
        </div>
      </div>
      <div class="comments">
        <h4>Comments</h4>
        <ul class="comment-list"></ul>
        <form class="comment-form">
          <input name="author" placeholder="Your name (optional)" />
          <textarea name="text" required minlength="1" maxlength="1000" placeholder="Write a comment…"></textarea>
          <button class="btn primary">Post comment</button>
        </form>
      </div>
    </div>
  `;

  // copy link
  card.querySelector('[data-copy]').addEventListener('click', async (e) => {
    const link = e.currentTarget.getAttribute('data-copy');
    await navigator.clipboard.writeText(link);
    e.currentTarget.textContent = 'Copied!';
    setTimeout(() => e.currentTarget.textContent = 'Copy link', 1200);
  });

  // toggle comments panel
  const details = card.querySelector('.details');
  card.querySelector('[data-toggle]').addEventListener('click', async () => {
    details.hidden = !details.hidden;
    if (!details.hidden && !details.dataset.loaded) {
      try {
        const meta = await fetchMeta(v.name);
        updateMetaUI(card, meta);
        details.dataset.loaded = "1";
      } catch (e) {
        card.querySelector('[data-rating]').textContent = 'Meta error';
      }
    }
  });

  // rating buttons
  card.querySelectorAll('.rate').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = Number(btn.dataset.r);
      try {
        const meta = await rateVideo(v.name, r);
        updateRatingBadge(card, { avg: meta.avg, count: meta.count });
      } catch {
        alert('Rating failed');
      }
    });
  });

  // comment form
  const form = card.querySelector('.comment-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const author = fd.get('author')?.toString() || '';
    const text = fd.get('text')?.toString() || '';
    if (!text.trim()) return;
    form.querySelector('button').disabled = true;
    try {
      const res = await addComment(v.name, author, text);
      form.reset();
      const list = card.querySelector('.comment-list');
      list.innerHTML = '';
      for (const c of res.comments.slice().reverse()) {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${(c.author || 'Anonymous')}</strong> <span class="muted">• ${new Date(c.ts).toLocaleString()}</span><br>${escapeHtml(c.text)}`;
        list.appendChild(li);
      }
      updateRatingBadge(card, { avg: res.avg, count: res.count });
    } catch {
      alert('Comment failed');
    } finally {
      form.querySelector('button').disabled = false;
    }
  });

  // load rating summary immediately
  fetchMeta(v.name).then(meta => updateMetaUI(card, meta)).catch(()=> {
    card.querySelector('[data-rating]').textContent = '—';
  });

  return card;
}

function updateMetaUI(card, meta) {
  updateRatingBadge(card, { avg: meta.avg || 0, count: meta.ratings?.count || 0 });
  const list = card.querySelector('.comment-list');
  list.innerHTML = '';
  for (const c of (meta.comments || []).slice().reverse()) {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${(c.author || 'Anonymous')}</strong> <span class="muted">• ${new Date(c.ts).toLocaleString()}</span><br>${escapeHtml(c.text)}`;
    list.appendChild(li);
  }
}

function updateRatingBadge(card, { avg, count }) {
  const badge = card.querySelector('[data-rating]');
  badge.innerHTML = `${starsMarkup(avg || 0)} <span class="muted">(${count || 0})</span>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderGallery(filter = '') {
  const q = filter.trim().toLowerCase();
  const list = q ? allVideos.filter(v => v.name.toLowerCase().includes(q)) : allVideos;
  count.textContent = `${list.length} video${list.length === 1 ? '' : 's'}`;
  gallery.innerHTML = '';
  for (const v of list) gallery.appendChild(renderCard(v));
}

search.addEventListener('input', () => renderGallery(search.value));
refreshBtn.addEventListener('click', () => loadVideos());

async function loadVideos() {
  const res = await fetch('/api/listVideos');
  if (!res.ok) throw new Error('Failed to list videos');
  const data = await res.json();
  allVideos = data.videos ?? [];
  renderGallery(search.value);
}
loadVideos().catch(err => {
  console.error(err);
  gallery.innerHTML = '<p style="color:#ef4444">Failed to load videos. Check API configuration.</p>';
});
