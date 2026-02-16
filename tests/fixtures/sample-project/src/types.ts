/** User entity */
export interface User {
  id: string
  name: string
  email: string
}

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findAll(): Promise<User[]>
  save(user: User): Promise<void>
}

/**
 * @deprecated Use UserRepository instead
 * @see UserRepository
 */
export interface OldUserStore {
  getUser(id: string): Promise<User | null>
}

/**
 * @ts-mcp-caution Modifying this affects payment flow
 * @ts-mcp-owner backend-team
 */
export interface PaymentService {
  charge(userId: string, amount: number): Promise<boolean>
}
