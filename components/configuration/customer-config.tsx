"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./customer-config.module.css";

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

type EditCustomer = {
  id: string;
  name: string;
};

type CustomerConfigProps = {
  initialCompanies: Company[];
  initialPlants: Plant[];
  initialCustomers: Customer[];
  initialSelectedCompanyId: string;
  initialSelectedPlantId: string;
  initialError: string;
};

export function CustomerConfig({
  initialCompanies,
  initialPlants,
  initialCustomers,
  initialSelectedCompanyId,
  initialSelectedPlantId,
  initialError,
}: CustomerConfigProps) {
  const [companies] = useState<Company[]>(initialCompanies);
  const [plants, setPlants] = useState<Plant[]>(initialPlants);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialSelectedCompanyId);
  const [selectedPlantId, setSelectedPlantId] = useState(initialSelectedPlantId);
  const [customerName, setCustomerName] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<EditCustomer | null>(null);
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
      setEditingCustomer(null);
      setCustomerName("");

      if (nextPlantId) {
        await loadCustomers(nextPlantId);
      } else {
        setCustomers([]);
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

      setCustomers(data ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = customerName.trim();
    if (!selectedPlantId) {
      setError("Selecciona una planta antes de crear un cliente.");
      return;
    }

    if (!name) {
      setError("El nombre de cliente es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("customers")
        .insert({ plant_id: selectedPlantId, name })
        .select("id, plant_id, name, active, created_at, updated_at")
        .single();

      if (insertError) {
        throw insertError;
      }

      setCustomers((current) => [...current, data].sort(sortByName));
      setCustomerName("");
      setMessage("Cliente creado.");
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  async function updateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingCustomer) {
      return;
    }

    const name = editingCustomer.name.trim();
    if (!name) {
      setError("El nombre de cliente es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("customers")
        .update({ name })
        .eq("id", editingCustomer.id)
        .select("id, plant_id, name, active, created_at, updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      setCustomers((current) =>
        current.map((customer) => (customer.id === data.id ? data : customer)).sort(sortByName),
      );
      setEditingCustomer(null);
      setMessage("Cliente actualizado.");
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  async function toggleCustomer(customer: Customer) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("customers")
        .update({ active: !customer.active })
        .eq("id", customer.id)
        .select("id, plant_id, name, active, created_at, updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      setCustomers((current) => current.map((item) => (item.id === data.id ? data : item)));
      setMessage(data.active ? "Cliente activado." : "Cliente desactivado.");
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.eyebrow}>Configuracion</p>
          <h1 className={styles.title}>Clientes</h1>
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
                        setEditingCustomer(null);
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

            {editingCustomer ? (
              <form className={styles.form} onSubmit={updateCustomer}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="edit-customer-name">
                    Nombre
                  </label>
                  <input
                    className={styles.input}
                    id="edit-customer-name"
                    value={editingCustomer.name}
                    onChange={(event) =>
                      setEditingCustomer({ ...editingCustomer, name: event.target.value })
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
                    onClick={() => setEditingCustomer(null)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <form className={styles.form} onSubmit={createCustomer}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="customer-name">
                    Nuevo cliente
                  </label>
                  <input
                    className={styles.input}
                    id="customer-name"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    disabled={saving || !selectedPlantId}
                  />
                </div>
                <div className={styles.formActions}>
                  <button
                    className={styles.button}
                    type="submit"
                    disabled={saving || !selectedPlantId}
                  >
                    Crear cliente
                  </button>
                </div>
              </form>
            )}

            <div className={styles.list}>
              {selectedPlant && customers.length === 0 ? (
                <p className={styles.empty}>No hay clientes cargados para esta planta.</p>
              ) : null}

              {!selectedPlant ? (
                <p className={styles.empty}>Primero selecciona una planta.</p>
              ) : null}

              {customers.map((customer) => (
                <article className={styles.row} key={customer.id}>
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
                      onClick={() =>
                        setEditingCustomer({ id: customer.id, name: customer.name })
                      }
                      disabled={saving}
                    >
                      Editar
                    </button>
                    <button
                      className={`${styles.button} ${
                        customer.active ? styles.dangerButton : styles.secondaryButton
                      }`}
                      type="button"
                      onClick={() => toggleCustomer(customer)}
                      disabled={saving}
                    >
                      {customer.active ? "Desactivar" : "Activar"}
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
