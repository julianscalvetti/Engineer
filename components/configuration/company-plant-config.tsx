"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./company-plant-config.module.css";

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

type EditCompany = {
  id: string;
  name: string;
};

type EditPlant = {
  id: string;
  name: string;
};

type CompanyPlantConfigProps = {
  initialCompanies: Company[];
  initialPlants: Plant[];
  initialSelectedCompanyId: string;
  initialError: string;
};

export function CompanyPlantConfig({
  initialCompanies,
  initialPlants,
  initialSelectedCompanyId,
  initialError,
}: CompanyPlantConfigProps) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [plants, setPlants] = useState<Plant[]>(initialPlants);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialSelectedCompanyId);
  const [companyName, setCompanyName] = useState("");
  const [plantName, setPlantName] = useState("");
  const [editingCompany, setEditingCompany] = useState<EditCompany | null>(null);
  const [editingPlant, setEditingPlant] = useState<EditPlant | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialError);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
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

      setPlants(data ?? []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = companyName.trim();
    if (!name) {
      setError("El nombre de empresa es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("companies")
        .insert({ name })
        .select("id, name, active, created_at, updated_at")
        .single();

      if (insertError) {
        throw insertError;
      }

      setCompanies((current) => [...current, data].sort(sortByName));
      setSelectedCompanyId(data.id);
      setPlants([]);
      setCompanyName("");
      setMessage("Empresa creada.");
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  async function updateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingCompany) {
      return;
    }

    const name = editingCompany.name.trim();
    if (!name) {
      setError("El nombre de empresa es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("companies")
        .update({ name })
        .eq("id", editingCompany.id)
        .select("id, name, active, created_at, updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      setCompanies((current) =>
        current.map((company) => (company.id === data.id ? data : company)).sort(sortByName),
      );
      setEditingCompany(null);
      setMessage("Empresa actualizada.");
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompany(company: Company) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("companies")
        .update({ active: !company.active })
        .eq("id", company.id)
        .select("id, name, active, created_at, updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      setCompanies((current) => current.map((item) => (item.id === data.id ? data : item)));
      setMessage(data.active ? "Empresa activada." : "Empresa desactivada.");
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  async function createPlant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = plantName.trim();
    if (!selectedCompanyId) {
      setError("Selecciona una empresa antes de crear una planta.");
      return;
    }

    if (!name) {
      setError("El nombre de planta es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("plants")
        .insert({ company_id: selectedCompanyId, name })
        .select("id, company_id, name, active, created_at, updated_at")
        .single();

      if (insertError) {
        throw insertError;
      }

      setPlants((current) => [...current, data].sort(sortByName));
      setPlantName("");
      setMessage("Planta creada.");
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  async function updatePlant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingPlant) {
      return;
    }

    const name = editingPlant.name.trim();
    if (!name) {
      setError("El nombre de planta es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("plants")
        .update({ name })
        .eq("id", editingPlant.id)
        .select("id, company_id, name, active, created_at, updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      setPlants((current) =>
        current.map((plant) => (plant.id === data.id ? data : plant)).sort(sortByName),
      );
      setEditingPlant(null);
      setMessage("Planta actualizada.");
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  async function togglePlant(plant: Plant) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("plants")
        .update({ active: !plant.active })
        .eq("id", plant.id)
        .select("id, company_id, name, active, created_at, updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      setPlants((current) => current.map((item) => (item.id === data.id ? data : item)));
      setMessage(data.active ? "Planta activada." : "Planta desactivada.");
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
          <h1 className={styles.title}>Empresa y planta</h1>
        </div>
      </header>

      <div className={styles.content}>
        {message ? <p className={styles.message}>{message}</p> : null}
        {error ? <p className={`${styles.message} ${styles.error}`}>{error}</p> : null}

        <div className={styles.layout}>
          <section className={styles.panel} aria-labelledby="companies-title">
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle} id="companies-title">
                  Empresas
                </h2>
                <p className={styles.panelMeta}>{companies.length} registradas.</p>
              </div>
            </div>

            {editingCompany ? (
              <form className={styles.form} onSubmit={updateCompany}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="edit-company-name">
                    Nombre
                  </label>
                  <input
                    className={styles.input}
                    id="edit-company-name"
                    value={editingCompany.name}
                    onChange={(event) =>
                      setEditingCompany({ ...editingCompany, name: event.target.value })
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
                    onClick={() => setEditingCompany(null)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <form className={styles.form} onSubmit={createCompany}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="company-name">
                    Nueva empresa
                  </label>
                  <input
                    className={styles.input}
                    id="company-name"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className={styles.formActions}>
                  <button className={styles.button} type="submit" disabled={saving}>
                    Crear empresa
                  </button>
                </div>
              </form>
            )}

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
                    <div>
                      <p className={styles.entityName}>{company.name}</p>
                      <p className={styles.entityMeta}>ID: {company.id}</p>
                    </div>
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
                        setEditingPlant(null);
                        void loadPlants(company.id);
                      }}
                      disabled={saving || company.id === selectedCompanyId}
                    >
                      Ver plantas
                    </button>
                    <button
                      className={`${styles.button} ${styles.secondaryButton}`}
                      type="button"
                      onClick={() => setEditingCompany({ id: company.id, name: company.name })}
                      disabled={saving}
                    >
                      Editar
                    </button>
                    <button
                      className={`${styles.button} ${
                        company.active ? styles.dangerButton : styles.secondaryButton
                      }`}
                      type="button"
                      onClick={() => toggleCompany(company)}
                      disabled={saving}
                    >
                      {company.active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="plants-title">
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle} id="plants-title">
                  Plantas
                </h2>
                <p className={styles.panelMeta}>
                  {selectedCompany
                    ? `${plants.length} asociadas a ${selectedCompany.name}.`
                    : "Selecciona una empresa."}
                </p>
              </div>
            </div>

            {editingPlant ? (
              <form className={styles.form} onSubmit={updatePlant}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="edit-plant-name">
                    Nombre
                  </label>
                  <input
                    className={styles.input}
                    id="edit-plant-name"
                    value={editingPlant.name}
                    onChange={(event) =>
                      setEditingPlant({ ...editingPlant, name: event.target.value })
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
                    onClick={() => setEditingPlant(null)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <form className={styles.form} onSubmit={createPlant}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="plant-name">
                    Nueva planta
                  </label>
                  <input
                    className={styles.input}
                    id="plant-name"
                    value={plantName}
                    onChange={(event) => setPlantName(event.target.value)}
                    disabled={saving || !selectedCompanyId}
                  />
                </div>
                <div className={styles.formActions}>
                  <button
                    className={styles.button}
                    type="submit"
                    disabled={saving || !selectedCompanyId}
                  >
                    Crear planta
                  </button>
                </div>
              </form>
            )}

            <div className={styles.list}>
              {selectedCompany && plants.length === 0 ? (
                <p className={styles.empty}>No hay plantas cargadas para esta empresa.</p>
              ) : null}

              {!selectedCompany ? (
                <p className={styles.empty}>Primero crea o selecciona una empresa.</p>
              ) : null}

              {plants.map((plant) => (
                <article className={styles.row} key={plant.id}>
                  <div className={styles.rowTop}>
                    <div>
                      <p className={styles.entityName}>{plant.name}</p>
                      <p className={styles.entityMeta}>Empresa: {selectedCompany?.name}</p>
                    </div>
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
                      onClick={() => setEditingPlant({ id: plant.id, name: plant.name })}
                      disabled={saving}
                    >
                      Editar
                    </button>
                    <button
                      className={`${styles.button} ${
                        plant.active ? styles.dangerButton : styles.secondaryButton
                      }`}
                      type="button"
                      onClick={() => togglePlant(plant)}
                      disabled={saving}
                    >
                      {plant.active ? "Desactivar" : "Activar"}
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
