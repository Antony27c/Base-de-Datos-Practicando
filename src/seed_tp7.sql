CREATE DATABASE IF NOT EXISTS jardineria;
USE jardineria;

CREATE TABLE oficinas (
    codigo_oficina  INT          NOT NULL,
    ciudad          VARCHAR(50)  NOT NULL,
    pais            VARCHAR(50)  NOT NULL,
    region          VARCHAR(50)  NULL,
    codigo_postal   VARCHAR(10)  NOT NULL,
    telefono        VARCHAR(20)  NOT NULL,
    PRIMARY KEY (codigo_oficina)
) ENGINE = InnoDB;

CREATE TABLE empleados (
    codigo_empleado INT          NOT NULL,
    nombre          VARCHAR(50)  NOT NULL,
    apellido        VARCHAR(50)  NOT NULL,
    email           VARCHAR(100) NOT NULL,
    codigo_oficina  INT          NOT NULL,
    codigo_jefe     INT          NULL,
    puesto          VARCHAR(50)  NOT NULL,
    PRIMARY KEY (codigo_empleado)
) ENGINE = InnoDB;

CREATE TABLE gama_productos (
    gama              VARCHAR(50)  NOT NULL,
    descripcion_texto TEXT         NULL,
    descripcion_html  TEXT         NULL,
    PRIMARY KEY (gama)
) ENGINE = InnoDB;

CREATE TABLE clientes (
    codigo_cliente              INT           NOT NULL,
    nombre_cliente              VARCHAR(100)  NOT NULL,
    nombre_contacto             VARCHAR(50)   NULL,
    apellido_contacto           VARCHAR(50)   NULL,
    telefono                    VARCHAR(20)   NOT NULL,
    direccion                   VARCHAR(150)  NOT NULL,
    ciudad                      VARCHAR(50)   NOT NULL,
    region                      VARCHAR(50)   NULL,
    pais                        VARCHAR(50)   NOT NULL,
    codigo_postal               VARCHAR(10)   NULL,
    codigo_empleado_rep_ventas  INT           NULL,
    limite_credito              DECIMAL(10,2) NULL,
    PRIMARY KEY (codigo_cliente)
) ENGINE = InnoDB;

CREATE TABLE pedidos (
    codigo_pedido   INT          NOT NULL,
    fecha_pedido    DATE         NOT NULL,
    fecha_esperada  DATE         NOT NULL,
    fecha_entrega   DATE         NULL,
    estado          VARCHAR(20)  NOT NULL,
    comentarios     TEXT         NULL,
    codigo_cliente  INT          NOT NULL,
    PRIMARY KEY (codigo_pedido)
) ENGINE = InnoDB;

CREATE TABLE productos (
    codigo_producto    VARCHAR(15)   NOT NULL,
    nombre             VARCHAR(70)   NOT NULL,
    gama_producto      VARCHAR(50)   NOT NULL,
    dimensiones        VARCHAR(25)   NULL,
    proveedor          VARCHAR(50)   NULL,
    descripcion        TEXT          NULL,
    cantidad_en_stock  SMALLINT      NOT NULL,
    precio_venta       DECIMAL(10,2) NOT NULL,
    precio_proveedor   DECIMAL(10,2) NULL,
    PRIMARY KEY (codigo_producto)
) ENGINE = InnoDB;

CREATE TABLE detalle_pedidos (
    id_detalle_pedido INT          NOT NULL AUTO_INCREMENT,
    codigo_pedido     INT          NOT NULL,
    codigo_producto   VARCHAR(15)  NOT NULL,
    cantidad          INT          NOT NULL,
    precio_unidad     DECIMAL(10,2) NOT NULL,
    numero_linea      INT          NOT NULL,
    PRIMARY KEY (id_detalle_pedido)
) ENGINE = InnoDB;

CREATE TABLE pagos (
    id_pago         INT           NOT NULL AUTO_INCREMENT,
    codigo_cliente  INT           NOT NULL,
    forma_pago      VARCHAR(30)   NOT NULL,
    id_transaccion  VARCHAR(50)   NOT NULL,
    fecha_pago      DATE          NOT NULL,
    total           DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id_pago)
) ENGINE = InnoDB;

ALTER TABLE empleados
ADD CONSTRAINT fk_oficina
FOREIGN KEY (codigo_oficina)
REFERENCES oficinas(codigo_oficina);

ALTER TABLE empleados
ADD CONSTRAINT fk_jefe
FOREIGN KEY (codigo_jefe)
REFERENCES empleados(codigo_empleado);

ALTER TABLE clientes
ADD CONSTRAINT fk_empleado_rep_ventas
FOREIGN KEY (codigo_empleado_rep_ventas)
REFERENCES empleados(codigo_empleado);

