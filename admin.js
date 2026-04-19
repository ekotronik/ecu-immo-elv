/* EKOTRONIK Admin Panel (Supabase + Cloudinary)
   - Requires: config.public.js with SUPABASE_URL, SUPABASE_ANON_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET
   - Uses Supabase Auth (email+password) for admin actions (insert/delete)
   - Uploads image to Cloudinary unsigned preset and stores metadata in Supabase table gallery_items
*/

(function(){
  const cfg = window.EKO_CONFIG || {};
  const envPill = document.getElementById('envPill');

  const emailEl = document.getElementById('email');
  const passEl  = document.getElementById('password');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const authStatus = document.getElementById('authStatus');

  const categoryEl = document.getElementById('category');
  const titleEl = document.getElementById('title');
  const descEl = document.getElementById('description');
  const fileEl = document.getElementById('file');
  const btnUpload = document.getElementById('btnUpload');
  const btnRefresh = document.getElementById('btnRefresh');
  const uploadStatus = document.getElementById('uploadStatus');
  const itemsEl = document.getElementById('items');

  function setPill(text, ok){
    envPill.textContent = text;
    envPill.style.borderColor = ok ? 'rgba(0,234,255,.35)' : 'rgba(255,106,0,.35)';
    envPill.style.background = ok ? 'rgba(0,234,255,.10)' : 'rgba(255,106,0,.10)';
  }

  // Validate config
  const hasSupabase = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const hasCloud = !!(cfg.CLOUDINARY_CLOUD_NAME && cfg.CLOUDINARY_UPLOAD_PRESET);
  if(hasSupabase && hasCloud) setPill('Konfiguracja OK', true);
  else setPill('Brak konfiguracji w config.public.js', false);

  if(!hasSupabase){
    authStatus.textContent = 'Uzupełnij config.public.js (SUPABASE_URL + SUPABASE_ANON_KEY).';
  }
  if(!hasCloud){
    uploadStatus.textContent = 'Uzupełnij config.public.js (CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET).';
  }

  // Create Supabase client
  const supabase = (hasSupabase && window.supabase) ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  async function refreshAuthUI(){
    if(!supabase){
      btnLogin.disabled = true;
      btnLogout.disabled = true;
      btnUpload.disabled = true;
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const loggedIn = !!session;

    btnLogin.disabled = loggedIn;
    btnLogout.disabled = !loggedIn;
    btnUpload.disabled = !loggedIn || !hasCloud;

    authStatus.textContent = loggedIn
      ? `Zalogowano: ${session.user.email}`
      : 'Niezalogowany.';
  }

  btnLogin.addEventListener('click', async ()=>{
    if(!supabase) return;
    const email = (emailEl.value || '').trim();
    const password = passEl.value || '';
    if(!email || !password){
      authStatus.textContent = 'Podaj e-mail i hasło.';
      return;
    }
    authStatus.textContent = 'Logowanie…';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if(error){
      authStatus.textContent = 'Błąd logowania: ' + error.message;
      return;
    }
    await refreshAuthUI();
    await loadItems();
  });

  btnLogout.addEventListener('click', async ()=>{
    if(!supabase) return;
    await supabase.auth.signOut();
    await refreshAuthUI();
  });

  // Upload to Cloudinary (unsigned)
  async function uploadToCloudinary(file){
    const url = `https://api.cloudinary.com/v1_1/${cfg.CLOUDINARY_CLOUD_NAME}/image/upload`;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', cfg.CLOUDINARY_UPLOAD_PRESET);
    // optional: folder (set also in preset for consistency)
    fd.append('folder', 'ekotronik/gallery');

    const res = await fetch(url, { method: 'POST', body: fd });
    const json = await res.json();
    if(!res.ok){
      throw new Error(json?.error?.message || ('Cloudinary HTTP ' + res.status));
    }
    return json;
  }

  async function addItemToSupabase(item){
    const { error } = await supabase
      .from('gallery_items')
      .insert([item]);
    if(error) throw error;
  }

  async function loadItems(){
    if(!supabase) return;
    itemsEl.innerHTML = '';
    uploadStatus.textContent = 'Ładowanie listy…';

    const { data, error } = await supabase
      .from('gallery_items')
      .select('id, category, title, description, image_url, created_at')
      .order('created_at', { ascending: false })
      .limit(24);

    if(error){
      uploadStatus.textContent = 'Błąd pobierania: ' + error.message;
      return;
    }

    uploadStatus.textContent = `Załadowano: ${data.length} (ostatnie 24)`;

    for(const row of data){
      const div = document.createElement('div');
      div.className = 'item';

      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = row.image_url;
      img.alt = row.title || 'Zdjęcie';
      thumb.appendChild(img);

      const meta = document.createElement('div');
      meta.className = 'meta';
      const b = document.createElement('b');
      b.textContent = `[${row.category}] ${row.title || '(bez tytułu)'}`;
      const p = document.createElement('p');
      p.textContent = row.description || '';
      const small = document.createElement('div');
      small.className = 'small';
      small.textContent = new Date(row.created_at).toLocaleString();

      const actions = document.createElement('div');
      actions.className = 'actions';
      const del = document.createElement('button');
      del.className = 'btn danger';
      del.type = 'button';
      del.textContent = 'Usuń wpis';
      del.addEventListener('click', async ()=>{
        if(!confirm('Usunąć wpis z galerii? (Zdjęcie na Cloudinary pozostanie, jeśli nie używamy signed delete)')) return;
        uploadStatus.textContent = 'Usuwanie…';
        const { error } = await supabase.from('gallery_items').delete().eq('id', row.id);
        if(error){
          uploadStatus.textContent = 'Błąd usuwania: ' + error.message;
          return;
        }
        await loadItems();
      });

      const open = document.createElement('a');
      open.className = 'btn';
      open.href = row.image_url;
      open.target = '_blank';
      open.rel = 'noopener';
      open.textContent = 'Otwórz';

      actions.appendChild(open);
      actions.appendChild(del);

      meta.appendChild(b);
      meta.appendChild(p);
      meta.appendChild(actions);
      meta.appendChild(small);

      div.appendChild(thumb);
      div.appendChild(meta);
      itemsEl.appendChild(div);
    }
  }

  btnRefresh.addEventListener('click', loadItems);

  btnUpload.addEventListener('click', async ()=>{
    if(!supabase) return;
    const file = fileEl.files?.[0];
    const category = (categoryEl.value || '').toUpperCase();
    const title = (titleEl.value || '').trim();
    const description = (descEl.value || '').trim();

    if(!file){
      uploadStatus.textContent = 'Wybierz plik zdjęcia.';
      return;
    }

    // basic validation
    if(!['ECU','IMMO','ELV','DIAG','PCB'].includes(category)){
      uploadStatus.textContent = 'Nieprawidłowa kategoria.';
      return;
    }

    btnUpload.disabled = true;
    uploadStatus.textContent = 'Upload do Cloudinary…';

    try{
      const uploaded = await uploadToCloudinary(file);
      const image_url = uploaded.secure_url;

      uploadStatus.textContent = 'Zapis do Supabase…';
      await addItemToSupabase({
        category,
        title,
        description,
        image_url,
        public_id: uploaded.public_id || null
      });

      uploadStatus.textContent = '✅ Dodano. Odśwież stronę i kliknij „Podgląd” w odpowiedniej kategorii projektu.';
      // reset
      fileEl.value = '';
      // keep category
      titleEl.value = '';
      descEl.value = '';

      await loadItems();
    }catch(e){
      uploadStatus.textContent = '❌ Błąd: ' + (e?.message || String(e));
    }finally{
      await refreshAuthUI();
    }
  });

  // Init
  (async ()=>{
    await refreshAuthUI();
    if(supabase){
      supabase.auth.onAuthStateChange(async ()=>{
        await refreshAuthUI();
      });
      // public list can be loaded even when logged out, but delete/insert will require auth
      await loadItems();
    }
  })();
})();
