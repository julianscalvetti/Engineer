-- Example data for a metal-mechanical company.

BEGIN;

INSERT INTO companies (id, name, tax_identifier, status) VALUES
('00000000-0000-0000-0000-000000000001', 'Metalurgica Rio Norte SA', 'AR-30711222334', 'active');

INSERT INTO plants (id, company_id, code, name, location, status) VALUES
('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'PLT-BA', 'Planta Buenos Aires', 'Buenos Aires, Argentina', 'active');

INSERT INTO products (id, plant_id, code, name, description, object_type, status) VALUES
('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'EJE-100', 'Eje mecanizado 100 mm', 'Eje de acero mecanizado para conjunto rotativo.', 'piece', 'active'),
('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', 'BRK-200', 'Soporte perforado 200', 'Soporte metalico con patron de perforaciones.', 'piece', 'active');

INSERT INTO operations (id, plant_id, code, name, description, status) VALUES
('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', 'CORTE', 'Corte de material', 'Corte inicial de barra o placa.', 'active'),
('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000101', 'TORNEADO', 'Torneado CNC', 'Mecanizado por torneado.', 'active'),
('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000101', 'PERFORADO', 'Perforado', 'Operacion de perforado de piezas.', 'active'),
('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000101', 'INSPECCION', 'Inspeccion final', 'Control final visual y dimensional.', 'active');

INSERT INTO resources (id, plant_id, code, name, resource_type, status) VALUES
('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', 'SIERRA-01', 'Sierra automatica 01', 'machine', 'active'),
('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000101', 'CNC-01', 'Torno CNC 01', 'machine', 'active'),
('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000101', 'PUESTO-QA', 'Puesto de control final', 'station', 'active');

INSERT INTO operation_resources (id, plant_id, operation_id, resource_id, status) VALUES
('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000401', 'active'),
('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000402', 'active'),
('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000402', 'active'),
('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000403', 'active');

INSERT INTO product_operations (id, plant_id, product_id, operation_id, sequence_number, is_mandatory, status) VALUES
('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', 10, true, 'active'),
('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000302', 20, true, 'active'),
('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000304', 30, true, 'active'),
('00000000-0000-0000-0000-000000000604', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000301', 10, true, 'active'),
('00000000-0000-0000-0000-000000000605', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000303', 20, true, 'active'),
('00000000-0000-0000-0000-000000000606', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000304', 30, true, 'active');

INSERT INTO control_characteristics (id, plant_id, product_operation_id, code, name, data_type, unit_of_measure, criticality, control_method, status) VALUES
('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000602', 'DIAM-EXT', 'Diametro exterior', 'numeric', 'mm', 'critical', 'Micrometro calibrado', 'active'),
('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000605', 'CANT-AGUJ', 'Cantidad de agujeros', 'numeric', 'un', 'high', 'Conteo visual contra plano', 'active'),
('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000603', 'ACAB-VIS', 'Acabado superficial visual', 'visual', NULL, 'medium', 'Inspeccion visual con patron', 'active');

INSERT INTO acceptance_criteria (id, control_characteristic_id, status, target_numeric_value, min_numeric_value, max_numeric_value, tolerance_numeric_value, expected_boolean_value, expected_text_value, valid_from, valid_to, notes) VALUES
('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000701', 'active', 20.000000, 19.950000, 20.050000, 0.050000, NULL, NULL, '2026-01-01 00:00:00+00', NULL, 'Diametro nominal 20 mm.'),
('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000702', 'active', 4.000000, 4.000000, 4.000000, 0.000000, NULL, NULL, '2026-01-01 00:00:00+00', NULL, 'Debe coincidir con plano.'),
('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000703', 'active', NULL, NULL, NULL, NULL, NULL, 'OK', '2026-01-01 00:00:00+00', NULL, 'Valor visual aceptado.');

INSERT INTO acceptance_criterion_allowed_values (acceptance_criterion_id, allowed_value) VALUES
('00000000-0000-0000-0000-000000000803', 'OK');

INSERT INTO dispositions (id, company_id, code, name, description, status) VALUES
('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000001', 'approved', 'Aprobado', 'Liberar producto.', 'active'),
('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000001', 'rework', 'Retrabajo', 'Enviar a retrabajo.', 'active'),
('00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000001', 'scrap', 'Scrap', 'Descartar producto.', 'active'),
('00000000-0000-0000-0000-000000000904', '00000000-0000-0000-0000-000000000001', 'reject', 'Rechazo', 'Rechazar lote o unidad.', 'active'),
('00000000-0000-0000-0000-000000000905', '00000000-0000-0000-0000-000000000001', 'concession', 'Concesion', 'Aceptar bajo concesion.', 'active'),
('00000000-0000-0000-0000-000000000906', '00000000-0000-0000-0000-000000000001', 'hold', 'Retener', 'Mantener en espera de decision.', 'active');

INSERT INTO failure_modes (id, plant_id, product_operation_id, control_characteristic_id, code, description, severity, status) VALUES
('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000701', 'DIAM-SOBRE', 'Diametro exterior por encima del maximo.', 'high', 'active'),
('00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000603', NULL, 'RAYAS-SUP', 'Rayas visibles en superficie.', 'medium', 'active');

INSERT INTO control_records (id, plant_id, control_characteristic_id, acceptance_criterion_id, resource_id, recorded_at, shift, production_order, lot_code, operator_name, inspected_quantity, quantity_unit_of_measure, observed_numeric_value, observed_boolean_value, observed_category_value, observed_text_value, conformity_status, observations) VALUES
('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000402', '2026-07-10 10:15:00+00', 'A', 'OP-2026-0001', 'L-AX-001', 'Juan Perez', 20, 'un', 20.010000, NULL, NULL, NULL, 'conforming', 'Medicion dentro de tolerancia.'),
('00000000-0000-0000-0000-000000001102', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000402', '2026-07-10 11:30:00+00', 'A', 'OP-2026-0002', 'L-AX-002', 'Maria Gomez', 20, 'un', 20.180000, NULL, NULL, NULL, 'non_conforming', 'Fuera de maximo permitido.'),
('00000000-0000-0000-0000-000000001103', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000403', '2026-07-10 15:40:00+00', 'B', 'OP-2026-0001', 'L-AX-001', 'Ana Lopez', 20, 'un', NULL, NULL, 'OK', NULL, 'conforming', 'Sin defectos visuales relevantes.');

INSERT INTO record_failures (id, control_record_id, failure_mode_id, disposition_id, affected_quantity, quantity_unit_of_measure, manual_description, notes) VALUES
('00000000-0000-0000-0000-000000001201', '00000000-0000-0000-0000-000000001102', '00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000902', 3, 'un', NULL, 'Tres piezas requieren retrabajo por diametro excedido.');

INSERT INTO corrective_actions (id, record_failure_id, action_type, description, responsible, target_date, closed_at, status, effectiveness_verification, notes) VALUES
('00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001201', 'correction', 'Ajustar offset de torno CNC y retrabajar piezas afectadas.', 'Supervisor de mecanizado', '2026-07-12', NULL, 'open', NULL, 'Verificar primeras cinco piezas luego del ajuste.');

COMMIT;
