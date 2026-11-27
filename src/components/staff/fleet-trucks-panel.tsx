"use client";

import { useMemo, useState } from "react";
import { Search, Truck, UserRound } from "lucide-react";
import type { OdooDriverRecord } from "@/lib/integrations/odoo/types";
import { sortDriverRecords } from "@/lib/orders/transport";

function dash(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : "—";
}

export function FleetTrucksPanel({
  drivers,
  loadError,
}: {
  drivers: OdooDriverRecord[];
  loadError: string | null;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const ranked = sortDriverRecords(drivers);
    if (!needle) return ranked;
    return ranked.filter((driver) =>
      [driver.contactName, driver.driverNo, driver.driverEpra, driver.truckDetails, driver.truckEpra, driver.assignedTruckName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [drivers, q]);

  const withTruck = drivers.filter((driver) => driver.assignedTruckName).length;
  const withEpra = drivers.filter((driver) => driver.driverEpra).length;
  const withContact = drivers.filter((driver) => driver.contactName).length;

  return (
    <>
      <div className="ps-panel__head">
        <span className="ps-panel__ico" aria-hidden>
          <Truck size={22} strokeWidth={2.05} />
        </span>
        <div className="ps-panel__copy">
          <h2>Fleet &amp; Trucks</h2>
          <p>
            Driver records are read from Odoo, including the assigned truck. A driver or truck added there
            appears here. Trucks and fleets are created in Odoo, not in this portal.
          </p>
        </div>
      </div>

      <div className="ft-filters ft-filters--search">
        <label className="ft-field ft-field--search">
          <span className="ft-field__sr">Search</span>
          <span className="ft-field__control ft-field__control--search">
            <Search size={14} aria-hidden />
            <input
              type="search"
              placeholder="Search driver, ID, EPRA or truck..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </span>
        </label>
      </div>

      <div className="ft-stats" aria-label="Driver record counts">
        <div className="ft-stat">
          <span className="ft-stat__ico ft-stat__ico--total" aria-hidden>
            <Truck size={15} />
          </span>
          <div>
            <div className="ft-stat__value">{drivers.length}</div>
            <div className="ft-stat__label">Driver records</div>
          </div>
        </div>
        <div className="ft-stat">
          <span className="ft-stat__ico ft-stat__ico--active" aria-hidden>
            <Truck size={15} />
          </span>
          <div>
            <div className="ft-stat__value">{withTruck}</div>
            <div className="ft-stat__label">Assigned truck</div>
          </div>
        </div>
        <div className="ft-stat">
          <span className="ft-stat__ico ft-stat__ico--maint" aria-hidden>
            <UserRound size={15} />
          </span>
          <div>
            <div className="ft-stat__value">{withEpra}</div>
            <div className="ft-stat__label">Driver EPRA</div>
          </div>
        </div>
        <div className="ft-stat">
          <span className="ft-stat__ico ft-stat__ico--inactive" aria-hidden>
            <UserRound size={15} />
          </span>
          <div>
            <div className="ft-stat__value">{withContact}</div>
            <div className="ft-stat__label">Contact</div>
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="ft-empty" role="status">
          <h3 className="ft-empty__title">Driver records could not be loaded</h3>
          <p className="ft-empty__copy">{loadError}</p>
        </div>
      ) : drivers.length === 0 ? (
        <div className="ft-empty" role="status">
          <h3 className="ft-empty__title">No driver records</h3>
          <p className="ft-empty__copy">Odoo has no driver records yet. Add them in Odoo and they will appear here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ft-empty ft-empty--filtered" role="status">
          <h3 className="ft-empty__title">No matching driver records</h3>
          <p className="ft-empty__copy">Nothing in the Odoo list matches that search.</p>
          <button
            type="button"
            className="ps-btn ps-btn--line ft-empty__cta"
            onClick={() => setQ("")}
          >
            Clear search
          </button>
        </div>
      ) : (
        <>
          <div className="ps-table-wrap ft-table-wrap ft-table-wrap--drivers">
            <table className="ps-table ft-table ft-table--drivers">
              <thead>
                <tr>
                  <th>res.partner</th>
                  <th>Driver ID</th>
                  <th>Driver EPRA</th>
                  <th>Truck Details</th>
                  <th>Truck EPRA No.</th>
                  <th>Assigned Truck</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((driver) => (
                  <tr key={driver.id}>
                    <td>
                      <span className="tm-name">
                        <UserRound size={14} aria-hidden />
                        {dash(driver.contactName)}
                      </span>
                    </td>
                    <td>
                      <span className="ft-id-value">{dash(driver.driverNo)}</span>
                    </td>
                    <td>
                      <span className={driver.driverEpra ? "ft-epra" : "ft-dash"}>{dash(driver.driverEpra)}</span>
                    </td>
                    <td>
                      {driver.truckDetails ? (
                        <span className="tm-pumps">
                          <Truck size={13} strokeWidth={2.1} aria-hidden />
                          {driver.truckDetails}
                        </span>
                      ) : (
                        <span className="ft-dash">—</span>
                      )}
                    </td>
                    <td>
                      <span className={driver.truckEpra ? "ft-epra" : "ft-dash"}>{dash(driver.truckEpra)}</span>
                    </td>
                    <td>
                      {driver.assignedTruckName ? (
                        <span className="tm-name">
                          <Truck size={14} aria-hidden />
                          {driver.assignedTruckName}
                        </span>
                      ) : (
                        <span className="ft-dash">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
