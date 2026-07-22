"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./product-config.module.css";

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

type EditProduct = {
  id: string;
  code: string;
  name: string;
};

type ProductConfigProps = {
  initialCompanies: Company[];
  initialPlants: Plant[];
  initialCustomers: Customer[];
  initialProducts: Product[];
  initialSelectedCompanyId: string;
  initialSelectedPlantId: string;
  initialSelectedCustomerId: string;
  initialError: string;
};

export function ProductConfig({
  initialCompanies,
  initialPlants,
  initialCustomers,
  initialProducts,
  initialSelectedCompanyId,
  initialSelectedPlantId,
  initialSelectedCustomerId,
  initialError,
}: ProductConfigProps) {
  const [companies] = useState<Company[]>(initialCompanies);
  const [plants, setPlants] = useState<Plant[]>(initialPlants);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialSelectedCompanyId);
  const [selectedPlantId, setSelectedPlantId] = useState(initialSelectedPlantId);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialSelectedCustomerId);
  const [productCode, setProductCode] = useState("");
  const [productName, setProductName] = useState("");
  const [editingProduct, setEditingProduct] = useState<EditProduct | null>(null);
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
      setCustomers([]);
      setSelectedCustomerId("");
      setProducts([]);
      setEditingProduct(null);
      clearProductForm();

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
      setProducts([]);
      setEditingProduct(null);
      clearProductForm();

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

      setProducts(data ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const code = productCode.trim();
    const name = productName.trim();
    if (!selectedCustomerId) {
      setError("Selecciona un cliente antes de crear una pieza.");
      return;
    }

    if (!code || !name) {
      setError("El codigo oficial y el nombre de pieza son obligatorios.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("products")
        .insert({ customer_id: selectedCustomerId, code, name })
        .select("id, customer_id, code, name, active, created_at, updated_at")
        .single();

      if (insertError) {
        throw insertError;
      }

      setProducts((current) => [...current, data].sort(sortProducts));
      clearProductForm();
      setMessage("Pieza creada.");
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  async function updateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingProduct) {
      return;
    }

    const code = editingProduct.code.trim();
    const name = editingProduct.name.trim();
    if (!code || !name) {
      setError("El codigo oficial y el nombre de pieza son obligatorios.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("products")
        .update({ code, name })
        .eq("id", editingProduct.id)
        .select("id, customer_id, code, name, active, created_at, updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      setProducts((current) =>
        current.map((product) => (product.id === data.id ? data : product)).sort(sortProducts),
      );
      setEditingProduct(null);
      setMessage("Pieza actualizada.");
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  async function toggleProduct(product: Product) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("products")
        .update({ active: !product.active })
        .eq("id", product.id)
        .select("id, customer_id, code, name, active, created_at, updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      setProducts((current) => current.map((item) => (item.id === data.id ? data : item)));
      setMessage(data.active ? "Pieza activada." : "Pieza desactivada.");
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  function clearProductForm() {
    setProductCode("");
    setProductName("");
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.eyebrow}>Configuracion</p>
          <h1 className={styles.title}>Piezas</h1>
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
                        setEditingProduct(null);
                        clearProductForm();
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

            {editingProduct ? (
              <form className={styles.form} onSubmit={updateProduct}>
                <div className={styles.fieldGrid}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="edit-product-code">
                      Codigo oficial
                    </label>
                    <input
                      className={styles.input}
                      id="edit-product-code"
                      value={editingProduct.code}
                      onChange={(event) =>
                        setEditingProduct({ ...editingProduct, code: event.target.value })
                      }
                      disabled={saving}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="edit-product-name">
                      Nombre
                    </label>
                    <input
                      className={styles.input}
                      id="edit-product-name"
                      value={editingProduct.name}
                      onChange={(event) =>
                        setEditingProduct({ ...editingProduct, name: event.target.value })
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
                    onClick={() => setEditingProduct(null)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <form className={styles.form} onSubmit={createProduct}>
                <div className={styles.fieldGrid}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="product-code">
                      Codigo oficial
                    </label>
                    <input
                      className={styles.input}
                      id="product-code"
                      value={productCode}
                      onChange={(event) => setProductCode(event.target.value)}
                      disabled={saving || !selectedCustomerId}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="product-name">
                      Nombre de pieza
                    </label>
                    <input
                      className={styles.input}
                      id="product-name"
                      value={productName}
                      onChange={(event) => setProductName(event.target.value)}
                      disabled={saving || !selectedCustomerId}
                    />
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button
                    className={styles.button}
                    type="submit"
                    disabled={saving || !selectedCustomerId}
                  >
                    Crear pieza
                  </button>
                </div>
              </form>
            )}

            <div className={styles.list}>
              {selectedCustomer && products.length === 0 ? (
                <p className={styles.empty}>No hay piezas cargadas para este cliente.</p>
              ) : null}

              {!selectedCustomer ? (
                <p className={styles.empty}>Primero selecciona un cliente.</p>
              ) : null}

              {products.map((product) => (
                <article className={styles.row} key={product.id}>
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
                      onClick={() =>
                        setEditingProduct({
                          id: product.id,
                          code: product.code,
                          name: product.name,
                        })
                      }
                      disabled={saving}
                    >
                      Editar
                    </button>
                    <button
                      className={`${styles.button} ${
                        product.active ? styles.dangerButton : styles.secondaryButton
                      }`}
                      type="button"
                      onClick={() => toggleProduct(product)}
                      disabled={saving}
                    >
                      {product.active ? "Desactivar" : "Activar"}
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

function sortProducts(left: Product, right: Product) {
  return left.code.localeCompare(right.code, "es");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrio un error inesperado.";
}
