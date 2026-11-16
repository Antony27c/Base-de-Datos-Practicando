# Base-de-Datos-Practicando

Entorno de práctica de SQL (MySQL) para el recuperatorio de Base de Datos, sobre la base JARDINERÍA.

- `index.html`: ruta rápida en 9 pasos alrededor del examen modelo, con decodificador de consignas, animaciones y ejercicios autocorregidos.
- `glosario.html`: glosario A–Z, guía completa, 99 ejercicios, simulacro y laboratorio.
- `jardineria_bbdd_oficial.sql`: script de la base oficial (repositorio DDBB-JARDINERIA) para cargar en MySQL.

Todo corre en el navegador (sql.js). Es un sitio estático: se despliega en Vercel sin configuración.

## Editar el contenido

Las páginas se generan desde `src/`:

```
python src/build.py
```

Tests (requieren `npm install sql.js@1.10.3` dentro de `src/`): `node t1.js`, `node t2.js`, `node t4.js`.
