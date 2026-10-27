import { api } from "@/lib/api/client";
import type { CurrentUser, LoginResponse } from "@/types/api";

export function signIn(usernameOrEmail: string, password: string) {
  return api.post<LoginResponse>("/auth/login", { usernameOrEmail, password });
}

export function getCurrentUser() {
  return api.get<CurrentUser>("/auth/me");
}
