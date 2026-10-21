<!--
  Members of one workspace: list, invite by email, change role, remove.

  Who may do what is decided by the SERVER. The page only reads the current
  user's role from the list (isAdmin) to hide controls they could not use
  anyway; a MEMBER who forces a request still gets a 403.
-->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useForm } from "vee-validate";
import { toast } from "vue-sonner";
import { AlertCircle, ArrowLeft, ChevronDown, Trash2, UserPlus } from "@lucide/vue";
import {
  inviteMemberSchema,
  type WorkspaceMemberWithUser,
  type WorkspaceRole,
} from "@taskpulse/shared-types";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import WorkspaceAvatar from "@/components/workspace/WorkspaceAvatar.vue";
import {
  useInviteMember,
  useRemoveMember,
  useUpdateMemberRole,
  useWorkspaceMembersQuery,
} from "@/composables/useWorkspaceMembers";
import { useWorkspacesQuery } from "@/composables/useWorkspaces";
import { toTypedSchema } from "@/lib/zod-typed-schema";
import { ApiError } from "@/services/http";
import { useAuthStore } from "@/stores/auth";
import { useWorkspaceStore } from "@/stores/workspace";

const props = defineProps<{ workspaceId: string }>();

const router = useRouter();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();

const workspaceId = () => props.workspaceId;
const { data: members, isPending, isError, error, refetch, isFetching } = useWorkspaceMembersQuery(workspaceId);
const { data: workspaces } = useWorkspacesQuery();
const { mutateAsync: invite } = useInviteMember(workspaceId);
const { mutateAsync: updateRole, isPending: isUpdatingRole } = useUpdateMemberRole(workspaceId);
const { mutateAsync: remove, isPending: isRemoving } = useRemoveMember(workspaceId);

const workspace = computed(() => workspaces.value?.find((w) => w.id === props.workspaceId) ?? null);

// Keep the header switcher and this page in sync, in both directions.
watch(() => props.workspaceId, (id) => workspaceStore.select(id), { immediate: true });
watch(
  () => workspaceStore.selectedId,
  (id) => {
    if (id && id !== props.workspaceId) {
      router.replace({ name: "workspace-members", params: { workspaceId: id } });
    }
  },
);

const currentUserId = computed(() => authStore.user?.id);
const isAdmin = computed(() =>
  members.value?.some((m) => m.userId === currentUserId.value && m.role === "ADMIN") ?? false,
);
const adminCount = computed(() => members.value?.filter((m) => m.role === "ADMIN").length ?? 0);

// Mirrors the server rule so the UI disables what would fail anyway.
function isLastAdmin(member: WorkspaceMemberWithUser): boolean {
  return member.role === "ADMIN" && adminCount.value <= 1;
}

const isNotFound = computed(() => error.value instanceof ApiError && error.value.status === 404);

// ─── Error messages ──────────────────────────────────────────────────────────
const ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: "No TaskPulse account uses that email. Ask them to sign up first.",
  ALREADY_MEMBER: "That person is already a member of this workspace.",
  LAST_ADMIN: "A workspace needs at least one admin. Make someone else an admin first.",
  FORBIDDEN: "Only workspace admins can do that.",
};

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return ERROR_MESSAGES[err.code] ?? err.message;
  return fallback;
}

// ─── Display helpers ─────────────────────────────────────────────────────────
function displayName(member: WorkspaceMemberWithUser): string {
  return member.user.fullName || member.user.username;
}

function initials(member: WorkspaceMemberWithUser): string {
  return displayName(member).charAt(0).toUpperCase();
}

const roleLabel: Record<WorkspaceRole, string> = { ADMIN: "Admin", MEMBER: "Member" };

// ─── Invite ──────────────────────────────────────────────────────────────────
const { defineField, errors, handleSubmit, isSubmitting, resetForm } = useForm({
  validationSchema: toTypedSchema(inviteMemberSchema),
  initialValues: { email: "" },
});
const [email, emailAttrs] = defineField("email");

