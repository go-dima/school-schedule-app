import type {
  Child,
  ChildShareToken,
  ChildWithParents,
  Class,
  ClassSlot,
  ClassWithTimeSlot,
  PendingApproval,
  ScheduleSelectionWithClass,
  Scope,
  TimeSlot,
  User,
  UserRole,
  UserRoleData,
} from "../types";
import log from "../utils/logger";
import { NotificationService } from "./notificationService";
import { ScheduleService } from "./scheduleService";
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Authentication API
export const authApi = {
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new ApiError(error.message);
    }

    // If user was created successfully, create their profile in public.users
    if (data.user && data.session) {
      const { error: profileError } = await supabase.from("users").insert([
        {
          id: data.user.id,
          email: data.user.email,
        },
      ]);

      if (profileError) {
        log.error("Profile creation failed", { error: profileError });
        throw new ApiError(
          "Failed to create user profile: " + profileError.message
        );
      }

      // Automatically create parent role for new users
      const { error: roleError } = await supabase.from("user_roles").insert([
        {
          user_id: data.user.id,
          role: "parent",
          approved: false, // Requires admin approval
        },
      ]);

      if (roleError) {
        log.error("Role creation failed", { error: roleError });
        throw new ApiError("Failed to create user role: " + roleError.message);
      }
    }

    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new ApiError(error.message);
    return data;
  },

  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) throw new ApiError(error.message);
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new ApiError(error.message);
  },

  async getCurrentUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw new ApiError(error.message);
    return user;
  },

  onAuthStateChange(callback: (user: any) => void) {
    return supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user || null;

      // If user signed in with OAuth and doesn't exist in our users table, create profile
      if (user && session && _event === "SIGNED_IN") {
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("id", user.id)
          .single();

        if (!existingUser) {
          // Create user profile
          const { error: profileError } = await supabase.from("users").insert([
            {
              id: user.id,
              email: user.email,
              first_name: user.user_metadata?.full_name?.split(" ")[0] || "",
              last_name:
                user.user_metadata?.full_name?.split(" ").slice(1).join(" ") ||
                "",
            },
          ]);

          if (profileError) {
            log.error("OAuth profile creation failed", { error: profileError });
          }

          // Create parent role for OAuth users
          const { error: roleError } = await supabase
            .from("user_roles")
            .insert([
              {
                user_id: user.id,
                role: "parent",
                approved: false, // Requires admin approval
              },
            ]);

          if (roleError) {
            log.error("OAuth role creation failed", { error: roleError });
          }
        }
      }

      callback(user);
    });
  },
};

