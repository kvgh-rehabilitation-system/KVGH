/** 登入 API（/api/auth/*）。 */
import { client } from './client'
import type { Role } from '../types'

export interface LoginResult {
  access_token: string
  role: Role
  name: string
  username: string
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const { data } = await client.post<LoginResult>('/auth/login', { username, password })
  return data
}
