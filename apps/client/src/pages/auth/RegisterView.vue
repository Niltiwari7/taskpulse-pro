<script setup lang="ts">
import {ref} from "vue";
import {useRouter} from "vue-router";
import {useForm} from "vee-validate";
import {toTypedSchema} from "@/lib/zod-typed-schema"
import {Button} from '@/components/ui/button'
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth";
import { registerSchema, type RegisterInput } from "@taskpulse/shared-types";

const router = useRouter()
const authStore = useAuthStore()
const serverError = ref("")

const {
  defineField,
  errors,
  handleSubmit,
  isSubmitting,
} = useForm<RegisterInput>({
  validationSchema: toTypedSchema(registerSchema),
});

const [username, usernameAttrs] = defineField("username")
const [email, emailAttrs] = defineField("email")
const [password, passwordAttrs] = defineField("password")

const onSubmit = handleSubmit(async (values) => {
  serverError.value = ""

  try {
    await authStore.register(values)
    await router.replace({ name: "dashboard" })
  }
  catch (error) {
    serverError.value = error instanceof Error ? error.message: "Something went wrong, Please try again"
  }
})
</script>
<template>
   <main class="flex min-h-screen items-center justify-center bg-background px-3 py-8">
    <section class="w-80 max-w-md space-y-6">
      <header class="space-y-2 text-center">
        <h1 class="text-3xl font-bold tracking-tight">Create an account</h1>
        <p class="text-sm text-muted-foreground">
          Get started with TaskPulse today.
        </p>
      </header>

      <form class="space-y-5" @submit.prevent="onSubmit">
        <div
          v-if="serverError"
          role="alert"
          class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >{{ serverError }}</div>

        <div class="space-y-2">
          <label for="username" class="text-sm font-medium">Username</label>
          <Input
            id="username"
            v-model="username"
            v-bind="usernameAttrs"
            type="text"
            autocomplete="username"
            placeholder="johndoe"
            :aria-invalid="Boolean(errors.username)"
            />
            <p v-if="errors.username" class="text-sm text-destructive">
            {{ errors.username }}
          </p>
        </div>

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
            autocomplete="new-password"
            placeholder="••••••••"
            :aria-invalid="Boolean(errors.password)"
            />
            <p v-if="errors.password" class="text-sm text-destructive">
            {{ errors.password }}
          </p>
        </div>

        <Button type="submit" 
                class="w-80"
        :disabled="isSubmitting">
          {{isSubmitting ? "Creating account..." : "Create account" }}
        </Button>
        </form>

        <p class="text-center text-sm text-muted-foreground">
          Already have an account? <RouterLink to="/login" class="font-medium text-primary underline-offset-4 hover:underline">Sign in</RouterLink>
        </p>
    </section>
   </main>
</template>
