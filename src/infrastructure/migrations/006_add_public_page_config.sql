alter table businesses
  add column if not exists horario_texto text null,
  add column if not exists fotos_galeria jsonb null,
  add column if not exists faq_items jsonb null,
  add column if not exists resenas jsonb null;
