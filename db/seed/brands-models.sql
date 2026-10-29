BEGIN;

-- 1. Insertar Marcas (brands) con manejo de conflictos
INSERT INTO brand (name) 
VALUES 
    ('Thermo'),
    ('Ecotech'),
    ('Acoem'),
    ('Teledyne'),
    ('Horiba'),
    ('Siemens'),
    ('TSI'),
    ('MonitorEurope'),
    ('MonitorLabs'),
    ('Environnement'),
    ('ENVEA'),
    ('MetOne'),
    ('DAVIS'),
    ('Eaton')
ON CONFLICT (name) DO NOTHING; -- Evita insertar duplicados si ya existen



-- 2. Insertar Modelos para 'Thermo'
WITH thermo AS (
    SELECT id FROM brand WHERE name = 'Thermo'
)
INSERT INTO model (name, brand_id)
SELECT sub.name, thermo.id
FROM (VALUES 
    ('48i'),
    ('42i'),
    ('43i'),
    ('49i'),
    ('48c'),
    ('42c'),
    ('146c'),
    ('146i'),
    ('111'),
    ('F64C14')
) AS sub(name)
CROSS JOIN thermo
ON CONFLICT (name, brand_id) DO NOTHING; 

-- 3. Insertar Modelos para 'Ecotech'
WITH ecotech AS (
    SELECT id FROM brand WHERE name = 'Ecotech'
)
INSERT INTO model (name, brand_id)
SELECT sub.name, ecotech.id
FROM (VALUES 
    ('EC9830'),
    ('EC9841'),
    ('Serinus 10'),
    ('Serinus 30'),
    ('Serinus 40'),
    ('Serinus 50'),
    ('Serinus CAL3000'),
    ('SpirantBam 1020')
) AS sub(name)
CROSS JOIN ecotech
ON CONFLICT (name, brand_id) DO NOTHING; 

-- 4. Insertar Modelos para 'Acoem'
WITH acoem AS (
    SELECT id FROM brand WHERE name = 'Acoem'
)
INSERT INTO model (name, brand_id)
SELECT sub.name, acoem.id
FROM (VALUES 
    ('Serinus 10'),
    ('Serinus 30'),
    ('Serinus 40'),
    ('Serinus 50'),
    ('SpirantBam 1020')
) AS sub(name)
CROSS JOIN acoem
ON CONFLICT (name, brand_id) DO NOTHING; 

-- 5. Insertar Modelos para 'MetOne'
WITH metone AS (
    SELECT id FROM brand WHERE name = 'MetOne'
)
INSERT INTO model (name, brand_id)
SELECT sub.name, metone.id
FROM (VALUES 
    ('SpirantBam 1020')
) AS sub(name)
CROSS JOIN metone
ON CONFLICT (name, brand_id) DO NOTHING; 

-- 6. Insertar Modelos para 'Teledyne'
WITH teledyne AS (
    SELECT id FROM brand WHERE name = 'Teledyne'
)
INSERT INTO model (name, brand_id)
SELECT sub.name, teledyne.id
FROM (VALUES 
    ('T100'),
    ('T100U'),
    ('T200'),
    ('T300'),
    ('T400'),
    ('T700')
) AS sub(name)
CROSS JOIN teledyne
ON CONFLICT (name, brand_id) DO NOTHING; 

-- 7. Insertar Modelos para 'Teledyne'
WITH eaton AS (
    SELECT id FROM brand WHERE name = 'Eaton'
)
INSERT INTO model (name, brand_id)
SELECT sub.name, eaton.id
FROM (VALUES 
    ('9PX'),
    ('9SX')
) AS sub(name)
CROSS JOIN eaton
ON CONFLICT (name, brand_id) DO NOTHING; 


COMMIT;
