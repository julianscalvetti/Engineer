"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./failure-mode-config.module.css";

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

type EditFailureMode = {
  id: string;
  name: string;
};

type FailureModeConfigProps = {
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

export function FailureModeConfig({
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
}: FailureModeConfigProps) {
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
  const [failureModeName, setFailureModeName] = useState("");
  const [editingFailureMode, setEditingFailureMode] = useState<EditFailureMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialError);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  const selectedPlant = useMemo(
    () => plants.find((plant) => plant.id === selectedPlantId) ?? null,
    [plants, selectedPlantId],
  );

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const selectedOperation = useMemo(
    () => operations.find((operation) => operation.id === selectedOperationId) ?? null,
    [operations, selectedOperationId],
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
        .order("name", { ascending: true });

      if (queryError) {
        throw queryError;
      }

      setFailureModes(data ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  async function createFailureMode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = failureModeName.trim();
    if (!selectedOperationId) {
      setError("Selecciona una operacion antes de crear un modo de falla.");
      return;
    }

    if (!name) {
      setError("El nombre de falla es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("failure_modes")
        .insert({ operation_id: selectedOperationId, name })
        .select("id, operation_id, name, active, created_at, updated_at")
        .single();

      if (insertError) {
        throw insertError;
      }

      setFailureModes((current) => [...current, data].sort(sortByName));
      setFailureModeName("");
      setMessage("Modo de falla creado.");
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  async function updateFailureMode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingFailureMode) {
      return;
    }

    const name = editingFailureMode.name.trim();
    if (!name) {
      setError("El nombre de falla es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("failure_modes")
        .update({ name })
        .eq("id", editingFailureMode.id)
        .select("id, operation_id, name, active, created_at, updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      setFailureModes((current) =>
        current.map((failureMode) => (failureMode.id === data.id ? data : failureMode)).sort(sortByName),
      );
      setEditingFailureMode(null);
      setMessage("Modo de falla actualizado.");
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  async function toggleFailureMode(failureMode: FailureMode) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("failure_modes")
        .update({ active: !failureMode.active })
        .eq("id", failureMode.id)
        .select("id, operation_id, name, active, created_at, updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      setFailureModes((current) => current.map((item) => (item.id === data.id ? data : item)));
      setMessage(data.active ? "Modo de falla activado." : "Modo de falla desactivado.");
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  function resetAfterCompanyChange() {
    setCustomers([]);
    setProducts([]);
    setOperations([]);
    setFailureModes([]);
    setSelectedCustomerId("");
    setSelectedProductId("");
    setSelectedOperationId("");
    setEditingFailureMode(null);
    setFailureModeName("");
  }

  function resetAfterPlantChange() {
    setProducts([]);
    setOperations([]);
    setFailureModes([]);
    setSelectedProductId("");
    setSelectedOperationId("");
    setEditingFailureMode(null);
    setFailureModeName("");
  }

  function resetAfterCustomerChange() {
    setOperations([]);
    setFailureModes([]);
    setSelectedOperationId("");
    setEditingFailureMode(null);
    setFailureModeName("");
  }

  function resetAfterProductChange() {
    setFailureModes([]);
    setEditingFailureMode(null);
    setFailureModeName("");
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.eyebrow}>Configuracion</p>
          <h1 className={styles.title}>Modos de falla</h1>
        </div>
      </header>

      <div className={styles.content}>
        {message ? <p className={styles.message}>{message}</p> : null}
        {error ? <p className={`${styles.message} ${styles.error}`}>{error}</p> : null}

        <div className={styles.layout}>
          <section className={styles.panel} aria-labelledby="companies-title">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle} id="companies-title">
                Empresas
              </h2>
              <p className={styles.panelMeta}>{companies.length} registradas.</p>
            </div>

            <div className={styles.list}>
              {companies.length === 0 ? (
                <p className={styles.empty}>No hay empresas cargadas.</p>
              ) : null}

              {companies.map((company) => (
                <article
                  className={`${styles.row} ${
                    company.id === selectedCompanyId ? styles.selectedRow : ""
                  }`}
                  key={company.id}
                >
                  <div className={styles.rowTop}>
                    <p className={styles.entityName}>{company.name}</p>
                    <span
                      className={`${styles.badge} ${
                        company.active ? "" : styles.inactiveBadge
                      }`}
                    >
                      {company.active ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      className={`${styles.button} ${styles.secondaryButton}`}
                      type="button"
                      onClick={() => {
                        setSelectedCompanyId(company.id);
                        void loadPlants(company.id);
                      }}
                      disabled={saving || company.id === selectedCompanyId}
                    >
                      Ver plantas
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="plants-title">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle} id="plants-title">
                Plantas
              </h2>
              <p className={styles.panelMeta}>
                {selectedCompany
                  ? `${plants.length} asociadas a ${selectedCompany.name}.`
                  : "Selecciona una empresa."}
              </p>
            </div>

            <div className={styles.list}>
              {selectedCompany && plants.length === 0 ? (
                <p className={styles.empty}>No hay plantas cargadas para esta empresa.</p>
              ) : null}

              {!selectedCompany ? (
                <p className={styles.empty}>Primero selecciona una empresa.</p>
              ) : null}

              {plants.map((plant) => (
                <article
                  className={`${styles.row} ${
                    plant.id === selectedPlantId ? styles.selectedRow : ""
                  }`}
                  key={plant.id}
                >
                  <div className={styles.rowTop}>
                    <p className={styles.entityName}>{plant.name}</p>
                    <span
                      className={`${styles.badge} ${plant.active ? "" : styles.inactiveBadge}`}
                    >
                      {plant.active ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      className={`${styles.button} ${styles.secondaryButton}`}
                      type="button"
                      onClick={() => {
                        setSelectedPlantId(plant.id);
                        void loadCustomers(plant.id);
                      }}
                      disabled={saving || plant.id === selectedPlantId}
                    >
                      Ver clientes
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="customers-title">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle} id="customers-title">
                Clientes
              </h2>
              <p className={styles.panelMeta}>
                {selectedPlant
                  ? `${customers.length} asociados a ${selectedPlant.name}.`
                  : "Selecciona una planta."}
              </p>
            </div>

            <div className={styles.list}>
              {selectedPlant && customers.length === 0 ? (
                <p className={styles.empty}>No hay clientes cargados para esta planta.</p>
              ) : null}

              {!selectedPlant ? (
                <p className={styles.empty}>Primero selecciona una planta.</p>
              ) : null}

              {customers.map((customer) => (
                <article
                  className={`${styles.row} ${
                    customer.id === selectedCustomerId ? styles.selectedRow : ""
                  }`}
                  key={customer.id}
                >
                  <div className={styles.rowTop}>
                    <p className={styles.entityName}>{customer.name}</p>
                    <span
                      className={`${styles.badge} ${
                        customer.active ? "" : styles.inactiveBadge
                      }`}
                    >
                      {customer.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      className={`${styles.button} ${styles.secondaryButton}`}
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(customer.id);
                        void loadProducts(customer.id);
                      }}
                      disabled={saving || customer.id === selectedCustomerId}
                    >
                      Ver piezas
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="products-title">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle} id="products-title">
                Piezas
              </h2>
              <p className={styles.panelMeta}>
                {selectedCustomer
                  ? `${products.length} asociadas a ${selectedCustomer.name}.`
                  : "Selecciona un cliente."}
              </p>
            </div>

            <div className={styles.list}>
              {selectedCustomer && products.length === 0 ? (
                <p className={styles.empty}>No hay piezas cargadas para este cliente.</p>
              ) : null}

              {!selectedCustomer ? (
                <p className={styles.empty}>Primero selecciona un cliente.</p>
              ) : null}

              {products.map((product) => (
                <article
                  className={`${styles.row} ${
                    product.id === selectedProductId ? styles.selectedRow : ""
                  }`}
                  key={product.id}
                >
                  <div className={styles.rowTop}>
                    <div>
                      <p className={styles.entityName}>{product.name}</p>
                      <p className={styles.entityMeta}>Codigo: {product.code}</p>
                    </div>
                    <span
                      className={`${styles.badge} ${product.active ? "" : styles.inactiveBadge}`}
                    >
                      {product.active ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      className={`${styles.button} ${styles.secondaryButton}`}
                      type="button"
                      onClick={() => {
                        setSelectedProductId(product.id);
                        void loadOperations(product.id);
                      }}
                      disabled={saving || product.id === selectedProductId}
                    >
                      Ver operaciones
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="operations-title">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle} id="operations-title">
                Operaciones
              </h2>
              <p className={styles.panelMeta}>
                {selectedProduct
                  ? `${operations.length} asociadas a ${selectedProduct.name}.`
                  : "Selecciona una pieza."}
              </p>
            </div>

            <div className={styles.list}>
              {selectedProduct && operations.length === 0 ? (
                <p className={styles.empty}>No hay operaciones cargadas para esta pieza.</p>
              ) : null}

              {!selectedProduct ? (
                <p className={styles.empty}>Primero selecciona una pieza.</p>
              ) : null}

              {operations.map((operation) => (
                <article
                  className={`${styles.row} ${
                    operation.id === selectedOperationId ? styles.selectedRow : ""
                  }`}
                  key={operation.id}
                >
                  <div className={styles.rowTop}>
                    <div>
                      <p className={styles.entityName}>{operation.name}</p>
                      <p className={styles.entityMeta}>Codigo: {operation.code}</p>
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      className={`${styles.button} ${styles.secondaryButton}`}
                      type="button"
                      onClick={() => {
                        setSelectedOperationId(operation.id);
                        setEditingFailureMode(null);
                        setFailureModeName("");
                        void loadFailureModes(operation.id);
                      }}
                      disabled={saving || operation.id === selectedOperationId}
                    >
                      Ver fallas
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="failure-modes-title">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle} id="failure-modes-title">
                Modos de falla
              </h2>
              <p className={styles.panelMeta}>
                {selectedOperation
                  ? `${failureModes.length} asociados a ${selectedOperation.name}.`
                  : "Selecciona una operacion."}
              </p>
            </div>

            {editingFailureMode ? (
              <form className={styles.form} onSubmit={updateFailureMode}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="edit-failure-mode-name">
                    Nombre
                  </label>
                  <input
                    className={styles.input}
                    id="edit-failure-mode-name"
                    value={editingFailureMode.name}
                    onChange={(event) =>
                      setEditingFailureMode({ ...editingFailureMode, name: event.target.value })
                    }
                    disabled={saving}
                  />
                </div>
                <div className={styles.formActions}>
                  <button className={styles.button} type="submit" disabled={saving}>
                    Guardar
                  </button>
                  <button
                    className={`${styles.button} ${styles.secondaryButton}`}
                    type="button"
                    onClick={() => setEditingFailureMode(null)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <form className={styles.form} onSubmit={createFailureMode}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="failure-mode-name">
                    Nombre de falla
                  </label>
                  <input
                    className={styles.input}
                    id="failure-mode-name"
                    value={failureModeName}
                    onChange={(event) => setFailureModeName(event.target.value)}
                    disabled={saving || !selectedOperationId}
                  />
                </div>
                <div className={styles.formActions}>
                  <button
                    className={styles.button}
                    type="submit"
                    disabled={saving || !selectedOperationId}
                  >
                    Crear modo de falla
                  </button>
                </div>
              </form>
            )}

            <div className={styles.list}>
              {selectedOperation && failureModes.length === 0 ? (
                <p className={styles.empty}>No hay modos de falla cargados para esta operacion.</p>
              ) : null}

              {!selectedOperation ? (
                <p className={styles.empty}>Primero selecciona una operacion.</p>
              ) : null}

              {failureModes.map((failureMode) => (
                <article className={styles.row} key={failureMode.id}>
                  <div className={styles.rowTop}>
                    <p className={styles.entityName}>{failureMode.name}</p>
                    <span
                      className={`${styles.badge} ${
                        failureMode.active ? "" : styles.inactiveBadge
                      }`}
                    >
                      {failureMode.active ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      className={`${styles.button} ${styles.secondaryButton}`}
                      type="button"
                      onClick={() =>
                        setEditingFailureMode({ id: failureMode.id, name: failureMode.name })
                      }
                      disabled={saving}
                    >
                      Editar
                    </button>
                    <button
                      className={`${styles.button} ${
                        failureMode.active ? styles.dangerButton : styles.secondaryButton
                      }`}
                      type="button"
                      onClick={() => toggleFailureMode(failureMode)}
                      disabled={saving}
                    >
                      {failureMode.active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function sortByName<T extends { name: string }>(left: T, right: T) {
  return left.name.localeCompare(right.name, "es");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrio un error inesperado.";
}
