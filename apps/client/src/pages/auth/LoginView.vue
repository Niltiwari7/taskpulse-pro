<script setup lang="ts">
import {ref} from "vue";
import {useRouter} from "vue-router";
import {useForm} from "vee-validate";
import {toTypedSchema} from "@/lib/zod-typed-schema"

import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'

import {loginSchema, type LoginInput} from '@taskpulse/shared-types'
import { useAuthStore } from "@/stores/auth";

const router = useRouter()
const authStore = useAuthStore()
const serverError = ref("")

const {
  defineField,
  errors,
  handleSubmit,
  isSubmitting,
} = useForm<LoginInput>({
  validationSchema: toTypedSchema(loginSchema),
  initialValues: {email: "", password: ""},
})

const [email, emailAttrs] = defineField("email")
const [password, passwordAttrs] = defineField("password")


const onSubmit = handleSubmit(async (values)=> {
  serverError.value = ""

  try {
    await authStore.login(values)
    await router.replace({ name: "dashboard" })
  }catch(error) {
    serverError.value = error instanceof Error ? error.message: "Unable to sign in. Please try again."
  }
})

</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-background px-4">
    <section class="w-80 max-w-md space-y-6">
      <header class="space-y-2 text-center">
        <h1 class="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p class="text-sm text-muted-foreground">
          Sign in to your TaskPulse account.
        </p>
      </header>

      <form class="space-y-5" @submit.prevent="onSubmit">
        <div
          v-if="serverError"
          role="alert"
          class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >{{ serverError }}</div>

        <div class="space-y-2">
          <label for="email" class="text-sm font-medium">Email</label>
          <Input
            id="email"
            v-model="email"
            v-bind="emailAttrs"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            :aria-invalid="Boolean(errors.email)"
            />
            <p v-if="errors.email" class="text-sm text-destructive">
            {{ errors.email }}
          </p>
        </div>

        <div class="space-y-2">
          <label for="password" class="text-sm font-medium">Password</label>
          <Input
            id="password"
            v-model="password"
            v-bind="passwordAttrs"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            :aria-invalid="Boolean(errors.password)"
            />
            <p v-if="errors.password" class="text-sm text-destructive">
            {{ errors.password }}
          </p>
        </div>

        <Button type="submit"
                class="w-full"
                :disabled="isSubmitting"
                >{{ isSubmitting ? "Signing in..." : "Sign in" }}</Button>
                </form>
       <p class="text-center text-sm text-muted-foreground">
        Don't have an account yet? <RouterLink to="/register" class="font-medium text-primary underline-offset-4 hover:underline">Sign up</RouterLink>
       </p>
    </section>
  </main>
</template>
