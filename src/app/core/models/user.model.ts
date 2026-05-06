export type Users = User[];

export interface User {
  _id: string;
  email: string;
  role: 'user' | 'admin' | 'super';
  organization?: string;
  __v: number;
}

