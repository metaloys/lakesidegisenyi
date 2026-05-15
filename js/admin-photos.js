// Photos Manager — Wired to Supabase Storage
// Handles photo uploads, management, and storage with real Supabase backend

let photoLibrary = [];
let currentPhotoFilter = 'all';
let uploadQueue = [];

// ── LOAD PHOTOS FROM SUPABASE ──
async function loadPhotosFromStorage() {
  try {
    const storage = LakesideAuth.db.storage.from('lakeside-photos');
    const { data: files, error } = await storage.list('');
    
    if (error && error.message !== 'The resource was not found') throw error;
    
    photoLibrary = (files || []).map((file, idx) => ({
      id: 'p' + idx,
      name: file.name,
      url: LakesideAuth.db.storage.from('lakeside-photos').getPublicUrl(file.name).data.publicUrl,
      category: file.metadata?.category || 'gallery',
      size: file.metadata?.size || 0,
      uploadedAt: file.created_at,
      featured: file.metadata?.featured || false,
      storagePath: file.name
    }));
  } catch (error) {
    console.error('Error loading photos:', error);
    photoLibrary = [];
  }
}

// ── RENDER PHOTO GRID ──
function renderPhotoGrid() {
  const grid = document.getElementById('photoGrid');
  const list = currentPhotoFilter === 'all'
    ? photoLibrary
    : photoLibrary.filter(p => p.category === currentPhotoFilter);

  document.getElementById('photo-count').textContent = `${photoLibrary.length} photos`;

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <span class="empty-icon">⊙</span>
      <div class="empty-text">No photos in this category yet.<br>Upload some above.</div>
    </div>`;
    return;
  }

  grid.innerHTML = list.map(p => `
    <div class="photo-item" id="photo-${p.id}">
      <img src="${p.url}" alt="${p.name}" loading="lazy"/>
      <div class="photo-badge ${p.category}">${p.category}</div>
      <div class="photo-overlay">
        <button class="photo-action-btn" onclick="toggleFeatured('${p.id}')">
          ${p.featured ? '★ Unfeature' : '☆ Set Featured'}
        </button>
        <button class="photo-action-btn" onclick="copyPhotoUrl('${p.id}')">⊕ Copy URL</button>
        <button class="photo-action-btn del" onclick="deletePhoto('${p.id}')">✕ Delete</button>
      </div>
      <div class="photo-name">${p.name}</div>
    </div>`).join('');

  // Update storage bar
  const totalBytes = photoLibrary.reduce((a, p) => a + p.size, 0);
  const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
  const pct = Math.min((totalBytes / (1024*1024*1024)) * 100, 100).toFixed(1);
  document.getElementById('storage-label').textContent = `${totalMB} MB of 1 GB used`;
  document.getElementById('storage-pct').textContent = `${pct}%`;
  document.getElementById('storage-bar').style.width = pct + '%';
}

function filterPhotos(cat, btn) {
  currentPhotoFilter = cat;
  document.querySelectorAll('.gallery-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderPhotoGrid();
}

function toggleFeatured(id) {
  const photo = photoLibrary.find(p => p.id === id);
  if (photo) {
    photo.featured = !photo.featured;
    renderPhotoGrid();
    showToast(photo.featured ? `${photo.name} set as featured ✓` : 'Removed from featured');
  }
}

function copyPhotoUrl(id) {
  const photo = photoLibrary.find(p => p.id === id);
  if (photo) {
    navigator.clipboard.writeText(photo.url).then(() => {
      showToast('URL copied to clipboard ✓');
    });
  }
}

function deletePhoto(id) {
  const photo = photoLibrary.find(p => p.id === id);
  if (!photo) return;
  if (!confirm(`Delete "${photo.name}"? This cannot be undone.`)) return;
  
  // Delete from Supabase Storage
  (async () => {
    try {
      await LakesideAuth.db.storage.from('lakeside-photos').remove([photo.storagePath]);
      photoLibrary = photoLibrary.filter(p => p.id !== id);
      
      // Animate out
      const el = document.getElementById('photo-' + id);
      if (el) { el.style.opacity = '0'; el.style.transform = 'scale(0.9)'; el.style.transition = '0.3s'; }
      setTimeout(() => renderPhotoGrid(), 300);
      showToast(`${photo.name} deleted ✓`);
    } catch (error) {
      console.error('Error deleting photo:', error);
      showToast('Error deleting photo');
    }
  })();
}

// ── FILE SELECTION & DRAG DROP ──
function handleFileSelect(files) {
  addFilesToQueue(Array.from(files));
}

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.add('dragover');
}

function handleDragLeave(e) {
  document.getElementById('uploadZone').classList.remove('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  addFilesToQueue(files);
}

function addFilesToQueue(files) {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const valid = files.filter(f => {
    if (f.size > MAX_SIZE) { showToast(`${f.name} is too large (max 5MB)`); return false; }
    return true;
  });
  uploadQueue.push(...valid);
  renderUploadQueue();
}

function renderUploadQueue() {
  const container = document.getElementById('uploadQueue');
  const btn = document.getElementById('uploadBtn');

  if (uploadQueue.length === 0) {
    container.innerHTML = '';
    btn.style.display = 'none';
    return;
  }

  btn.style.display = 'block';

  container.innerHTML = uploadQueue.map((f, i) => {
    const url = URL.createObjectURL(f);
    const sizeMB = (f.size / 1024 / 1024).toFixed(2);
    return `
      <div class="queue-item" id="qitem-${i}">
        <img class="queue-thumb" src="${url}" alt="${f.name}"/>
        <span class="queue-name">${f.name}</span>
        <span class="queue-size">${sizeMB}MB</span>
        <div class="queue-bar-wrap"><div class="queue-bar" id="qbar-${i}"></div></div>
        <span class="queue-status uploading" id="qstatus-${i}">Queued</span>
      </div>`;
  }).join('');
}

// ── UPLOAD PROCESSOR ──
// Uploads files to Supabase Storage with progress tracking
async function processUploadQueue() {
  if (uploadQueue.length === 0) return;

  const btn = document.getElementById('uploadBtn');
  btn.textContent = 'Uploading…';
  btn.disabled = true;

  const category = document.getElementById('upload-category').value;
  const storage = LakesideAuth.db.storage.from('lakeside-photos');

  for (let i = 0; i < uploadQueue.length; i++) {
    const file = uploadQueue[i];
    const statusEl = document.getElementById('qstatus-' + i);
    const barEl    = document.getElementById('qbar-' + i);

    if (statusEl) statusEl.textContent = 'Uploading';
    if (statusEl) statusEl.className = 'queue-status uploading';

    try {
      const path = `${category}/${Date.now()}-${file.name}`;
      
      // Real upload to Supabase Storage
      const { data, error } = await storage.upload(path, file, { 
        cacheControl: '3600', 
        upsert: false 
      });
      
      if (error) throw error;

      const { data: urlData } = storage.getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      // Add to library
      photoLibrary.unshift({
        id:         'p' + Date.now() + i,
        name:       file.name,
        url:        publicUrl,
        category:   category,
        size:       file.size,
        uploadedAt: new Date().toISOString().split('T')[0],
        featured:   false,
        storagePath: path
      });

      if (statusEl) { statusEl.textContent = 'Done ✓'; statusEl.className = 'queue-status done'; }
      if (barEl) barEl.style.width = '100%';

    } catch (err) {
      console.error('Upload error:', err);
      if (statusEl) { statusEl.textContent = 'Failed'; statusEl.className = 'queue-status error'; }
    }
  }

  // Reset
  setTimeout(() => {
    uploadQueue = [];
    renderUploadQueue();
    renderPhotoGrid();
    btn.textContent = 'Upload All Photos →';
    btn.disabled = false;
    showToast(`${photoLibrary.length > 0 ? 'Photos uploaded successfully ✓' : 'Upload complete'}`);
  }, 600);
}

// ── TOAST ──
