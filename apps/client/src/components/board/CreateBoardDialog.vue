<!--
  "New board" modal — same flow as CreateWorkspaceDialog: shared zod schema →
  mutation → list invalidated → close + toast. After creating, we go straight
  to the new board, which is what the user almost always wants next.
-->
<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useForm } from "vee-validate";
import { toast } from "vue-sonner";
import { createBoardSchema } from "@taskpulse/shared-types";

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
import { useCreateBoard } from "@/composables/useBoards";
import { BOARD_VISIBILITY } from "@/lib/board-display";
import { toTypedSchema } from "@/lib/zod-typed-schema";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/http";

const props = defineProps<{ workspaceId: string }>();
const open = defineModel<boolean>("open", { default: false });

const router = useRouter();
const serverError = ref("");
const { mutateAsync: createBoard } = useCreateBoard(() => props.workspaceId);

const { defineField, errors, handleSubmit, isSubmitting, resetForm, setErrors } = useForm({
  validationSchema: toTypedSchema(createBoardSchema),
  initialValues: { name: "", visibility: "WORKSPACE" as const },
});

const [name, nameAttrs] = defineField("name");
const [visibility] = defineField("visibility");

const visibilityOptions = (["WORKSPACE", "PRIVATE", "PUBLIC"] as const).map((value) => ({
  value,
  ...BOARD_VISIBILITY[value],
}));

watch(open, (isOpen) => {
  if (!isOpen) {
    resetForm();
    serverError.value = "";
  }
});

const onSubmit = handleSubmit(async (values) => {
  serverError.value = "";
  try {
    const board = await createBoard(values);
    open.value = false;
    toast.success(`Board "${board.name}" created`);
    await router.push({ name: "board", params: { boardId: board.id } });
  } catch (error) {
    if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
      const details = error.details as { fieldErrors?: Record<string, string[]> } | undefined;
      setErrors(details?.fieldErrors ?? {});
    }
    serverError.value =
      error instanceof Error ? error.message : "Unable to create the board. Please try again.";
  }
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Create new board</DialogTitle>
        <DialogDescription>Boards hold the lists and cards for one project or process.</DialogDescription>
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
          <Label for="board-name">Board title <span class="text-destructive">*</span></Label>
          <Input
            id="board-name"
            v-model="name"
            v-bind="nameAttrs"
            placeholder="e.g. Website relaunch"
            autocomplete="off"
            :aria-invalid="Boolean(errors.name)"
          />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>

        <fieldset class="space-y-2">
          <legend class="text-sm font-medium">Visibility</legend>
          <div role="radiogroup" class="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
            {{ isSubmitting ? "Creating..." : "Create board" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
