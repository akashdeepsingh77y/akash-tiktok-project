const gallery = document.getElementById('gallery');
const search = document.getElementById('search');
const count = document.getElementById('count');
const refreshBtn = document.getElementById('refreshBtn');

const dropzone = document.getElementById('dropzone');
const browseBtn = document.getElementById('browseBtn');
const fileInput = document.getElementById('fileInput');
const queue = document.getElementById('queue');

function sanitizeName(name) {
  // remove spaces and weird characters for display
  return name.replace(/[?#<>:"\\/|*]/g, '_');
}

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
        const pct = (e.loaded / e.total) * 100;
        onProgress(pct);
      }
    });
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('Upload failed: ' + xhr.status));
      }
    };
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
      await new Promise(r => setTimeout(r, 300)); // small pause
      await loadVideos();
    } catch (err) {
      console.error(err);
      status.textContent = 'Error';
      status.style.color = 'var(--danger)';
    }
  }
}

// Drag & drop + browse
browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFiles(fileInput.files));

;['dragenter','dragover'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.style.borderColor = 'rgba(124,58,237,0.5)';
  });
});
;['dragleave','drop'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.style.borderColor = 'rgba(255,255,255,0.18)';
  });
});
dropzone.addEventListener('drop', (e) => {
  handleFiles(e.dataTransfer.files);
});
dropzone.addEventListener('click', () => fileInput.click());

// Gallery rendering
let allVideos = [];
function renderGallery(filter = '') {
  const q = filter.trim().toLowerCase();
  const list = q ? allVideos.filter(v => v.name.toLowerCase().includes(q)) : allVideos;
  count.textContent = `${list.length} video${list.length === 1 ? '' : 's'}`;

  gallery.innerHTML = '';
  for (const v of list) {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <video src="${v.url}" controls playsinline preload="metadata"></video>
      <div class="meta">
        <div class="title" title="${v.name}">${v.name}</div>
        <div class="kit">
          <button class="pill" data-copy="${v.url}">Copy link</button>
        </div>
      </div>
    `;
    card.querySelector('[data-copy]').addEventListener('click', async (e) => {
      const link = e.currentTarget.getAttribute('data-copy');
      await navigator.clipboard.writeText(link);
      e.currentTarget.textContent = 'Copied!';
      setTimeout(() => e.currentTarget.textContent = 'Copy link', 1000);
    });
    gallery.appendChild(card);
  }
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
