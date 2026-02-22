# EKOTRONIK – Supabase + Cloudinary (Panel admin galerii)

## 1) Supabase: utwórz projekt
1. Wejdź do Supabase i utwórz nowy projekt.
2. Wejdź w **Project Settings → API** i skopiuj:
   - **Project URL** (SUPABASE_URL)
   - **anon public key** (SUPABASE_ANON_KEY)

Wklej je do pliku `config.public.js`.

## 2) Supabase: utwórz tabelę `gallery_items`
W Supabase przejdź do **SQL Editor** i uruchom:

```sql
create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category text not null check (category in ('ECU','IMMO','ELV','DIAG','PCB')),
  title text,
  description text,
  image_url text not null,
  public_id text
);

create index if not exists gallery_items_category_idx on public.gallery_items (category);
create index if not exists gallery_items_created_at_idx on public.gallery_items (created_at desc);
```

## 3) Supabase: włącz RLS i polityki
**Cel:**
- każdy (anon) może **czytać** wpisy galerii (żeby galeria działała na stronie),
- tylko zalogowany admin może **dodawać/usuwać**.

W SQL Editor uruchom:

```sql
alter table public.gallery_items enable row level security;

-- public read (anon)
drop policy if exists "Public read" on public.gallery_items;
create policy "Public read" on public.gallery_items
  for select
  using (true);

-- only authenticated users can insert
 drop policy if exists "Admin insert" on public.gallery_items;
create policy "Admin insert" on public.gallery_items
  for insert
  to authenticated
  with check (true);

-- only authenticated users can delete
 drop policy if exists "Admin delete" on public.gallery_items;
create policy "Admin delete" on public.gallery_items
  for delete
  to authenticated
  using (true);
```

## 4) Supabase Auth: utwórz konto admin
1. Authentication → Users → **Add user**
2. Podaj email i hasło (Twoje).

Tymi danymi logujesz się w `admin.html`.

## 5) Cloudinary: unsigned upload preset
1. Utwórz konto Cloudinary
2. Settings → Upload → **Upload presets** → Add upload preset
3. Ustaw:
   - **Unsigned**: ON
   - **Folder**: `ekotronik/gallery`
   - (opcjonalnie) ograniczenia: max file size, allowed formats: jpg/png/webp
4. Skopiuj:
   - Cloud name
   - upload preset name

Wklej do `config.public.js`.

## 6) Publikacja
Wgraj pliki na hosting (GitHub Pages jest OK):
- `admin.html`, `admin.js`, `config.public.js`
- zaktualizowane `index.html`

Panel będzie dostępny pod: `https://twojadomena/admin.html`

## 7) Test
1. Wejdź w `admin.html` → zaloguj się.
2. Dodaj zdjęcie + tytuł + opis.
3. Wejdź na stronę główną → sekcja Galeria → kliknij „Podgląd” dla kategorii.

Powinno pokazać zdjęcia i opisy pobrane z Supabase.

## Uwaga bezpieczeństwa (ważne)
Ta wersja używa **unsigned** Cloudinary preset (najprościej, bez backendu). Jeśli chcesz:
- podpisywane uploady,
- usuwanie plików z Cloudinary z panelu,
- pełne zabezpieczenie przed nadużyciem presetu,

to robimy to jako **Supabase Edge Function** (wciąż bez własnego serwera).
