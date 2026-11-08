import { z } from 'zod';

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const ScheduleSchema = z.enum(['OTC', 'H', 'H1', 'X']);
export type Schedule = z.infer<typeof ScheduleSchema>;

export const FormSchema = z.enum(['TABLET', 'CAPSULE', 'SYRUP', 'GEL', 'SACHET', 'DEVICE']);
export type MedicineForm = z.infer<typeof FormSchema>;

export const MedicineSchema = z.object({
  id: z.string(),
  brand: z.string(),
  salt: z.string(),
  strength: z.string(),
  packSize: z.string(),
  manufacturer: z.string(),
  mrp: z.number().nonnegative(),
  schedule: ScheduleSchema,
  isAntibiotic: z.boolean().default(false),
  coldChain: z.boolean().default(false),
  form: FormSchema,
  /** Typical course length in days; used for Eco-Sale eligibility. */
  courseDays: z.number().int().positive(),
  gtin: z.string().length(14),
  /** Jan Aushadhi / generic alternative with the same salt and strength. */
  generic: z
    .object({ name: z.string(), price: z.number().nonnegative() })
    .optional(),
});
export type Medicine = z.infer<typeof MedicineSchema>;

export const BatchStatusSchema = z.enum([
  'IN_STOCK',
  'ECO_SALE',
  'DONATION_PENDING',
  'DISPOSAL_PENDING',
  'CLOSED',
]);
export type BatchStatus = z.infer<typeof BatchStatusSchema>;

export const BatchSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  medicineId: z.string(),
  batchNo: z.string(),
  expiry: IsoDateSchema,
  qty: z.number().int().nonnegative(),
  status: BatchStatusSchema,
  ecoDiscountPct: z.number().min(0).max(100).optional(),
});
export type Batch = z.infer<typeof BatchSchema>;

export const KycStatusSchema = z.enum(['PENDING_KYC', 'APPROVED', 'REJECTED']);
export type KycStatus = z.infer<typeof KycStatusSchema>;

export const StoreSchema = z.object({
  id: z.string(),
  name: z.string(),
  area: z.string(),
  drugLicence: z.string(),
  gstin: z.string(),
  kyc: KycStatusSchema,
  lat: z.number(),
  lng: z.number(),
});
export type Store = z.infer<typeof StoreSchema>;

export const NgoSchema = z.object({
  id: z.string(),
  name: z.string(),
  area: z.string(),
  /** Needed to receive Rx-only medicines. */
  hasRegisteredProfessional: z.boolean(),
  lat: z.number(),
  lng: z.number(),
});
export type Ngo = z.infer<typeof NgoSchema>;

export const BloodBankSchema = z.object({
  id: z.string(),
  name: z.string(),
  area: z.string(),
  urgentGroups: z.array(z.string()),
});
export type BloodBank = z.infer<typeof BloodBankSchema>;

export const RoleSchema = z.enum(['customer', 'chemist', 'rider', 'admin']);
export type Role = z.infer<typeof RoleSchema>;

export const UserSchema = z.object({
  id: z.string(),
  role: RoleSchema,
  name: z.string(),
  storeId: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const PrescriptionSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  doctorName: z.string(),
  registrationNo: z.string(),
  date: IsoDateSchema,
  patientName: z.string(),
  drugs: z.array(z.object({ medicineId: z.string(), qty: z.number().int().positive() })),
  /** Optional photo (data URL). OCR output is only a suggestion. */
  imageDataUrl: z.string().optional(),
  usedByOrderId: z.string().optional(),
});
export type Prescription = z.infer<typeof PrescriptionSchema>;

export const OrderStatusSchema = z.enum([
  'PLACED',
  'RX_APPROVED',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderItemSchema = z.object({
  medicineId: z.string(),
  batchId: z.string().optional(),
  qty: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  ecoSale: z.boolean().default(false),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const RxStatusSchema = z.enum(['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED']);
export type RxStatus = z.infer<typeof RxStatusSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  storeId: z.string(),
  items: z.array(OrderItemSchema).min(1),
  status: OrderStatusSchema,
  rxStatus: RxStatusSchema,
  prescriptionId: z.string().optional(),
  rxRejectReason: z.string().optional(),
  riderId: z.string().optional(),
  riderArrived: z.boolean().optional(),
  walletUsed: z.number().nonnegative().optional(),
  deliveryOtp: z.string().optional(),
  total: z.number().nonnegative(),
  placedAt: IsoDateSchema,
});
export type Order = z.infer<typeof OrderSchema>;

export const PickupKindSchema = z.enum(['DONATION', 'DISPOSAL']);
export type PickupKind = z.infer<typeof PickupKindSchema>;

export const PickupStatusSchema = z.enum([
  'SCHEDULED',
  'COLLECTED',
  'QA_VERIFIED',
  'QA_REJECTED',
  'DELIVERED_TO_NGO',
  'INCINERATED',
]);
export type PickupStatus = z.infer<typeof PickupStatusSchema>;

export const PickupItemSchema = z.object({
  medicineId: z.string(),
  batchNo: z.string(),
  expiry: IsoDateSchema,
  qty: z.number().int().positive(),
  sealed: z.boolean().default(true),
  openedLiquid: z.boolean().default(false),
});
export type PickupItem = z.infer<typeof PickupItemSchema>;

export const PickupSchema = z.object({
  id: z.string(),
  kind: PickupKindSchema,
  /** Customer or store that is giving the medicines. */
  sourceUserId: z.string().optional(),
  sourceStoreId: z.string().optional(),
  /** Chemist who runs QA (customer-sourced donations). */
  qaStoreId: z.string().optional(),
  ngoId: z.string().optional(),
  items: z.array(PickupItemSchema).min(1),
  status: PickupStatusSchema,
  riderId: z.string().optional(),
  riderArrived: z.boolean().optional(),
  batchId: z.string().optional(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  scheduledAt: IsoDateSchema,
  qaNote: z.string().optional(),
});
export type Pickup = z.infer<typeof PickupSchema>;

export const H1EntrySchema = z.object({
  id: z.string(),
  orderId: z.string(),
  patientName: z.string(),
  doctorName: z.string(),
  doctorRegNo: z.string(),
  medicineId: z.string(),
  qty: z.number().int().positive(),
  date: IsoDateSchema,
  /** Registers must be kept for three years. */
  retainUntil: IsoDateSchema,
});
export type H1Entry = z.infer<typeof H1EntrySchema>;

export const ScratchCardSchema = z.object({
  id: z.string(),
  userId: z.string(),
  source: z.string(),
  revealed: z.boolean(),
  rewardKarma: z.number().int().nonnegative(),
  rewardCredit: z.number().nonnegative(),
});
export type ScratchCard = z.infer<typeof ScratchCardSchema>;
