import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { PublicUser } from "@taskpulse/shared-types";

import { ApiError, http } from "@/services/http";

interface UserResponse {
  data: {
    user: PublicUser;
  };
}

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterInput extends Credentials {
  username: string;
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<PublicUser | null>(null);
  const loading = ref(false);
  // Derived, so it can never drift out of sync with `user`
  const isAuthenticated = computed(() => user.value !== null);

  async function fetchMe(): Promise<PublicUser | null> {
    try {
      const response = await http<UserResponse>("/auth/me");
      user.value = response.data.user;
      return user.value;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        user.value = null;
        return null;
      }
      throw error;
    }
  }

  async function login(input: Credentials): Promise<PublicUser> {
    loading.value = true;
    try {
      const response = await http<UserResponse>("/auth/login", {
        method: "POST",
        body: input,
      });
      user.value = response.data.user;
      return user.value;
    } finally {
      loading.value = false;
    }
  }

  // The server does not start a session on register, so log in right after
  // to leave the user actually authenticated (cookie set).
  async function register(input: RegisterInput): Promise<PublicUser> {
    loading.value = true;
    try {
      await http<UserResponse>("/auth/register", {
        method: "POST",
        body: input,
      });
    } finally {
      loading.value = false;
    }
    return login({ email: input.email, password: input.password });
  }

  async function logout(): Promise<void> {
    try {
      await http<{ data: { message: string } }>("/auth/logout", { method: "POST" });
    } finally {
      // Clear local state even if the request fails; the user asked to be logged out
      user.value = null;
    }
  }

  return {
    user,
    loading,
    isAuthenticated,
    fetchMe,
    login,
    register,
    logout,
  };
});
