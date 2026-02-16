import type { UserRepository } from './types'
import { getUserOrThrow } from './user-service'

export class UserController {
  constructor(private repo: UserRepository) {}

  async getUser(id: string) {
    return getUserOrThrow(this.repo, id)
  }

  async listUsers() {
    return this.repo.findAll()
  }
}