// Users API
export const usersApi = {
  async getUserProfile(userId: string): Promise<User> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) throw new ApiError(error.message);
    return {
      id: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async updateUserProfile(
    userId: string,
    updates: { firstName?: string; lastName?: string }
  ) {
    const updateData: any = {};
    if (updates.firstName !== undefined)
      updateData.first_name = updates.firstName;
    if (updates.lastName !== undefined) updateData.last_name = updates.lastName;

    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId)
      .select();

    if (error) throw new ApiError(error.message);
    return data[0];
  },

  async getUserRoles(userId: string): Promise<UserRoleData[]> {
    const { data, error } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", userId);

    if (error) throw new ApiError(error.message);
    return data.map(role => ({
      id: role.id,
      userId: role.user_id,
      role: role.role as UserRole,
      approved: role.approved,
      createdAt: role.created_at,
      updatedAt: role.updated_at,
    }));
  },

  async requestRole(userId: string, role: UserRole) {
    // First check if user already has this role
    const { data: existingRoles } = await supabase
      .from("user_roles")
      .select("id, approved")
      .eq("user_id", userId)
      .eq("role", role);

    if (existingRoles && existingRoles.length > 0) {
      // Role already exists, return the existing role
      return existingRoles[0];
    }

    const { data, error } = await supabase
      .from("user_roles")
      .insert([
        {
          user_id: userId,
          role: role,
          approved: false,
        },
      ])
      .select();

    if (error) throw new ApiError(error.message);

    // Get user email for notification
    const { data: userData } = await supabase
      .from("users")
      .select("email")
      .eq("id", userId)
      .single();

    // Send in-app notification to admins (non-blocking)
    if (userData?.email) {
      NotificationService.notifyAdminsOfPendingApproval(
        userData.email,
        role
      ).catch(err => log.warn("Notification logging failed", { error: err }));
    }

    return data[0];
  },

  async approveRole(roleId: string) {
    const { data, error } = await supabase
      .from("user_roles")
      .update({ approved: true })
      .eq("id", roleId)
      .select();

    if (error) throw new ApiError(error.message);
    return data[0];
  },

  async approveUserWithRole(userId: string, assignedRole: UserRole) {
    // First, delete any existing unapproved roles for this user
    const { error: deleteError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("approved", false);

    if (deleteError) throw new ApiError(deleteError.message);

    // Create and approve the new role in one step
    const { data, error } = await supabase
      .from("user_roles")
      .insert([
        {
          user_id: userId,
          role: assignedRole,
          approved: true,
        },
      ])
      .select();

    if (error) throw new ApiError(error.message);
    return data[0];
  },

  async getPendingApprovals(): Promise<UserRoleData[]> {
    const { data, error } = await supabase
      .from("user_roles")
      .select("*")
      .eq("approved", false);

    if (error) throw new ApiError(error.message);
    return data.map(role => ({
      id: role.id,
      userId: role.user_id,
      role: role.role as UserRole,
      approved: role.approved,
      createdAt: role.created_at,
      updatedAt: role.updated_at,
    }));
  },

  async getPendingApprovalsWithUsers(): Promise<PendingApproval[]> {
    // First get pending user roles
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("*")
      .eq("approved", false)
      .order("created_at", { ascending: false });

    if (rolesError) throw new ApiError(rolesError.message);
    if (!userRoles || userRoles.length === 0) return [];

    // Get user IDs to fetch user details
    const userIds = userRoles.map(role => role.user_id);

    // Get user details
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("*")
      .in("id", userIds);

    if (usersError) throw new ApiError(usersError.message);

    // Combine the data
    return userRoles.map(role => {
      const user = users?.find(u => u.id === role.user_id);
      if (!user) {
        throw new ApiError(`User not found for role ${role.id}`);
      }

      return {
        id: role.id,
        userId: role.user_id,
        role: role.role as UserRole,
        approved: role.approved,
        createdAt: role.created_at,
        updatedAt: role.updated_at,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
      };
    });
  },

  async rejectRole(roleId: string) {
    const { data, error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", roleId)
      .select();

    if (error) throw new ApiError(error.message);
    return data[0];
  },

  async getAllUsersWithRoles(): Promise<any[]> {
    const { data, error } = await supabase
      .from("users")
      .select(
        `
        *,
        user_roles (
          id,
          role,
          approved,
          created_at,
          updated_at
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw new ApiError(error.message);
    return data || [];
  },
};

// Time Slots API
export const timeSlotsApi = {
  async getTimeSlots(): Promise<TimeSlot[]> {
    const { data, error } = await supabase
      .from("time_slots")
      .select("*")
      .order("start_time", { ascending: true });

    if (error) throw new ApiError(error.message);
    return data.map(slot => ({
      id: slot.id,
      name: slot.name,
      startTime: slot.start_time,
      endTime: slot.end_time,
      createdAt: slot.created_at,
      updatedAt: slot.updated_at,
    }));
  },

  async createTimeSlot(
    timeSlot: Omit<TimeSlot, "id" | "createdAt" | "updatedAt">
  ) {
    const { data, error } = await supabase
      .from("time_slots")
      .insert([
        {
          name: timeSlot.name,
          start_time: timeSlot.startTime,
          end_time: timeSlot.endTime,
        },
      ])
      .select();

    if (error) throw new ApiError(error.message);
    return data[0];
  },

  async updateTimeSlot(
    id: string,
    updates: Partial<Omit<TimeSlot, "id" | "createdAt" | "updatedAt">>
  ) {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.startTime !== undefined)
      updateData.start_time = updates.startTime;
    if (updates.endTime !== undefined) updateData.end_time = updates.endTime;

    const { data, error } = await supabase
      .from("time_slots")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) throw new ApiError(error.message);
    return data[0];
  },

  async deleteTimeSlot(id: string) {
    const { error } = await supabase.from("time_slots").delete().eq("id", id);

    if (error) throw new ApiError(error.message);
  },
};

// Shared helpers for hydrating a class row's `slots` (raw {dayOfWeek, timeSlotId}[])
// into full ClassSlotWithTimeSlot[], since slots is a JSONB column with no
// automatic PostgREST join into time_slots.
async function fetchTimeSlotsById(): Promise<Map<string, TimeSlot>> {
  const timeSlots = await timeSlotsApi.getTimeSlots();
  return new Map(timeSlots.map(slot => [slot.id, slot]));
}

function mapClassRow(
  row: any,
  timeSlotsById: Map<string, TimeSlot>
): ClassWithTimeSlot {
  const slots: ClassSlot[] = row.slots || [];
  // A slot's timeSlotId can go stale if its time slot was deleted after this
  // class was saved (slots has no DB-level FK, unlike the old timeSlotId
  // column). Drop orphaned slots rather than crash every consumer that reads
  // `.timeSlot`.
  const hydratedSlots = slots.flatMap(s => {
    const timeSlot = timeSlotsById.get(s.timeSlotId);
    if (!timeSlot) {
      log.warn(`Class "${row.title}" (${row.id}) has an orphaned slot`, {
        timeSlotId: s.timeSlotId,
      });
      return [];
    }
    return [{ dayOfWeek: s.dayOfWeek, timeSlotId: s.timeSlotId, timeSlot }];
  });

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    teacher: row.teacher,
    slots: hydratedSlots.sort(
      (a, b) =>
        a.dayOfWeek - b.dayOfWeek ||
        a.timeSlot.startTime.localeCompare(b.timeSlot.startTime)
    ),
    grades: (row.grades || []).map((grade: string | number) =>
      typeof grade === "string" ? parseInt(grade, 10) : grade
    ),
    isMandatory: row.is_mandatory,
    isDouble: row.is_double,
    groupNumber: row.group_number,
    trackNumber: row.track_number,
    room: row.room,
    scope: row.scope,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Classes API
export const classesApi = {
  async getClasses(): Promise<ClassWithTimeSlot[]> {
    const isProduction = process.env.NODE_ENV === "production";
    let query = supabase.from("classes").select("*");

    // Filter out test classes in production
    if (isProduction) {
      query = query.neq("scope", "test");
    }

    const [{ data, error }, timeSlotsById] = await Promise.all([
      query.order("title", { ascending: true }),
      fetchTimeSlotsById(),
    ]);

    if (error) throw new ApiError(error.message);
    return data.map(cls => mapClassRow(cls, timeSlotsById));
  },

  async createClass(classData: Omit<Class, "id" | "createdAt" | "updatedAt">) {
    const { data, error } = await supabase
      .from("classes")
      .insert([
        {
          title: classData.title,
          description: classData.description,
          teacher: classData.teacher,
          slots: ScheduleService.toRawSlots(classData.slots),
          grades: classData.grades,
          is_mandatory: classData.isMandatory,
          is_double: classData.isDouble,
          group_number: classData.groupNumber,
          track_number: classData.trackNumber,
          room: classData.room,
          scope: classData.scope,
        },
      ])
      .select();

    if (error) throw new ApiError(error.message);
    return data[0];
  },

  async updateClass(
    id: string,
    updates: Partial<Omit<Class, "id" | "createdAt" | "updatedAt">>
  ) {
    const updateData: any = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.teacher !== undefined) updateData.teacher = updates.teacher;
    if (updates.slots !== undefined)
      updateData.slots = ScheduleService.toRawSlots(updates.slots);
    if (updates.grades !== undefined) updateData.grades = updates.grades;
    if (updates.isMandatory !== undefined)
      updateData.is_mandatory = updates.isMandatory;
    if (updates.isDouble !== undefined) updateData.is_double = updates.isDouble;
    if (updates.groupNumber !== undefined)
      updateData.group_number = updates.groupNumber;
    if (updates.trackNumber !== undefined)
      updateData.track_number = updates.trackNumber;
    if (updates.room !== undefined) updateData.room = updates.room;
    if (updates.scope !== undefined) updateData.scope = updates.scope;

    const { data, error } = await supabase
      .from("classes")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) throw new ApiError(error.message);
    return data[0];
  },

  async deleteClass(id: string) {
    const { error } = await supabase.from("classes").delete().eq("id", id);

    if (error) throw new ApiError(error.message);
  },
};

// Schedule Selections API
export const scheduleApi = {
  async getUserSchedule(userId: string): Promise<ScheduleSelectionWithClass[]> {
    const isProduction = process.env.NODE_ENV === "production";
    const [{ data, error }, timeSlotsById] = await Promise.all([
      supabase
        .from("schedule_selections")
        .select(
          `
        *,
        class:classes(*)
      `
        )
        .eq("user_id", userId),
      fetchTimeSlotsById(),
    ]);

    if (error) throw new ApiError(error.message);

    // Filter out schedule selections with test classes in production
    let filteredData = data;
    if (isProduction) {
      filteredData = data.filter(selection => selection.class.scope !== "test");
    }
    return filteredData.map(selection => ({
      id: selection.id,
      userId: selection.user_id,
      classId: selection.class_id,
      createdAt: selection.created_at,
      updatedAt: selection.updated_at,
      class: mapClassRow(selection.class, timeSlotsById),
    }));
  },

  async selectClass(userId: string, classId: string) {
    const { data, error } = await supabase
      .from("schedule_selections")
      .insert([
        {
          user_id: userId,
          class_id: classId,
        },
      ])
      .select();

    if (error) throw new ApiError(error.message);
    return data[0];
  },

  async unselectClass(userId: string, classId: string) {
    const { error } = await supabase
      .from("schedule_selections")
      .delete()
      .eq("user_id", userId)
      .eq("class_id", classId);

    if (error) throw new ApiError(error.message);
  },

  async getChildSchedule(
    childId: string
  ): Promise<ScheduleSelectionWithClass[]> {
    const isProduction = process.env.NODE_ENV === "production";
    const [{ data, error }, timeSlotsById] = await Promise.all([
      supabase
        .from("schedule_selections")
        .select(
          `
        *,
        class:classes(*)
      `
        )
        .eq("child_id", childId),
      fetchTimeSlotsById(),
    ]);

    if (error) throw new ApiError(error.message);

    let filteredData = data;
    if (isProduction) {
      filteredData = data.filter(selection => selection.class.scope !== "test");
    }
    return filteredData.map(selection => ({
      id: selection.id,
      userId: selection.user_id,
      classId: selection.class_id,
      createdAt: selection.created_at,
      updatedAt: selection.updated_at,
      class: mapClassRow(selection.class, timeSlotsById),
    }));
  },

  async selectClassForChild(childId: string, classId: string) {
    // Get current user ID (parent making the selection)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError("User not authenticated");

    const { data, error } = await supabase
      .from("schedule_selections")
      .insert([
        {
          user_id: user.id,
          child_id: childId,
          class_id: classId,
        },
      ])
      .select();

    if (error) throw new ApiError(error.message);
    return data[0];
  },

  async unselectClassForChild(childId: string, classId: string) {
    const { error } = await supabase
      .from("schedule_selections")
      .delete()
      .eq("child_id", childId)
      .eq("class_id", classId);

    if (error) throw new ApiError(error.message);
  },
};

// Children API
export const childrenApi = {
  async getParentChildren(parentId: string): Promise<Child[]> {
    const isProduction = process.env.NODE_ENV === "production";
    let query = supabase
      .from("parent_child_relationships")
      .select(
        `
        child:children(*)
      `
      )
      .eq("parent_id", parentId);

    const { data, error } = await query;

    if (error) throw new ApiError(error.message);

    // Filter out test children in production
    let filteredData = data;
    if (isProduction) {
      filteredData = data.filter((rel: any) => {
        const scope = rel?.child?.scope;
        return scope !== "test";
      });
    }

    return filteredData.map((rel: any) => ({
      id: rel?.child?.id,
      firstName: rel?.child?.first_name,
      lastName: rel?.child?.last_name,
      grade: rel?.child?.grade,
      groupNumber: rel?.child?.group_number,
      trackNumber: rel?.child?.track_number,
      scope: rel?.child?.scope,
      createdAt: rel?.child?.created_at,
      updatedAt: rel?.child?.updated_at,
    }));
  },

  async createChild(
    firstName: string,
    lastName: string,
    grade: number,
    groupNumber: number | null = 1,
    scope: Scope = "prod",
    trackNumber: number | null = null
  ): Promise<Child> {
    const { data, error } = await supabase.rpc(
      "create_child_with_relationship",
      {
        p_first_name: firstName,
        p_last_name: lastName,
        p_grade: grade,
        p_group_number: groupNumber,
        p_scope: scope,
        p_track_number: trackNumber,
      }
    );

    if (error) throw new ApiError(error.message);

    // The function returns the full child record, no need for additional fetch
    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      grade: data.grade,
      groupNumber: data.group_number,
      trackNumber: data.track_number,
      scope: data.scope,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async updateChild(
    childId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      grade?: number;
      groupNumber?: number | null;
      trackNumber?: number | null;
      scope?: Scope;
    }
  ): Promise<Child> {
    const updateData: any = {};
    if (updates.firstName !== undefined)
      updateData.first_name = updates.firstName;
    if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
    if (updates.grade !== undefined) updateData.grade = updates.grade;
    if (updates.groupNumber !== undefined)
      updateData.group_number = updates.groupNumber;
    if (updates.trackNumber !== undefined)
      updateData.track_number = updates.trackNumber;
    if (updates.scope !== undefined) updateData.scope = updates.scope;

    const { data, error } = await supabase
      .from("children")
      .update(updateData)
      .eq("id", childId)
      .select()
      .single();

    if (error) throw new ApiError(error.message);

    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      grade: data.grade,
      groupNumber: data.group_number,
      trackNumber: data.track_number,
      scope: data.scope,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async removeChildFromParent(
    parentId: string,
    childId: string
  ): Promise<void> {
    const { error } = await supabase
      .from("parent_child_relationships")
      .delete()
      .eq("parent_id", parentId)
      .eq("child_id", childId);

    if (error) throw new ApiError(error.message);
  },

  async deleteChild(childId: string): Promise<void> {
    const { error } = await supabase
      .from("children")
      .delete()
      .eq("id", childId);

    if (error) throw new ApiError(error.message);
  },

  async generateShareToken(
    childId: string,
    expiresInHours: number = 48
  ): Promise<string> {
    const { data, error } = await supabase.rpc("generate_child_share_token", {
      p_child_id: childId,
      p_expires_in_hours: expiresInHours,
    });

    if (error) throw new ApiError(error.message);
    return data;
  },

  async acceptSharedChild(token: string): Promise<string> {
    const { data, error } = await supabase.rpc("accept_shared_child", {
      p_token: token,
    });

    if (error) throw new ApiError(error.message);
    return data;
  },

  async getChildShareTokens(childId: string): Promise<ChildShareToken[]> {
    const { data, error } = await supabase
      .from("child_share_tokens")
      .select("*")
      .eq("child_id", childId)
      .eq("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) throw new ApiError(error.message);
    return data.map(token => ({
      id: token.id,
      childId: token.child_id,
      token: token.token,
      sharedByUserId: token.shared_by_user_id,
      expiresAt: token.expires_at,
      usedAt: token.used_at,
      usedByUserId: token.used_by_user_id,
      createdAt: token.created_at,
    }));
  },

  async getAllChildren(): Promise<(Child & { assignedParent: boolean })[]> {
    const isProduction = process.env.NODE_ENV === "production";

    // Use the database function to get children with parent status.
    const { data, error } = await supabase.rpc(
      "get_children_with_parent_status",
      {
        production_only: isProduction,
      }
    );

    if (error) throw new ApiError(error.message);

    return data.map((child: any) => {
      return {
        id: child.id,
        firstName: child.first_name,
        lastName: child.last_name,
        grade: child.grade,
        groupNumber: child.group_number,
        trackNumber: child.track_number,
        scope: child.scope || "prod", // Fallback for migration compatibility
        createdAt: child.created_at,
        updatedAt: child.updated_at,
        assignedParent: child.has_parent,
      };
    });
  },

  async getChildById(childId: string): Promise<Child> {
    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("id", childId)
      .single();

    if (error) throw new ApiError(error.message);

    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      grade: data.grade,
      groupNumber: data.group_number,
      trackNumber: data.track_number,
      scope: data.scope,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async getChildWithParents(childId: string): Promise<ChildWithParents> {
    const { data, error } = await supabase
      .from("children_with_parents")
      .select("*")
      .eq("id", childId)
      .single();

    if (error) throw new ApiError(error.message);

    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      grade: data.grade,
      groupNumber: data.group_number,
      trackNumber: data.track_number,
      scope: data.scope,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      parents: data.parents.map((parent: any) => ({
        userId: parent.user_id,
        email: parent.email,
        firstName: parent.first_name,
        lastName: parent.last_name,
        isPrimary: parent.is_primary,
      })),
    };
  },
};

// Enrollment API
export const enrollmentApi = {
  async getClassEnrollmentCounts(): Promise<Map<string, number>> {
    const isProduction = process.env.NODE_ENV === "production";
    // In production, only show prod classes. In development, show all classes (pass null for all)
    const targetScope: "prod" | null = isProduction ? "prod" : null;

    const { data, error } = await supabase.rpc("get_class_enrollment_counts", {
      target_scope: targetScope,
    });

    if (error) throw new ApiError(error.message);

    const enrollmentMap = new Map<string, number>();
    data.forEach((item: { class_id: string; enrollment_count: number }) => {
      enrollmentMap.set(item.class_id, item.enrollment_count);
    });

    return enrollmentMap;
  },

  async getClassEnrollmentCount(classId: string): Promise<number> {
    const isProduction = process.env.NODE_ENV === "production";
    // In production, only show prod classes. In development, show all classes (pass null for all)
    const targetScope: "prod" | null = isProduction ? "prod" : null;

    const { data, error } = await supabase.rpc("get_class_enrollment_count", {
      p_class_id: classId,
      target_scope: targetScope,
    });

    if (error) throw new ApiError(error.message);
    return data || 0;
  },
};
