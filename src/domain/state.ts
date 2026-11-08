import type { IsoDate } from './clock';
import type {
  Batch,
  BloodBank,
  H1Entry,
  Medicine,
  Ngo,
  Order,
  Pickup,
  Prescription,
  ScratchCard,
  Store,
  User,
} from './types';

export interface BloodBooking {
  id: string;
  userId: string;
  bloodBankId: string;
  date: IsoDate;
  bloodGroup: string;
  status: 'BOOKED' | 'DONATED';
}

export interface Certificate {
  id: string;
  kind: 'NGO_DONOR' | 'GREEN_CITIZEN' | 'BLOOD_DONOR';
  userId: string;
  refId: string;
  issuedOn: IsoDate;
  /** Short code encoded in the certificate QR. */
  verifyCode: string;
  summary: string;
}

export interface RiderProfile {
  online: boolean;
  earnings: number;
  incentives: number;
  trips: number;
}

/** A fixed place riders deliver to, such as the authorised bio-medical waste plant. */
export interface Facility {
  name: string;
  area: string;
  lat: number;
  lng: number;
}

/** Everything the UI reads. Derived entirely from the event log. */
export interface AppState {
  today: IsoDate;
  // Reference data (seeded)
  /** The CBWTF incineration plant where Yellow-Bag pickups end. */
  cbwtf: Facility;
  medicines: Record<string, Medicine>;
  stores: Record<string, Store>;
  ngos: Record<string, Ngo>;
  bloodBanks: Record<string, BloodBank>;
  users: Record<string, User>;
  // Transactional data (built by events)
  batches: Record<string, Batch>;
  orders: Record<string, Order>;
  pickups: Record<string, Pickup>;
  prescriptions: Record<string, Prescription>;
  h1Register: H1Entry[];
  scratchCards: Record<string, ScratchCard>;
  karma: Record<string, number>;
  wallet: Record<string, number>;
  certificates: Certificate[];
  bloodBookings: Record<string, BloodBooking>;
  riders: Record<string, RiderProfile>;
}

export interface Seed {
  today: IsoDate;
  cbwtf: Facility;
  medicines: Medicine[];
  stores: Store[];
  ngos: Ngo[];
  bloodBanks: BloodBank[];
  users: User[];
  batches: Batch[];
  /** Starting MedWallet credit per user id. */
  wallet?: Record<string, number>;
}

const byId = <T extends { id: string }>(list: T[]): Record<string, T> =>
  Object.fromEntries(list.map((x) => [x.id, x]));

export function createInitialState(seed: Seed): AppState {
  return {
    today: seed.today,
    cbwtf: seed.cbwtf,
    medicines: byId(seed.medicines),
    stores: byId(seed.stores),
    ngos: byId(seed.ngos),
    bloodBanks: byId(seed.bloodBanks),
    users: byId(seed.users),
    batches: byId(seed.batches),
    orders: {},
    pickups: {},
    prescriptions: {},
    h1Register: [],
    scratchCards: {},
    karma: {},
    wallet: { ...(seed.wallet ?? {}) },
    certificates: [],
    bloodBookings: {},
    riders: Object.fromEntries(
      seed.users
        .filter((u) => u.role === 'rider')
        .map((u) => [u.id, { online: false, earnings: 0, incentives: 0, trips: 0 }]),
    ),
  };
}
