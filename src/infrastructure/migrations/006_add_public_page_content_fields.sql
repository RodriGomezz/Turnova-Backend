alter table public.businesses
  add column if not exists horario_texto text,
  add column if not exists fotos_galeria text[] default '{}'::text[],
  add column if not exists faq_items jsonb default '[]'::jsonb;
