/*Solución del parcial: 
Fecha: 02/11/2026
Materia: Base de Datos.
Tema: Consultas SQL
*/

/*ejercicio 01*/
--1) Recuperar lista de clientes ordenados por apellido y nombre. Mostrar los datos suficientes para contactarlos.
SELECT apellido, nombre, telefono, direccion FROM cliente ORDER BY apellido ASC, nombre ASC;

--2) Visualizar los clientes que tengan asignados coches.
SELECT codigo, DNI, nombre FROM cliente WHERE codigo in (SELECT DISTINCT codigo_cliente_avala FROM coche);

--3) Listar todos los coches que tengan menos a 5 años de antigüedad (El modelo indica el año del vehículo).
SELECT matricula, modelo, marca, color FROM coche WHERE modelo >= (2026 - 5);
SELECT matricula, modelo, marca, color FROM coche WHERE modelo >= (Year(Getdate()) - 5);
SELECT matricula, modelo, marca, color FROM coche WHERE (Year(Getdate()) - modelo) <= 5;

--4) Contar la cantidad de coches que tengan de cada marca.
SELECT Marca, count(*) as cantidad FROM coche GROUP BY Marca;

--5) Listar el DNI y nombre del cliente y el coche asignado.
SELECT C.DNI, C.nombre, A.matricula, A.modelo, A.marca FROM 
cliente C INNER JOIN coche A ON C.codigo = A.codigo_cliente_avala
ORDER BY C.nombre ASC, A.matricula ASC;

--6) Mostrar fecha de inicio y fin de las reservas de la agencia “EL MILAGRO”. Ordenar por el precio.
SELECT codigo, fecha_inicio, fecha_fin FROM reserva WHERE codigo_agencia IN (SELECT codigo FROM agencia WHERE nombre = 'EL MILAGRO') ORDER BY precio_alquiler ASC;

--7) Mostrar las  5 reservas más caras de todas las agencias.
SELECT codigo, fecha_inicio, fecha_fin, matricula, codigo_cliente, codigo_agencia ORDER BY precio_alquiler DESC LIMIT 5;

--8) Lista  de todos los garajes y la matrícula de los autos aparcados ahí.
SELECT g.codigo, g.nombre, c.matricula, c.modelo, c.marca FROM garage g INNER JOIN coche c ON g.codigo = c.codigo_garaje;

--9) Mostrar las reservas que aún estén vigentes. Mostrar la matrícula del coche y la marca.
SELECT r.codigo, r.fecha_inicio, r.fecha_fin, c.matricula, c.marca FROM reserva r INNER JOIN coche C ON r.matricula = c.matricula WHERE r.fecha_fin is null;

--10) Mostrar el clientes que más reservas hechas tenga.
SELECT codigo, DNI, nombre FROM cliente WHERE codigo = (SELECT codigo_cliente FROM reserva GROUP BY codigo_cliente ORDER BY count(*) DESC LIMIT 1);


/*ejercicio 02*/
--1) Listado de pacientes mayores de edad, ordenados por apellido y nombre.(Use la función year)
SELECT id, apellido, nombre, cedula, telefono fecha_nacimiento FROM pacientes where year(getdate()) - year(fecha_nacimiento) >= 18;

--2) Listado de doctores mostrando su correo electrónico.
SELECT id, apellido, nombre, correo FROM doctores ;

--3) Listado de todas las especialidades de la clínica.
SELECT DISTINCT id, nombre, descripcion FROM  especialidedes;

--4) Listado de todos los consultorios de la ciudad de “Salta”
SELECT id, ciudad, descripcion, direccion, numero FROM consultorios WHERE ciudad  = 'Salta'

--5) Listado de todos los especialistas en “Pediatría”.
SELECT d.id, d.apellido, d.nombre, e.nombre as especialidad FROM doctores d INNER JOIN especialidades e ON d.id_especialidad = e.id WHERE nombre = 'Pediatría';

--6) Listado de los pacientes que tengan turno el día de la fecha. Mostrar el consultorio asignado.
SELECT p.id, p.apellido, p.nombre, cm.fecha_inicio, c.ciudad, c.descripcion FROM pacientes p INNER JOIN citas_medicas cm ON 
p.id = cm.id_paciente INNER JOIN consultorios_asignados ca ON cm.id_consultorios_asignados = ca.id INNER JOIN consultorios c
ON ca.id_consultorio = c.id
WHERE cm.fecha_inicio= getdate();

--7) Cantidad de reservas que hubieron en el mes de octubre 2026.
SELECT COUNT(*) FROM reservas WHERE fecha_inicio between '01/10/2026' and '31/10/2026';
SELECT COUNT(*) FROM reservas WHERE fecha_inicio  >= '01/10/2026' and fecha_inicio <= '31/10/2026';:where

--8) Mostrar el consultorio con más reservas asignadas.
SELECT id, ciudad, descripcion, direccion, numero FROM consultorios WHERE id = (SELECT id FROM consultorios_asignados ORDER BY count(*) DESC LIMIT 1);

--9) Mostrar las 5 citas con mayor duración (la duración se puede obtener restando las fechas de inicio y fin.
SELECT id, especiliadad, fecha_inicio, fecha_fin FROM citas_medicas cm ORDER BY (fecha_fin - fecha_incio) DESC LIMIT 5;

--10) Mostrar los médicos que hayan estado atendiendo el día 16/10/2026 en la ciudad de Metán.
SELECT d.id, d.apellido, d.nombre, cm.fecha_inicio FROM citas_medicas cm INNER JOIN consultrios_asignados ca 
ON cm.id_consultorios_asignados = ca.id INNER JOIN doctores d ON ca.id_doctor = d.id WHERE cm.fecha_inicio = '16/10/2026';