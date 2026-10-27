export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UserPermission {
  key: string;
  module: string;
  action: string;
  description: string | null;
}

export interface CurrentUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  fullNameBangla: string | null;
  phone: string | null;
  isActive: boolean;
  role: {
    id: string;
    name: string;
    description: string | null;
    permissions: UserPermission[];
  } | null;
  employee: {
    id: string;
    employeeNumber: string | null;
    employeeType: string;
    name: string;
    photoUrl: string | null;
    department: { id: string; name: string } | null;
    designation: { id: string; name: string } | null;
    status: string;
  } | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LoginResponse {
  user: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    fullNameBangla: string | null;
    isActive: boolean;
    role: { id: string; name: string; description: string | null } | null;
    employee: CurrentUser["employee"];
  };
}

export interface PharmacyDashboardStats {
  totalSales: number;
  salesCount: number;
  totalPurchases: number;
  purchasesCount: number;
  totalMedicines: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalCashInHand: number;
  expiringIn30Days: number;
}

export interface PharmacyGraphPoint {
  date: string;
  sales: number;
  purchases: number;
}
