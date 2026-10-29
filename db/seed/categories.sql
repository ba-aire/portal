BEGIN;

-- 1. Insertar Categorías con manejo de conflictos
INSERT INTO item_category (name) 
VALUES 
    ('EQUIPOS'), 
    ('PARTES'), 
    ('GASES')
ON CONFLICT (name) DO NOTHING; -- Evita insertar duplicados si ya existen

-- 2. Insertar Subcategorías para 'EQUIPOS'
WITH equipos AS (
    SELECT id FROM item_category WHERE name = 'EQUIPOS'
)
INSERT INTO item_subcategory (name, category_id)
SELECT sub.name, equipos.id
FROM (VALUES 
    ('ANALIZADOR'),
    ('MGC'),
    ('METEOROLOGICA'),
    ('ZAG'),
    ('BOMBA_EXTERNA'),
    ('UPS'),
    ('CLIMATIZACION')
) AS sub(name)
CROSS JOIN equipos
ON CONFLICT (name, category_id) DO NOTHING; -- Evita duplicados de subcategorías

-- 3. Insertar Subcategorías para 'PARTES'
WITH partes AS (
    SELECT id FROM item_category WHERE name = 'PARTES'
)
INSERT INTO item_subcategory (name, category_id)
SELECT sub.name, partes.id
FROM (VALUES 
    ('REPUESTO'),
    ('ACCESORIO'),
    ('CONSUMIBLE')
) AS sub(name)
CROSS JOIN partes
ON CONFLICT (name, category_id) DO NOTHING; -- Evita duplicados de subcategorías

-- 4. Insertar Subcategorías para 'GASES'
WITH gases AS (
    SELECT id FROM item_category WHERE name = 'GASES'
)
INSERT INTO item_subcategory (name, category_id)
SELECT sub.name, gases.id
FROM (VALUES 
    ('CILINDRO'),
    ('ACCESORIO')
) AS sub(name)
CROSS JOIN gases
ON CONFLICT (name, category_id) DO NOTHING; -- Evita duplicados de subcategorías

COMMIT;
