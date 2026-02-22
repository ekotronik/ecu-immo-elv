// EKOTRONIK public config (safe to expose: anon key + public endpoints)
// UZUPEŁNIJ DANYMI Z SUPABASE (Project URL + anon public key)
// oraz Cloudinary (Cloud name + upload preset)
window.EKO_CONFIG = {
  SUPABASE_URL: "https://zcjqjlubarucrjmulekg.supabase.co" ,
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjanFqbHViYXJ1Y3JqbXVsZWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MDA5MDAsImV4cCI6MjA4NzI3NjkwMH0.fzowgNVQnulSUb-dzMVA1FlpfTm8RMqnxEWvCZPEADA" ,
  // używane tylko przez /admin.html do uploadu zdjęć
  CLOUDINARY_CLOUD_NAME: "YOUR_CLOUD_NAME",
  CLOUDINARY_UPLOAD_PRESET: "YOUR_UNSIGNED_UPLOAD_PRESET"
};