ALTER TABLE pedidos
ADD CONSTRAINT fk_cliente
FOREIGN KEY (codigo_cliente)
REFERENCES clientes(codigo_cliente);

ALTER TABLE productos
ADD CONSTRAINT fk_producto
FOREIGN KEY (gama_producto)
REFERENCES gama_productos(gama);

ALTER TABLE detalle_pedidos
ADD CONSTRAINT fk_pedido
FOREIGN KEY (codigo_pedido)
REFERENCES pedidos(codigo_pedido);

ALTER TABLE detalle_pedidos
ADD CONSTRAINT fk_detalle_producto
FOREIGN KEY (codigo_producto)
REFERENCES productos(codigo_producto);

ALTER TABLE pagos
ADD CONSTRAINT fk_pago_cliente
FOREIGN KEY (codigo_cliente)
REFERENCES clientes(codigo_cliente);

SELECT table_name, constraint_name, referenced_table_name
FROM information_schema.referential_constraints
WHERE constraint_schema = 'jardineria';

ALTER TABLE empleados
ADD CONSTRAINT uk_email UNIQUE (email);

ALTER TABLE productos
ADD CONSTRAINT chk_cantidad_stock
CHECK (cantidad_en_stock >= 100);

INSERT INTO oficinas (codigo_oficina, ciudad, pais, region, codigo_postal, telefono) VALUES
(1, 'Buenos Aires',   'Argentina', 'Buenos Aires',  'C1000', '+54 11 4321-0001'),
(2, 'Córdoba',        'Argentina', 'Córdoba',       'X5000', '+54 351 421-0002'),
(3, 'Madrid',         'España',    'Madrid',        '28001', '+34 91 555-0003'),
(4, 'Ciudad de México','México',   'CDMX',          '06000', '+52 55 5555-0004');

INSERT INTO empleados (codigo_empleado, nombre, apellido, email, codigo_oficina, codigo_jefe, puesto) VALUES
(1, 'Marcos',   'Rodríguez', 'mrodriguez@jardineria.com', 1, NULL, 'Director General'),
(2, 'Laura',    'Fernández', 'lfernandez@jardineria.com', 1, 1,    'Gerente de Ventas'),
(3, 'Carlos',   'Gómez',     'cgomez@jardineria.com',     2, 1,    'Gerente Regional'),
(4, 'Ana',      'López',     'alopez@jardineria.com',     1, 2,    'Representante de Ventas'),
(5, 'Diego',    'Martínez',  'dmartinez@jardineria.com',  2, 3,    'Representante de Ventas'),
(6, 'Sofía',    'Pérez',     'sperez@jardineria.com',     3, 2,    'Representante de Ventas'),
(7, 'Martín',   'Sánchez',   'msanchez@jardineria.com',   4, 3,    'Representante de Ventas'),
(8, 'Lucía',    'Torres',    'ltorres@jardineria.com',    1, 2,    'Asistente Administrativo');

INSERT INTO gama_productos (gama, descripcion_texto, descripcion_html) VALUES
('Herramientas', 'Herramientas de jardinería en general', '<p>Herramientas de <b>jardinería</b></p>'),
('Plantas',      'Plantas ornamentales y de interior',    '<p>Plantas <i>ornamentales</i></p>'),
('Macetas',      'Macetas de barro, plástico y cerámica', '<p>Macetas de <u>varios materiales</u></p>'),
('Semillas',     'Semillas de flores y hortalizas',       '<p>Semillas de <b>flores</b> y hortalizas</p>'),
('Fertilizantes','Fertilizantes y abonos para plantas',   '<p>Fertilizantes y <b>abonos</b></p>');

INSERT INTO clientes (codigo_cliente, nombre_cliente, nombre_contacto, apellido_contacto, telefono, direccion, ciudad, region, pais, codigo_postal, codigo_empleado_rep_ventas, limite_credito) VALUES
(101, 'Vivero El Roble',      'Juan',     'Suárez',  '+54 11 4444-1001', 'Av. San Martín 1200', 'Buenos Aires',    'Buenos Aires', 'Argentina', 'C1416', 4, 150000.00),
(102, 'Florería Las Flores',  'María',    'Castro',  '+54 351 444-1002', 'Belgrano 450',       'Córdoba',         'Córdoba',      'Argentina', 'X5000', 5,  80000.00),
(103, 'Jardines del Sur',     'Pedro',    'Vega',    '+54 11 4444-1003', 'Mitre 2300',         'La Plata',        'Buenos Aires', 'Argentina', 'B1900', 4, 120000.00),
(104, 'Garden Center Madrid', 'Carmen',   'Ruiz',    '+34 91 444-1004',  'Calle Mayor 15',     'Madrid',          'Madrid',       'España',    '28013', 6, 200000.00),
(105, 'Viveros de México',    'Roberto',  'Herrera', '+52 55 4444-1005', 'Insurgentes 800',    'Ciudad de México','CDMX',         'México',    '03100', 7, 175000.00),
(106, 'Patio Verde',          'Elena',    'Morales', '+54 351 444-1006', 'Rondeau 320',        'Córdoba',         'Córdoba',      'Argentina', 'X5000', 5,  50000.00);

