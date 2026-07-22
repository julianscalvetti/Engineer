"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./operation-config.module.css";

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

type EditOperation = {
  id: string;
  code: string;
  name: string;
};

type OperationConfigProps = {
  initialCompanies: Company[];
  initialPlants: Plant[];
  initialCustomers: Customer[];
  initialProducts: Product[];
  initialOperations: Operation[];
  initialSelectedCompanyId: string;
  initialSelectedPlantId: string;
  initialSelectedCustomerId: string;
  initialSelectedProductId: string;
  initialError: string;
};

export function OperationConfig({
  initialCompanies,
  initialPlants,
  initialCustomers,
  initialProducts,
  initialOperations,
  initialSelectedCompanyId,
  initialSelectedPlantId,
  initialSelectedCustomerId,
  initialSelectedProductId,
  initialError,
}: OperationConfigProps) {
  const [companies] = useState<Company[]>(initialCompanies);
  const [plants, setPlants] = useState<Plant[]>(initialPlants);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [operations, setOperations] = useState<Operation[]>(initialOperations);
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialSelectedCompanyId);
  const [selectedPlantId, setSelectedPlantId] = useState(initialSelectedPlantId);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialSelectedCustomerId);
  const [selectedProductId, setSelectedProductId] = useState(initialSelectedProductId);
  const [operationCode, setOperationCode] = useState("");
  const [operationName, setOperationName] = useState("");
  const [editingOperation, setEditingOperation] = useState<EditOperation | null>(null);
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

      setOperations(data ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  async function createOperation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const code = operationCode.trim();
    const name = operationName.trim();
    if (!selectedProductId) {
      setError("Selecciona una pieza antes de crear una operacion.");
      return;
    }

    if (!code || !name) {
      setError("El codigo y el nombre de operacion son obligatorios.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("operations")
        .insert({ product_id: selectedProductId, code, name })
        .select("id, product_id, code, name, created_at, updated_at")
        .single();

      if (insertError) {
        throw insertError;
      }

      setOperations((current) => [...current, data].sort(sortOperations));
      clearOperationForm();
      setMessage("Operacion creada.");
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  async function updateOperation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingOperation) {
      return;
    }

    const code = editingOperation.code.trim();
    const name = editingOperation.name.trim();
    if (!code || !name) {
      setError("El codigo y el nombre de operacion son obligatorios.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("operations")
        .update({ code, name })
        .eq("id", editingOperation.id)
        .select("id, product_id, code, name, created_at, updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      setOperations((current) =>
        current
          .map((operation) => (operation.id === data.id ? data : operation))
          .sort(sortOperations),
      );
      setEditingOperation(null);
      setMessage("Operacion actualizada.");
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
    setSelectedCustomerId("");
    setSelectedProductId("");
    setEditingOperation(null);
    clearOperationForm();
  }

  function resetAfterPlantChange() {
    setProducts([]);
    setOperations([]);
    setSelectedProductId("");
    setEditingOperation(null);
    clearOperationForm();
  }

  function resetAfterCustomerChange() {
    setOperations([]);
    setEditingOperation(null);
    clearOperationForm();
  }

  function clearOperationForm() {
    setOperationCode("");
    setOperationName("");
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.eyebrow}>Configuracion</p>
          <h1 className={styles.title}>Operaciones</h1>
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
                        setEditingOperation(null);
                        clearOperationForm();
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

            {editingOperation ? (
              <form className={styles.form} onSubmit={updateOperation}>
                <div className={styles.fieldGrid}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="edit-operation-code">
                      Codigo
                    </label>
                    <input
                      className={styles.input}
                      id="edit-operation-code"
                      value={editingOperation.code}
                      onChange={(event) =>
                        setEditingOperation({ ...editingOperation, code: event.target.value })
                      }
                      disabled={saving}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="edit-operation-name">
                      Nombre
                    </label>
                    <input
                      className={styles.input}
                      id="edit-operation-name"
                      value={editingOperation.name}
                      onChange={(event) =>
                        setEditingOperation({ ...editingOperation, name: event.target.value })
                      }
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button className={styles.button} type="submit" disabled={saving}>
                    Guardar
                  </button>
                  <button
                    className={`${styles.button} ${styles.secondaryButton}`}
                    type="button"
                    onClick={() => setEditingOperation(null)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <form className={styles.form} onSubmit={createOperation}>
                <div className={styles.fieldGrid}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="operation-code">
                      Codigo
                    </label>
                    <input
                      className={styles.input}
                      id="operation-code"
                      value={operationCode}
                      onChange={(event) => setOperationCode(event.target.value)}
                      disabled={saving || !selectedProductId}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="operation-name">
                      Nombre de operacion
                    </label>
                    <input
                      className={styles.input}
                      id="operation-name"
                      value={operationName}
                      onChange={(event) => setOperationName(event.target.value)}
                      disabled={saving || !selectedProductId}
                    />
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button
                    className={styles.button}
                    type="submit"
                    disabled={saving || !selectedProductId}
                  >
                    Crear operacion
                  </button>
                </div>
              </form>
            )}

            <div className={styles.list}>
              {selectedProduct && operations.length === 0 ? (
                <p className={styles.empty}>No hay operaciones cargadas para esta pieza.</p>
              ) : null}

              {!selectedProduct ? (
                <p className={styles.empty}>Primero selecciona una pieza.</p>
              ) : null}

              {operations.map((operation) => (
                <article className={styles.row} key={operation.id}>
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
                      onClick={() =>
                        setEditingOperation({
                          id: operation.id,
                          code: operation.code,
                          name: operation.name,
                        })
                      }
                      disabled={saving}
                    >
                      Editar
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

function sortOperations(left: Operation, right: Operation) {
  return left.code.localeCompare(right.code, "es");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrio un error inesperado.";
}
