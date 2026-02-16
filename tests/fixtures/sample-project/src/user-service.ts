import type { User, UserRepository } from './types'

export class InMemoryUserRepository implements UserRepository {
  private users: Map<string, User> = new Map()

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values())
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user)
  }
}

/**
 * @param repository - User data source
 * @returns User or throws if not found
 * @throws Error when user is not found
 */
export async function getUserOrThrow(
  repository: UserRepository,
  id: string,
): Promise<User> {
  const user = await repository.findById(id)
  if (!user) throw new Error(`User ${id} not found`)
  return user
}
