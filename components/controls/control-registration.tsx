"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./control-registration.module.css";

const shifts = ["Mañana", "Tarde", "Noche"] as const;

type Company = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type Plant = {
  id: string;
  company_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type Customer = {
  id: string;
  plant_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type Product = {
  id: string;
  customer_id: string;
  code: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type Operation = {
  id: string;
  product_id: string;
  code: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type FailureMode = {
  id: string;
  operation_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type FailureQuantity = {
  failureModeId: string;
  quantity: number;
};

type ControlRegistrationProps = {
  initialCompanies: Company[];
  initialPlants: Plant[];
  initialCustomers: Customer[];
  initialProducts: Product[];
  initialOperations: Operation[];
  initialFailureModes: FailureMode[];
  initialSelectedCompanyId: string;
  initialSelectedPlantId: string;
  initialSelectedCustomerId: string;
  initialSelectedProductId: string;
  initialSelectedOperationId: string;
  initialError: string;
};

export function ControlRegistration({
  initialCompanies,
  initialPlants,
  initialCustomers,
  initialProducts,
  initialOperations,
  initialFailureModes,
  initialSelectedCompanyId,
  initialSelectedPlantId,
  initialSelectedCustomerId,
  initialSelectedProductId,
  initialSelectedOperationId,
  initialError,
}: ControlRegistrationProps) {
  const [companies] = useState<Company[]>(initialCompanies);
  const [plants, setPlants] = useState<Plant[]>(initialPlants);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [operations, setOperations] = useState<Operation[]>(initialOperations);
  const [failureModes, setFailureModes] = useState<FailureMode[]>(initialFailureModes);
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialSelectedCompanyId);
  const [selectedPlantId, setSelectedPlantId] = useState(initialSelectedPlantId);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialSelectedCustomerId);
  const [selectedProductId, setSelectedProductId] = useState(initialSelectedProductId);
  const [selectedOperationId, setSelectedOperationId] = useState(initialSelectedOperationId);
  const [date, setDate] = useState("");
  const [shift, setShift] = useState<(typeof shifts)[number]>("Mañana");
  const [operator, setOperator] = useState("");
  const [inspectedQuantity, setInspectedQuantity] = useState("");
  const [observations, setObservations] = useState("");
  const [failureQuantities, setFailureQuantities] = useState<FailureQuantity[]>(
    buildFailureQuantities(initialFailureModes),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialError);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const selectedOperation = useMemo(
    () => operations.find((operation) => operation.id === selectedOperationId) ?? null,
    [operations, selectedOperationId],
  );

  const totalDefects = useMemo(
    () => failureQuantities.reduce((total, item) => total + item.quantity, 0),
    [failureQuantities],
  );

  async function loadPlants(companyId: string) {
    setError("");

    try {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("plants")
        .select("id, company_id, name, active, created_at, updated_at")
        .eq("company_id", companyId)
        .order("name", { ascending: true });

      if (queryError) {
        throw queryError;
      }

      const nextPlants = data ?? [];
      const nextPlantId = nextPlants[0]?.id ?? "";
      setPlants(nextPlants);
      setSelectedPlantId(nextPlantId);
      resetAfterCompanyChange();

      if (nextPlantId) {
        await loadCustomers(nextPlantId);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  async function loadCustomers(plantId: string) {
    setError("");

    try {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("customers")
        .select("id, plant_id, name, active, created_at, updated_at")
        .eq("plant_id", plantId)
        .order("name", { ascending: true });

      if (queryError) {
        throw queryError;
      }

      const nextCustomers = data ?? [];
      const nextCustomerId = nextCustomers[0]?.id ?? "";
      setCustomers(nextCustomers);
      setSelectedCustomerId(nextCustomerId);
      resetAfterPlantChange();

      if (nextCustomerId) {
        await loadProducts(nextCustomerId);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  async function loadProducts(customerId: string) {
    setError("");

    try {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("products")
        .select("id, customer_id, code, name, active, created_at, updated_at")
        .eq("customer_id", customerId)
        .order("code", { ascending: true });

      if (queryError) {
        throw queryError;
      }

      const nextProducts = data ?? [];
      const nextProductId = nextProducts[0]?.id ?? "";
      setProducts(nextProducts);
      setSelectedProductId(nextProductId);
      resetAfterCustomerChange();

      if (nextProductId) {
        await loadOperations(nextProductId);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  async function loadOperations(productId: string) {
    setError("");

    try {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("operations")
        .select("id, product_id, code, name, created_at, updated_at")
        .eq("product_id", productId)
        .order("code", { ascending: true });

      if (queryError) {
        throw queryError;
      }

      const nextOperations = data ?? [];
      const nextOperationId = nextOperations[0]?.id ?? "";
      setOperations(nextOperations);
      setSelectedOperationId(nextOperationId);
      resetAfterProductChange();

      if (nextOperationId) {
        await loadFailureModes(nextOperationId);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  async function loadFailureModes(operationId: string) {
    setError("");

    try {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("failure_modes")
        .select("id, operation_id, name, active, created_at, updated_at")
        .eq("operation_id", operationId)
        .eq("active", true)
        .order("name", { ascending: true });

      if (queryError) {
        throw queryError;
      }

      const nextFailureModes = data ?? [];
      setFailureModes(nextFailureModes);
      setFailureQuantities(buildFailureQuantities(nextFailureModes));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  async function saveControl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedInspectedQuantity = Number(inspectedQuantity);
    if (!date || !selectedProductId || !selectedOperationId || !shift || !operator.trim()) {
      setError("Completa fecha, pieza, operacion, turno, operario y cantidad controlada.");
      return;
    }

    if (!Number.isInteger(parsedInspectedQuantity) || parsedInspectedQuantity <= 0) {
      setError("La cantidad controlada debe ser un entero mayor a 0.");
      return;
    }

    if (failureQuantities.some((item) => !Number.isInteger(item.quantity) || item.quantity < 0)) {
      setError("Las cantidades de fallas deben ser enteros iguales o mayores a 0.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data: control, error: controlError } = await supabase
        .from("controls")
        .insert({
          operation_id: selectedOperationId,
          date,
          shift,
          operator: operator.trim(),
          inspected_quantity: parsedInspectedQuantity,
          observations: observations.trim() || null,
        })
        .select("id")
        .single();

      if (controlError) {
        throw controlError;
      }

      const failuresToInsert = failureQuantities
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          control_id: control.id,
          failure_mode_id: item.failureModeId,
          quantity: item.quantity,
        }));

      if (failuresToInsert.length > 0) {
        const { error: failuresError } = await supabase
          .from("control_failures")
          .insert(failuresToInsert);

        if (failuresError) {
          throw failuresError;
        }
      }

      setDate("");
      setShift("Mañana");
      setOperator("");
      setInspectedQuantity("");
      setObservations("");
      setFailureQuantities(buildFailureQuantities(failureModes));
      setMessage("Control registrado.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function updateFailureQuantity(failureModeId: string, quantity: string) {
    const parsedQuantity = Number(quantity || 0);
    const nextQuantity = Number.isFinite(parsedQuantity) ? Math.max(0, parsedQuantity) : 0;
    setFailureQuantities((current) =>
      current.map((item) =>
        item.failureModeId === failureModeId ? { ...item, quantity: nextQuantity } : item,
      ),
    );
  }

  function resetAfterCompanyChange() {
    setCustomers([]);
    setProducts([]);
    setOperations([]);
    setFailureModes([]);
    setSelectedCustomerId("");
    setSelectedProductId("");
    setSelectedOperationId("");
    setFailureQuantities([]);
  }

  function resetAfterPlantChange() {
    setProducts([]);
    setOperations([]);
    setFailureModes([]);
    setSelectedProductId("");
    setSelectedOperationId("");
    setFailureQuantities([]);
  }

  function resetAfterCustomerChange() {
    setOperations([]);
    setFailureModes([]);
    setSelectedOperationId("");
    setFailureQuantities([]);
  }

  function resetAfterProductChange() {
    setFailureModes([]);
    setFailureQuantities([]);
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.eyebrow}>Controles</p>
          <h1 className={styles.title}>Nuevo control</h1>
        </div>
      </header>

      <div className={styles.content}>
        {message ? <p className={styles.message}>{message}</p> : null}
        {error ? <p className={`${styles.message} ${styles.error}`}>{error}</p> : null}

        <div className={styles.layout}>
          <section className={styles.panel} aria-labelledby="context-title">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle} id="context-title">
                Contexto
              </h2>
              <p className={styles.panelMeta}>Selecciona la estructura operativa del control.</p>
            </div>

            <div className={styles.form}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="company">
                  Empresa
                </label>
                <select
                  className={styles.select}
                  id="company"
                  value={selectedCompanyId}
                  onChange={(event) => {
                    const companyId = event.target.value;
                    setSelectedCompanyId(companyId);
                    setPlants([]);
                    setSelectedPlantId("");
                    resetAfterCompanyChange();

                    if (companyId) {
                      void loadPlants(companyId);
                    }
                  }}
                  disabled={saving}
                >
                  <option value="">Seleccionar empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="plant">
                  Planta
                </label>
                <select
                  className={styles.select}
                  id="plant"
                  value={selectedPlantId}
                  onChange={(event) => {
                    const plantId = event.target.value;
                    setSelectedPlantId(plantId);
                    resetAfterPlantChange();

                    if (plantId) {
                      void loadCustomers(plantId);
                    }
                  }}
                  disabled={saving || !selectedCompanyId}
                >
                  <option value="">Seleccionar planta</option>
                  {plants.map((plant) => (
                    <option key={plant.id} value={plant.id}>
                      {plant.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="customer">
                  Cliente
                </label>
                <select
                  className={styles.select}
                  id="customer"
                  value={selectedCustomerId}
                  onChange={(event) => {
                    const customerId = event.target.value;
                    setSelectedCustomerId(customerId);
                    resetAfterCustomerChange();

                    if (customerId) {
                      void loadProducts(customerId);
                    }
                  }}
                  disabled={saving || !selectedPlantId}
                >
                  <option value="">Seleccionar cliente</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="product">
                  Pieza
                </label>
                <select
                  className={styles.select}
                  id="product"
                  value={selectedProductId}
                  onChange={(event) => {
                    const productId = event.target.value;
                    setSelectedProductId(productId);
                    resetAfterProductChange();

                    if (productId) {
                      void loadOperations(productId);
                    }
                  }}
                  disabled={saving || !selectedCustomerId}
                >
                  <option value="">Seleccionar pieza</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.code} - {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="operation">
                  Operación
                </label>
                <select
                  className={styles.select}
                  id="operation"
                  value={selectedOperationId}
                  onChange={(event) => {
                    const operationId = event.target.value;
                    setSelectedOperationId(operationId);
                    setFailureModes([]);
                    setFailureQuantities([]);

                    if (operationId) {
                      void loadFailureModes(operationId);
                    }
                  }}
                  disabled={saving || !selectedProductId}
                >
                  <option value="">Seleccionar operación</option>
                  {operations.map((operation) => (
                    <option key={operation.id} value={operation.id}>
                      {operation.code} - {operation.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="control-title">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle} id="control-title">
                Formulario de control
              </h2>
              <p className={styles.panelMeta}>
                {selectedProduct && selectedOperation
                  ? `${selectedProduct.name} / ${selectedOperation.name}`
                  : "Selecciona pieza y operación."}
              </p>
            </div>

            <form className={styles.form} onSubmit={saveControl}>
              <div className={styles.fieldGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="date">
                    Fecha
                  </label>
                  <input
                    className={styles.input}
                    id="date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="shift">
                    Turno
                  </label>
                  <select
                    className={styles.select}
                    id="shift"
                    value={shift}
                    onChange={(event) => setShift(event.target.value as (typeof shifts)[number])}
                    disabled={saving}
                  >
                    {shifts.map((shiftOption) => (
                      <option key={shiftOption} value={shiftOption}>
                        {shiftOption}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="operator">
                    Operario
                  </label>
                  <input
                    className={styles.input}
                    id="operator"
                    value={operator}
                    onChange={(event) => setOperator(event.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="inspected-quantity">
                    Cantidad controlada
                  </label>
                  <input
                    className={styles.input}
                    id="inspected-quantity"
                    min={1}
                    step={1}
                    type="number"
                    value={inspectedQuantity}
                    onChange={(event) => setInspectedQuantity(event.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className={`${styles.fieldGroup} ${styles.wideField}`}>
                  <label className={styles.label} htmlFor="observations">
                    Observaciones
                  </label>
                  <textarea
                    className={styles.textarea}
                    id="observations"
                    value={observations}
                    onChange={(event) => setObservations(event.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.label}>Fallas detectadas</span>
                <div className={styles.failureList}>
                  <div className={styles.failureHeader}>
                    <span>Nombre de falla</span>
                    <span>Cantidad</span>
                  </div>
                  {failureModes.length === 0 ? (
                    <p className={styles.empty}>No hay modos de falla activos para esta operación.</p>
                  ) : null}
                  {failureModes.map((failureMode) => {
                    const quantity =
                      failureQuantities.find((item) => item.failureModeId === failureMode.id)
                        ?.quantity ?? 0;

                    return (
                      <div className={styles.failureRow} key={failureMode.id}>
                        <p className={styles.failureName}>{failureMode.name}</p>
                        <input
                          className={styles.input}
                          min={0}
                          step={1}
                          type="number"
                          value={quantity}
                          onChange={(event) =>
                            updateFailureQuantity(failureMode.id, event.target.value)
                          }
                          disabled={saving || !selectedOperationId}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={styles.totalBox}>
                <span className={styles.totalLabel}>Total de defectos</span>
                <span className={styles.totalValue}>{totalDefects}</span>
              </div>

              <div className={styles.actions}>
                <button className={styles.button} type="submit" disabled={saving}>
                  Registrar control
                </button>
                <button
                  className={`${styles.button} ${styles.secondaryButton}`}
                  type="button"
                  onClick={() => {
                    setDate("");
                    setShift("Mañana");
                    setOperator("");
                    setInspectedQuantity("");
                    setObservations("");
                    setFailureQuantities(buildFailureQuantities(failureModes));
                  }}
                  disabled={saving}
                >
                  Limpiar formulario
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function buildFailureQuantities(failureModes: FailureMode[]) {
  return failureModes.map((failureMode) => ({
    failureModeId: failureMode.id,
    quantity: 0,
  }));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrio un error inesperado.";
}
