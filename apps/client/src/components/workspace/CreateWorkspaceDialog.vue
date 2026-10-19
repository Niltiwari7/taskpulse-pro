<!--
  "New workspace" modal. Controlled from outside with v-model:open, so any
  button in the app (dashboard header, switcher menu) can open it.

  Flow: vee-validate checks the shared zod schema → mutation POSTs → on success
  the mutation invalidates the workspace list (see useCreateWorkspace) → every
  list on screen refetches → we close the dialog and toast.
-->
<script setup lang="ts">
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toast } from "vue-sonner";
import { Globe, Lock } from "@lucide/vue";
import { createWorkspaceSchema } from "@taskpulse/shared-types";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateWorkspace } from "@/composables/useWorkspaces";
import { toTypedSchema } from "@/lib/zod-typed-schema";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/http";

const open = defineModel<boolean>("open", { default: false });

const serverError = ref("");
const { mutateAsync: createWorkspace } = useCreateWorkspace();

const { defineField, errors, handleSubmit, isSubmitting, resetForm, setErrors } = useForm({
  validationSchema: toTypedSchema(createWorkspaceSchema),
  initialValues: { name: "", description: "", visibility: "PRIVATE" as const },
});

const [name, nameAttrs] = defineField("name");
const [description, descriptionAttrs] = defineField("description");
const [visibility] = defineField("visibility");

const visibilityOptions = [
  { value: "PRIVATE", label: "Private", hint: "Only invited members", icon: Lock },
  { value: "PUBLIC", label: "Public", hint: "Anyone with the link", icon: Globe },
] as const;

// Start clean every time the dialog closes (cancel, Esc, overlay click, or success)
watch(open, (isOpen) => {
  if (!isOpen) {
    resetForm();
    serverError.value = "";
  }
});

const onSubmit = handleSubmit(async (values) => {
  serverError.value = "";
  try {
    const workspace = await createWorkspace({
      ...values,
      // An empty textarea means "no description", not an empty string
      description: values.description || undefined,
    });
    open.value = false;
    toast.success(`Workspace "${workspace.name}" created`);
  } catch (error) {
    // Server-side validation errors map straight onto the fields
    if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
      const details = error.details as { fieldErrors?: Record<string, string[]> } | undefined;
      setErrors(details?.fieldErrors ?? {});
    }
    serverError.value =
      error instanceof Error ? error.message : "Unable to create the workspace. Please try again.";
  }
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create new workspace</DialogTitle>
        <DialogDescription>A workspace groups your boards and the people working on them.</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div
          v-if="serverError"
          role="alert"
          class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {{ serverError }}
        </div>

        <div class="space-y-2">
          <Label for="workspace-name">Workspace name <span class="text-destructive">*</span></Label>
          <Input
            id="workspace-name"
            v-model="name"
            v-bind="nameAttrs"
            placeholder="e.g. Q4 Marketing Campaign"
            autocomplete="off"
            :aria-invalid="Boolean(errors.name)"
          />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>

        <div class="space-y-2">
          <Label for="workspace-description">Description <span class="text-muted-foreground">(optional)</span></Label>
          <Textarea
            id="workspace-description"
            :model-value="description ?? ''"
            v-bind="descriptionAttrs"
            @update:model-value="description = String($event)"
            rows="3"
            class="resize-none"
            placeholder="What is this workspace for?"
            :aria-invalid="Boolean(errors.description)"
          />
          <p v-if="errors.description" class="text-sm text-destructive">{{ errors.description }}</p>
        </div>

        <fieldset class="space-y-2">
          <legend class="text-sm font-medium">Visibility</legend>
          <div role="radiogroup" class="grid grid-cols-2 gap-2">
            <button
              v-for="option in visibilityOptions"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="visibility === option.value"
              :class="
                cn(
                  'flex items-start gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-accent',
                  visibility === option.value && 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500 hover:bg-indigo-50/50',
                )
              "
              @click="visibility = option.value"
            >
              <component :is="option.icon" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                <span class="block text-sm font-medium">{{ option.label }}</span>
                <span class="block text-xs text-muted-foreground">{{ option.hint }}</span>
              </span>
            </button>
          </div>
        </fieldset>

        <DialogFooter class="pt-4">
          <Button type="button" variant="outline" @click="open = false">Cancel</Button>
          <Button type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? "Creating..." : "Create workspace" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
