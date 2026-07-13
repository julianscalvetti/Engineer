-- PostgreSQL schema for a discrete manufacturing quality SaaS data model.
-- Scope: relational model only. No API, frontend, auth, AI, or integrations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    tax_identifier text,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (name)
);

CREATE TABLE plants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    code text NOT NULL,
    name text NOT NULL,
    location text,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, code),
    UNIQUE (id, company_id)
);

CREATE TABLE products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE RESTRICT,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    object_type text NOT NULL DEFAULT 'product'
        CHECK (object_type IN ('piece', 'product', 'lot', 'assembly')),
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plant_id, code),
    UNIQUE (id, plant_id)
);

CREATE TABLE operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE RESTRICT,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plant_id, code),
    UNIQUE (id, plant_id)
);

-- Product-specific process route. Sequence can vary by product.
CREATE TABLE product_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE RESTRICT,
    product_id uuid NOT NULL,
    operation_id uuid NOT NULL,
    sequence_number integer NOT NULL CHECK (sequence_number > 0),
    is_mandatory boolean NOT NULL DEFAULT true,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (product_id, plant_id) REFERENCES products(id, plant_id) ON DELETE RESTRICT,
    FOREIGN KEY (operation_id, plant_id) REFERENCES operations(id, plant_id) ON DELETE RESTRICT,
    UNIQUE (product_id, sequence_number),
    UNIQUE (product_id, operation_id),
    UNIQUE (id, plant_id)
);

CREATE TABLE resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE RESTRICT,
    code text NOT NULL,
    name text NOT NULL,
    resource_type text NOT NULL
        CHECK (resource_type IN ('machine', 'line', 'station', 'cell', 'other')),
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (plant_id, code),
    UNIQUE (id, plant_id)
);

-- Resources capable of executing an operation within the same plant.
CREATE TABLE operation_resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE RESTRICT,
    operation_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (operation_id, plant_id) REFERENCES operations(id, plant_id) ON DELETE RESTRICT,
    FOREIGN KEY (resource_id, plant_id) REFERENCES resources(id, plant_id) ON DELETE RESTRICT,
    UNIQUE (operation_id, resource_id)
);

CREATE TABLE control_characteristics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE RESTRICT,
    product_operation_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    data_type text NOT NULL
        CHECK (data_type IN ('numeric', 'boolean', 'categorical', 'text', 'visual')),
    unit_of_measure text,
    criticality text NOT NULL DEFAULT 'medium'
        CHECK (criticality IN ('low', 'medium', 'high', 'critical')),
    control_method text,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (product_operation_id, plant_id) REFERENCES product_operations(id, plant_id) ON DELETE RESTRICT,
    UNIQUE (product_operation_id, code),
    UNIQUE (id, plant_id),
    UNIQUE (id, product_operation_id)
);

-- Versioned acceptance criteria. Active ranges cannot overlap for one characteristic.
CREATE TABLE acceptance_criteria (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    control_characteristic_id uuid NOT NULL REFERENCES control_characteristics(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'inactive')),
    target_numeric_value numeric(18, 6),
    min_numeric_value numeric(18, 6),
    max_numeric_value numeric(18, 6),
    tolerance_numeric_value numeric(18, 6) CHECK (tolerance_numeric_value IS NULL OR tolerance_numeric_value >= 0),
    expected_boolean_value boolean,
    expected_text_value text,
    valid_from timestamptz NOT NULL,
    valid_to timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (valid_to IS NULL OR valid_to > valid_from),
    CHECK (min_numeric_value IS NULL OR max_numeric_value IS NULL OR min_numeric_value <= max_numeric_value),
    UNIQUE (id, control_characteristic_id)
);

ALTER TABLE acceptance_criteria
    ADD CONSTRAINT acceptance_criteria_no_active_overlap
    EXCLUDE USING gist (
        control_characteristic_id WITH =,
        tstzrange(valid_from, COALESCE(valid_to, 'infinity'::timestamptz), '[)') WITH &&
    )
    WHERE (status = 'active');

CREATE TABLE acceptance_criterion_allowed_values (
    acceptance_criterion_id uuid NOT NULL REFERENCES acceptance_criteria(id) ON DELETE CASCADE,
    allowed_value text NOT NULL,
    PRIMARY KEY (acceptance_criterion_id, allowed_value)
);