const onInvite = handleSubmit(async (values) => {
  try {
    const member = await invite({ email: values.email });
    resetForm();
    toast.success(`${displayName(member)} was added to the workspace`);
  } catch (err) {
    toast.error(errorMessage(err, "Couldn't add that member. Please try again."));
  }
});

// ─── Change role ─────────────────────────────────────────────────────────────
async function changeRole(member: WorkspaceMemberWithUser, role: WorkspaceRole) {
  if (role === member.role) return;
  try {
    await updateRole({ userId: member.userId, role });
    toast.success(`${displayName(member)} is now ${roleLabel[role].toLowerCase()}`);
  } catch (err) {
    toast.error(errorMessage(err, "Couldn't change the role. Please try again."));
  }
}

// ─── Remove (with confirmation) ──────────────────────────────────────────────
const memberToRemove = ref<WorkspaceMemberWithUser | null>(null);
const confirmOpen = computed({
  get: () => memberToRemove.value !== null,
  set: (open) => {
    if (!open) memberToRemove.value = null;
  },
});
const removingSelf = computed(() => memberToRemove.value?.userId === currentUserId.value);

async function confirmRemove() {
  const member = memberToRemove.value;
  if (!member) return;

  try {
    await remove(member.userId);
    memberToRemove.value = null;

    if (member.userId === currentUserId.value) {
      // You left: this page is no longer yours to see.
      toast.success(`You left ${workspace.value?.name ?? "the workspace"}`);
      workspaceStore.select(null);
      await router.push({ name: "dashboard" });
      return;
    }
    toast.success(`${displayName(member)} was removed from the workspace`);
  } catch (err) {
    toast.error(errorMessage(err, "Couldn't remove that member. Please try again."));
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-4xl p-6 sm:p-10">
    <RouterLink
      :to="{ name: 'dashboard' }"
      class="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft class="size-4" />
      Workspaces
    </RouterLink>

    <div class="mb-8 flex items-center gap-4">
      <WorkspaceAvatar v-if="workspace" :workspace="workspace" size="lg" />
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Members</h1>
        <p class="mt-1 truncate text-sm text-muted-foreground sm:text-base">
          {{ workspace?.name ?? "Workspace" }}
          <template v-if="members"> · {{ members.length }} {{ members.length === 1 ? "member" : "members" }}</template>
        </p>
      </div>
    </div>

    <!-- 1. Loading -->
    <div v-if="isPending" class="space-y-3">
      <Skeleton class="h-24 rounded-xl" />
      <Skeleton v-for="n in 3" :key="n" class="h-16 rounded-xl" />
    </div>

    <!-- 2. Not a member / no such workspace (the server answers 404 for both) -->
    <div
      v-else-if="isNotFound"
      class="flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center"
    >
      <p class="text-lg font-semibold">Workspace not found</p>
      <p class="mt-1 max-w-sm text-sm text-muted-foreground">
        It may have been deleted, or you are no longer a member.
      </p>
      <Button as-child variant="outline" class="mt-6">
        <RouterLink :to="{ name: 'dashboard' }">Back to workspaces</RouterLink>
      </Button>
    </div>

    <!-- 3. Other errors -->
    <div
      v-else-if="isError"
      role="alert"
      class="flex flex-col items-center rounded-xl border border-destructive/40 bg-destructive/5 px-6 py-12 text-center"
    >
      <AlertCircle class="size-8 text-destructive" />
      <p class="mt-3 font-medium">Couldn't load the members</p>
      <p class="mt-1 text-sm text-muted-foreground">{{ error?.message }}</p>
      <Button variant="outline" class="mt-4" :disabled="isFetching" @click="refetch()">
        {{ isFetching ? "Retrying..." : "Try again" }}
      </Button>
    </div>

    <!-- 4. Data -->
    <template v-else-if="members">
      <form v-if="isAdmin" class="mb-6 rounded-xl border bg-card p-5" novalidate @submit.prevent="onInvite">
        <Label for="invite-email" class="text-base font-semibold">Invite a member</Label>
        <p class="mt-1 text-sm text-muted-foreground">
          They need a TaskPulse account. New members join with the Member role.
        </p>
        <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
          <div class="flex-1 space-y-1.5">
            <Input
              id="invite-email"
              v-model="email"
              v-bind="emailAttrs"
              type="email"
              placeholder="name@example.com"
              autocomplete="off"
              :aria-invalid="Boolean(errors.email)"
              aria-describedby="invite-email-error"
            />
            <p v-if="errors.email" id="invite-email-error" class="text-sm text-destructive">{{ errors.email }}</p>
          </div>
          <Button type="submit" :disabled="isSubmitting" class="shrink-0">
            <UserPlus />
            {{ isSubmitting ? "Inviting..." : "Invite" }}
          </Button>
        </div>
      </form>

      <ul class="divide-y rounded-xl border bg-card">
        <li v-for="member in members" :key="member.userId" class="flex items-center gap-3 px-4 py-3 sm:px-5">
          <Avatar class="size-10 shrink-0">
            <AvatarImage v-if="member.user.avatarUrl" :src="member.user.avatarUrl" :alt="displayName(member)" />
            <AvatarFallback class="bg-indigo-100 text-sm font-medium text-indigo-700">
              {{ initials(member) }}
            </AvatarFallback>
          </Avatar>

          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-2 truncate text-sm font-medium">
              <span class="truncate">{{ displayName(member) }}</span>
              <span v-if="member.userId === currentUserId" class="text-xs font-normal text-muted-foreground">(you)</span>
            </p>
            <p class="truncate text-sm text-muted-foreground">{{ member.user.email }}</p>
          </div>

          <!-- Admins get a role picker; everyone else sees a read-only badge -->
          <DropdownMenu v-if="isAdmin">
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                :disabled="isUpdatingRole"
                :aria-label="`Change role for ${displayName(member)}`"
              >
                {{ roleLabel[member.role] }}
                <ChevronDown class="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-56">
              <DropdownMenuRadioGroup
                :model-value="member.role"
                @update:model-value="changeRole(member, $event as WorkspaceRole)"
              >
                <DropdownMenuRadioItem value="ADMIN" class="cursor-pointer">
                  <span>
                    <span class="block font-medium">Admin</span>
                    <span class="block text-xs text-muted-foreground">Manages members and settings</span>
                  </span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="MEMBER" class="cursor-pointer" :disabled="isLastAdmin(member)">
                  <span>
                    <span class="block font-medium">Member</span>
                    <span class="block text-xs text-muted-foreground">
                      {{ isLastAdmin(member) ? "Make someone else an admin first" : "Works on boards" }}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Badge
            v-else
            :class="member.role === 'ADMIN' ? 'border-transparent bg-indigo-50 text-indigo-600' : ''"
            :variant="member.role === 'ADMIN' ? 'default' : 'secondary'"
          >
            {{ roleLabel[member.role] }}
          </Badge>

          <Button
            v-if="isAdmin"
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground hover:text-destructive"
            :disabled="isLastAdmin(member)"
            :title="isLastAdmin(member) ? 'The last admin cannot be removed' : undefined"
            :aria-label="member.userId === currentUserId ? 'Leave workspace' : `Remove ${displayName(member)}`"
            @click="memberToRemove = member"
          >
            <Trash2 />
          </Button>
        </li>
      </ul>
    </template>

    <Dialog v-model:open="confirmOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ removingSelf ? "Leave this workspace?" : "Remove member?" }}</DialogTitle>
          <DialogDescription>
            <template v-if="removingSelf">
              You will lose access to {{ workspace?.name ?? "this workspace" }} and its boards. An admin can add you
              back later.
            </template>
            <template v-else-if="memberToRemove">
              {{ displayName(memberToRemove) }} will lose access to {{ workspace?.name ?? "this workspace" }} and its
              boards. You can add them back later.
            </template>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="pt-2">
          <Button type="button" variant="outline" @click="confirmOpen = false">Cancel</Button>
          <Button type="button" variant="destructive" :disabled="isRemoving" @click="confirmRemove">
            {{ isRemoving ? "Removing..." : removingSelf ? "Leave workspace" : "Remove" }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
