-- Marca qué contactos (dueños de markets) reciben los listings desde tu cuenta personal de Telegram.
alter table contacts add column if not exists receives_listings boolean not null default false;
