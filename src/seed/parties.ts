import type { BloodBank, Ngo, Store, User } from '../domain/types';

export const STORES: Store[] = [
  {
    id: 'store-ganesh',
    name: 'Sri Ganesh Medicals',
    area: 'Hampankatta, Mangaluru',
    drugLicence: 'KA-MNG-2026-8841',
    gstin: '29ABCDE1234F1Z5',
    kyc: 'APPROVED',
    lat: 12.8698,
    lng: 74.843,
  },
  {
    id: 'store-carstreet',
    name: 'Carstreet Pharmacy',
    area: 'Car Street, Mangaluru',
    drugLicence: 'KA-MNG-2026-9102',
    gstin: '29PQRSX5678L1Z2',
    kyc: 'PENDING_KYC',
    lat: 12.8732,
    lng: 74.8398,
  },
];

export const NGOS: Ngo[] = [
  {
    id: 'ngo-seva',
    name: 'Seva NGO Clinic',
    area: 'Kadri, Mangaluru',
    hasRegisteredProfessional: true,
    lat: 12.8854,
    lng: 74.8506,
  },
  {
    id: 'ngo-karunya',
    name: 'Karunya Old-Age Home',
    area: 'Bejai, Mangaluru',
    hasRegisteredProfessional: false,
    lat: 12.8861,
    lng: 74.8352,
  },
];

export const CBWTF = {
  name: 'Mangaluru CBWTF (authorised incineration plant)',
  area: 'Baikampady, Mangaluru',
  lat: 12.9419,
  lng: 74.8174,
};

export const BLOOD_BANKS: BloodBank[] = [
  { id: 'bb-wenlock', name: 'Wenlock Hospital Blood Bank', area: 'Hampankatta', urgentGroups: ['O-', 'B+'] },
  { id: 'bb-fathermuller', name: 'Father Muller Blood Bank', area: 'Kankanady', urgentGroups: ['A-', 'AB-'] },
];

export const USERS: User[] = [
  {
    id: 'u-asha',
    role: 'customer',
    name: 'Asha Shetty',
    address: '12, Kadri Hills, Mangaluru',
    lat: 12.883,
    lng: 74.856,
  },
  {
    id: 'u-ravi',
    role: 'customer',
    name: 'Ravi Kumar',
    address: '4th Cross, Bejai, Mangaluru',
    lat: 12.8872,
    lng: 74.8369,
  },
  { id: 'u-chemist', role: 'chemist', name: 'Ganesh Prabhu', storeId: 'store-ganesh' },
  { id: 'u-rider', role: 'rider', name: 'Kiran Poojary' },
  { id: 'u-admin', role: 'admin', name: 'PharmaFlow Admin' },
];
