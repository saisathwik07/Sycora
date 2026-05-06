export interface Users {
  status: string;
  message: string;
  data: UsersData;
}

export interface UsersData {
  users: UserItem[];
  totalUsers: number;
  totalPages: number;
  currentPage: number;
}

export interface UserItem {
  _id: string;
  email: string;
  role: string;
  fullName?: string;
  displayName?: string;
  /** Workspace role from Organization.members */
  organizationRole?: string | null;
  __v?: number;
}
