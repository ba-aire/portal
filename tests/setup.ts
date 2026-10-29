// Setup global de Vitest.
// Se ejecuta una vez por archivo de test ANTES de evaluar el módulo de test,
// así que es el lugar correcto para fijar variables de entorno por defecto.
//
// Esto hace la suite hermética y determinista (no depende de un .env presente):
// - SESSION_SECRET: clave para firmar/verificar los JWT de sesión (jose exige
//   una clave HS256 de >= 32 bytes; la de abajo tiene 44 bytes).
// - DATABASE_URL: db/drizzle.ts lanza un error en import si no está definida.
// - INFLUXDB_TOKEN: db/influx.ts crea el cliente con este token.
//
// Solo se asignan si no existen, para no pisar un .env real en desarrollo.
process.env.SESSION_SECRET ??= "dGVzdC1zZXNzaW9uLXNlY3JldC1rZXktMzJieXRlcw==";
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/testdb";
process.env.INFLUXDB_TOKEN ??= "test-influx-token";