-- One row represents one evaluated characteristic.
CREATE TABLE control_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE RESTRICT,
    control_characteristic_id uuid NOT NULL,
    acceptance_criterion_id uuid NOT NULL,
    resource_id uuid,
    recorded_at timestamptz NOT NULL,
    shift text,
    production_order text,
    lot_code text,
    operator_name text,
    inspected_quantity numeric(18, 6) CHECK (inspected_quantity IS NULL OR inspected_quantity >= 0),
    quantity_unit_of_measure text,
    observed_numeric_value numeric(18, 6),
    observed_boolean_value boolean,
    observed_category_value text,
    observed_text_value text,
    conformity_status text NOT NULL
        CHECK (conformity_status IN ('conforming', 'non_conforming', 'pending', 'not_applicable')),
    observations text,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (control_characteristic_id, plant_id) REFERENCES control_characteristics(id, plant_id) ON DELETE RESTRICT,
    FOREIGN KEY (acceptance_criterion_id, control_characteristic_id) REFERENCES acceptance_criteria(id, control_characteristic_id) ON DELETE RESTRICT,
    FOREIGN KEY (resource_id, plant_id) REFERENCES resources(id, plant_id) ON DELETE RESTRICT,
    CHECK (
        observed_numeric_value IS NOT NULL
        OR observed_boolean_value IS NOT NULL
        OR observed_category_value IS NOT NULL
        OR observed_text_value IS NOT NULL
        OR conformity_status IN ('pending', 'not_applicable')
    )
);

-- Failure modes can be plant-level, product-operation-specific, or characteristic-specific.
CREATE TABLE failure_modes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE RESTRICT,
    product_operation_id uuid,
    control_characteristic_id uuid,
    code text NOT NULL,
    description text NOT NULL,
    severity text NOT NULL DEFAULT 'medium'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (product_operation_id, plant_id) REFERENCES product_operations(id, plant_id) ON DELETE RESTRICT,
    FOREIGN KEY (control_characteristic_id, plant_id) REFERENCES control_characteristics(id, plant_id) ON DELETE RESTRICT,
    UNIQUE (plant_id, code)
);

CREATE TABLE dispositions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, code)
);

CREATE TABLE record_failures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    control_record_id uuid NOT NULL REFERENCES control_records(id) ON DELETE RESTRICT,
    failure_mode_id uuid REFERENCES failure_modes(id) ON DELETE RESTRICT,
    disposition_id uuid REFERENCES dispositions(id) ON DELETE RESTRICT,
    affected_quantity numeric(18, 6) CHECK (affected_quantity IS NULL OR affected_quantity >= 0),
    quantity_unit_of_measure text,
    manual_description text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (failure_mode_id IS NOT NULL OR manual_description IS NOT NULL)
);

CREATE TABLE corrective_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    record_failure_id uuid NOT NULL REFERENCES record_failures(id) ON DELETE RESTRICT,
    action_type text NOT NULL
        CHECK (action_type IN ('containment', 'correction', 'corrective', 'preventive', 'other')),
    description text NOT NULL,
    responsible text,
    created_at timestamptz NOT NULL DEFAULT now(),
    target_date date,
    closed_at timestamptz,
    status text NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'closed', 'cancelled')),
    effectiveness_verification text,
    notes text,
    CHECK (closed_at IS NULL OR status IN ('closed', 'cancelled'))
);

CREATE INDEX idx_plants_company ON plants(company_id);
CREATE INDEX idx_products_plant ON products(plant_id);
CREATE INDEX idx_operations_plant ON operations(plant_id);
CREATE INDEX idx_product_operations_product ON product_operations(product_id, sequence_number);
CREATE INDEX idx_product_operations_operation ON product_operations(operation_id);
CREATE INDEX idx_resources_plant ON resources(plant_id);
CREATE INDEX idx_operation_resources_operation ON operation_resources(operation_id);
CREATE INDEX idx_control_characteristics_product_operation ON control_characteristics(product_operation_id);
CREATE INDEX idx_acceptance_criteria_characteristic ON acceptance_criteria(control_characteristic_id, valid_from);
CREATE INDEX idx_control_records_characteristic_time ON control_records(control_characteristic_id, recorded_at DESC);
CREATE INDEX idx_control_records_plant_time ON control_records(plant_id, recorded_at DESC);
CREATE INDEX idx_control_records_resource_time ON control_records(resource_id, recorded_at DESC);
CREATE INDEX idx_failure_modes_scope ON failure_modes(plant_id, product_operation_id, control_characteristic_id);
CREATE INDEX idx_record_failures_record ON record_failures(control_record_id);
CREATE INDEX idx_corrective_actions_failure ON corrective_actions(record_failure_id);
