-- Inserta datos de estaciones en la tabla locations
INSERT INTO location (name, image_url, operational_since, latitude, longitude, address, is_station)
VALUES
(
'Centenario',
'https://buenosaires.gob.ar/sites/default/files/styles/full_width/public/media/image/2015/12/18/507a431a07df170da69ff82797733fa33ba62cc7.jpg',
'2005-06-01',
-34.606350,
-58.432341,
'Ramos Mejía 880, Parque Centenario, CABA',
true
),
(
'La Boca',
'https://buenosaires.gob.ar/sites/default/files/styles/full_width/public/media/image/2015/12/18/6a16045fe7f267b358b87d9505f0787c9b2ad8aa.jpg',
'2009-01-01',
-34.625227,
-58.365535,
'Av. Brasil 100, La Boca, CABA',
true
),
(
'Córdoba',
'https://buenosaires.gob.ar/sites/default/files/styles/full_width/public/media/image/2015/12/18/ad83eca8d878eec0ba6b1af4c2ff33c900235c36.jpg',
'2009-05-01',
-34.599603,
-58.391276,
'Av. Córdoba y Rodríguez Peña, San Nicolás, CABA',
true
),
(
'CIFA',
'',
'2016-01-01',
-34.664427,
-58.468356,
'Paseo Islas Malvinas S/N, Villa Soldati, CABA',
true
),
(
'Integral Instruments',
'',
'2010-01-01',
-34.664427,
-58.468356,
'Dirección del Laboratorio de Martín',
false
);