INSERT INTO pedidos (codigo_pedido, fecha_pedido, fecha_esperada, fecha_entrega, estado, comentarios, codigo_cliente) VALUES
(1001, '2024-03-01', '2024-03-08', '2024-03-07', 'Entregado',  'Entrega sin novedad',          101),
(1002, '2024-03-05', '2024-03-12', '2024-03-12', 'Entregado',  NULL,                           102),
(1003, '2024-03-10', '2024-03-20', NULL,         'Enviado',    'Cliente pidió envío urgente',  103),
(1004, '2024-03-15', '2024-03-25', NULL,         'Pendiente',  'Esperando stock de macetas',   104),
(1005, '2024-03-18', '2024-03-28', NULL,         'Pendiente',  NULL,                           105),
(1006, '2024-03-20', '2024-03-27', '2024-03-26', 'Entregado',  'Reclamo por caja rota',        106);

INSERT INTO productos (codigo_producto, nombre, gama_producto, dimensiones, proveedor, descripcion, cantidad_en_stock, precio_venta, precio_proveedor) VALUES
('HER-001', 'Pala de mano',            'Herramientas', '30x10 cm',   'Tramontina',      'Pala metálica para trasplante',         250,  850.00,   500.00),
('HER-002', 'Tijera de podar',         'Herramientas', '20x8 cm',    'Bellota',         'Tijera de podar profesional',           180,  2400.00, 1500.00),
('PLA-001', 'Potus',                   'Plantas',      '15x15 cm',   'Vivero Norte',    'Planta de interior colgante',           300,  1200.00,  700.00),
('PLA-002', 'Rosa pitiminí',           'Plantas',      '20x20 cm',   'Vivero Norte',    'Rosal enano de flor pequeña',           150,  2500.00, 1600.00),
('MAC-001', 'Maceta de barro N° 8',    'Macetas',      '25x25x22 cm','Cerámica del Sur','Maceta artesanal de barro cocido',       400,   600.00,  350.00),
('MAC-002', 'Maceta plástica N° 10',   'Macetas',      '30x30x28 cm','PlastiGarden',    'Maceta plástica con plato',             500,   450.00,  250.00),
('SEM-001', 'Semillas de girasol',     'Semillas',     '10x15 cm',   'Semillas Plus',    'Sobre con 50 semillas de girasol',      600,   300.00,  120.00),
('SEM-002', 'Semillas de tomate',      'Semillas',     '10x15 cm',   'Semillas Plus',    'Sobre con semillas de tomate cherry',   450,   350.00,  150.00),
('FER-001', 'Fertilizante universal',  'Fertilizantes','20x10x8 cm', 'AgroChem',        'Fertilizante líquido 500 ml',           200,  1800.00, 1100.00),
('FER-002', 'Abono orgánico 1 kg',     'Fertilizantes','25x15x10 cm','EcoAbono',        'Abono orgánico para todo uso',          350,   950.00,  550.00);

INSERT INTO detalle_pedidos (codigo_pedido, codigo_producto, cantidad, precio_unidad, numero_linea) VALUES
(1001, 'PLA-001', 20, 1200.00, 1),
(1001, 'MAC-001', 30,  600.00, 2),
(1002, 'HER-002', 10, 2400.00, 1),
(1002, 'SEM-001', 50,  300.00, 2),
(1003, 'FER-001', 15, 1800.00, 1),
(1004, 'MAC-002', 40,  450.00, 1),
(1004, 'PLA-002', 12, 2500.00, 2),
(1005, 'SEM-002', 60,  350.00, 1),
(1006, 'HER-001', 25,  850.00, 1),
(1006, 'FER-002', 20,  950.00, 2);

INSERT INTO pagos (codigo_cliente, forma_pago, id_transaccion, fecha_pago, total) VALUES
(101, 'Transferencia', 'TRX-2024-0001', '2024-03-10', 42000.00),
(102, 'Tarjeta',       'TRX-2024-0002', '2024-03-13', 39000.00),
(103, 'Efectivo',      'TRX-2024-0003', '2024-03-15', 27000.00),
(104, 'Transferencia', 'TRX-2024-0004', '2024-03-22', 48000.00),
(105, 'Cheque',        'TRX-2024-0005', '2024-03-30', 21000.00),
(106, 'Tarjeta',       'TRX-2024-0006', '2024-03-28', 40250.00);
