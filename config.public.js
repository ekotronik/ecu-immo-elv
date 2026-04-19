// EKOTRONIK public config (safe to expose: anon key + public endpoints)
// UZUPEŁNIJ DANYMI Z SUPABASE (Project URL + anon public key)
// oraz Cloudinary (Cloud name + upload preset)
window.EKO_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_PUBLIC_KEY",

  // używane tylko przez /admin.html do uploadu zdjęć
  CLOUDINARY_CLOUD_NAME: "YOUR_CLOUD_NAME",
  CLOUDINARY_UPLOAD_PRESET: "YOUR_UNSIGNED_UPLOAD_PRESET"
};
