import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OrderInputError } from "./order-input";
import {
  capacityNotice,
  driverCountLabel,
  driverRecordCompleteness,
  parseDriverRecordIds,
  selectDriverSnapshots,
  sortDriverRecords,
  type OrderDriverRecord,
} from "./transport";

const catalog: OrderDriverRecord[] = [
  {
    id: 8,
    driverName: "MICHAEL GATU",
    driverNo: "766520700",
    driverEpra: null,
    truckPlate: "KBZ556E",
    truckDetails: "KBZ556E",
    assignedTruckName: "KBZ556E",
    truckEpra: null,
    capacityLitres: 60000,
    contactId: 4783,
    contactName: "MICHAEL GATU",
    fleetTruckId: 400,
  },
  {
    id: 20,
    driverName: "OPEN DRIVER",
    driverNo: "27684614",
    driverEpra: null,
    truckPlate: "KDW 414S",
    truckDetails: "KDW 414S",
    assignedTruckName: "KDW 414S",
    truckEpra: null,
    capacityLitres: 0,
    contactId: null,
    contactName: null,
    fleetTruckId: 407,
  },
];

describe("driver record selection", () => {
  it("reads the ids the form posts and rejects duplicates and junk", () => {
    assert.deepEqual(parseDriverRecordIds("[8,20]"), [8, 20]);
    assert.throws(() => parseDriverRecordIds("[]"), OrderInputError);
    assert.throws(() => parseDriverRecordIds("[8,8]"), OrderInputError);
    assert.throws(() => parseDriverRecordIds("[0]"), OrderInputError);
    assert.throws(() => parseDriverRecordIds("not-json"), OrderInputError);
  });

  it("copies the server record and refuses an id that is not in the catalog", () => {
    const selected = selectDriverSnapshots(catalog, [20, 8]);
    assert.deepEqual(selected.map((row) => row.id), [20, 8]);
    assert.equal(selected[0].capacityLitres, 0);
    assert.equal(selected[0].contactName, null);
    assert.throws(() => selectDriverSnapshots(catalog, [99]), OrderInputError);
    assert.throws(() => selectDriverSnapshots(catalog, []), OrderInputError);
  });

  it("warns only when known capacity is short, and never treats zero as confirmed", () => {
    assert.equal(capacityNotice([catalog[0]], 33000), null);
    assert.match(capacityNotice([catalog[0]], 70000) ?? "", /60,000 L/);
    assert.match(capacityNotice([catalog[1]], 1000) ?? "", /no recorded capacity/);
    assert.equal(capacityNotice([catalog[0], catalog[1]], 10000), null);
    assert.equal(driverCountLabel(1), "1 Driver Record");
    assert.equal(driverCountLabel(2), "2 Driver Records");
  });

  it("lists the most complete driver records first", () => {
    const sparse: OrderDriverRecord = {
      ...catalog[1],
      id: 1,
      driverName: "ZZZ SPARSE",
      truckDetails: null,
      truckPlate: null,
      assignedTruckName: null,
      contactName: null,
    };
    const mid: OrderDriverRecord = { ...catalog[1], id: 3, driverName: "MID RECORD" };
    const full: OrderDriverRecord = { ...catalog[0], id: 2, driverEpra: "EPRA-1", truckEpra: "TE-1" };
    assert.equal(driverRecordCompleteness(full), 6);
    assert.equal(driverRecordCompleteness(mid), 3);
    assert.equal(driverRecordCompleteness(sparse), 1);
    assert.deepEqual(sortDriverRecords([sparse, mid, full]).map((row) => row.id), [2, 3, 1]);
  });
});
