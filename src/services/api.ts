import type {
  Child,
  ChildShareToken,
  ChildWithParents,
  Class,
  ClassWithTimeSlot,
  PendingApproval,
  ScheduleSelectionWithClass,
  TimeSlot,
  User,
  UserRole,
  UserRoleData,
} from "../types";
import { NotificationService } from "./notificationService";
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
    if (data.user) {
      const { error: profileError } = await supabase.from("users").insert([
        {
          id: data.user.id,
          email: data.user.email,
        },
      ]);

      if (profileError) {
        console.error("❌ Profile creation failed:", profileError);
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
        console.error("❌ Role creation failed:", roleError);
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
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user || null);
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
      ).catch(err => console.warn("Notification logging failed:", err));
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

// Classes API
export const classesApi = {
  async getClasses(): Promise<ClassWithTimeSlot[]> {
    const isProduction = process.env.NODE_ENV === "production";
    let query = supabase.from("classes").select(
      `
        *,
        time_slot:time_slots(*)
      `
    );

    // Filter out test classes in production
    if (isProduction) {
      query = query.neq("scope", "test");
    }

    const { data, error } = await query.order("title", { ascending: true });

    if (error) throw new ApiError(error.message);
    return data.map(cls => ({
      id: cls.id,
      title: cls.title,
      description: cls.description,
      teacher: cls.teacher,
      dayOfWeek: cls.day_of_week,
      timeSlotId: cls.time_slot_id,
      grades: (cls.grades || []).map((grade: string | number) =>
        typeof grade === "string" ? parseInt(grade, 10) : grade
      ),
      isMandatory: cls.is_mandatory,
      isDouble: cls.is_double,
      room: cls.room,
      scope: cls.scope,
      createdAt: cls.created_at,
      updatedAt: cls.updated_at,
      timeSlot: {
        id: cls.time_slot.id,
        name: cls.time_slot.name,
        startTime: cls.time_slot.start_time,
        endTime: cls.time_slot.end_time,
        createdAt: cls.time_slot.created_at,
        updatedAt: cls.time_slot.updated_at,
      },
    }));
  },

  async createClass(classData: Omit<Class, "id" | "createdAt" | "updatedAt">) {
    const { data, error } = await supabase
      .from("classes")
      .insert([
        {
          title: classData.title,
          description: classData.description,
          teacher: classData.teacher,
          day_of_week: classData.dayOfWeek,
          time_slot_id: classData.timeSlotId,
          grades: classData.grades,
          is_mandatory: classData.isMandatory,
          is_double: classData.isDouble,
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
    if (updates.dayOfWeek !== undefined)
      updateData.day_of_week = updates.dayOfWeek;
    if (updates.timeSlotId !== undefined)
      updateData.time_slot_id = updates.timeSlotId;
    if (updates.grades !== undefined) updateData.grades = updates.grades;
    if (updates.isMandatory !== undefined)
      updateData.is_mandatory = updates.isMandatory;
    if (updates.isDouble !== undefined) updateData.is_double = updates.isDouble;
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
    let query = supabase
      .from("schedule_selections")
      .select(
        `
        *,
        class:classes(
          *,
          time_slot:time_slots(*)
        )
      `
      )
      .eq("user_id", userId);

    const { data, error } = await query;

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
      class: {
        id: selection.class.id,
        title: selection.class.title,
        description: selection.class.description,
        teacher: selection.class.teacher,
        dayOfWeek: selection.class.day_of_week,
        timeSlotId: selection.class.time_slot_id,
        grades: (selection.class.grades || []).map((grade: string | number) =>
          typeof grade === "string" ? parseInt(grade, 10) : grade
        ),
        isMandatory: selection.class.is_mandatory,
        isDouble: selection.class.is_double,
        room: selection.class.room,
        scope: selection.class.scope,
        createdAt: selection.class.created_at,
        updatedAt: selection.class.updated_at,
        timeSlot: {
          id: selection.class.time_slot.id,
          name: selection.class.time_slot.name,
          startTime: selection.class.time_slot.start_time,
          endTime: selection.class.time_slot.end_time,
          createdAt: selection.class.time_slot.created_at,
          updatedAt: selection.class.time_slot.updated_at,
        },
      },
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
    let query = supabase
      .from("schedule_selections")
      .select(
        `
        *,
        class:classes(
          *,
          time_slot:time_slots(*)
        )
      `
      )
      .eq("child_id", childId);

    const { data, error } = await query;

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
      class: {
        id: selection.class.id,
        title: selection.class.title,
        description: selection.class.description,
        teacher: selection.class.teacher,
        dayOfWeek: selection.class.day_of_week,
        timeSlotId: selection.class.time_slot_id,
        grades: (selection.class.grades || []).map((grade: string | number) =>
          typeof grade === "string" ? parseInt(grade, 10) : grade
        ),
        isMandatory: selection.class.is_mandatory,
        isDouble: selection.class.is_double,
        room: selection.class.room,
        scope: selection.class.scope,
        createdAt: selection.class.created_at,
        updatedAt: selection.class.updated_at,
        timeSlot: {
          id: selection.class.time_slot.id,
          name: selection.class.time_slot.name,
          startTime: selection.class.time_slot.start_time,
          endTime: selection.class.time_slot.end_time,
          createdAt: selection.class.time_slot.created_at,
          updatedAt: selection.class.time_slot.updated_at,
        },
      },
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
    const { data, error } = await supabase
      .from("parent_child_relationships")
      .select(
        `
        child:children(*)
      `
      )
      .eq("parent_id", parentId);

    if (error) throw new ApiError(error.message);

    return data.map((rel: any) => ({
      id: rel.child.id,
      firstName: rel.child.first_name,
      lastName: rel.child.last_name,
      grade: rel.child.grade,
      groupNumber: rel.child.group_number,
      createdAt: rel.child.created_at,
      updatedAt: rel.child.updated_at,
    }));
  },

  async createChild(
    firstName: string,
    lastName: string,
    grade: number,
    groupNumber: number = 1
  ): Promise<Child> {
    const { data, error } = await supabase.rpc(
      "create_child_with_relationship",
      {
        p_first_name: firstName,
        p_last_name: lastName,
        p_grade: grade,
        p_group_number: groupNumber,
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
      groupNumber?: number;
    }
  ): Promise<Child> {
    const updateData: any = {};
    if (updates.firstName !== undefined)
      updateData.first_name = updates.firstName;
    if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
    if (updates.grade !== undefined) updateData.grade = updates.grade;
    if (updates.groupNumber !== undefined)
      updateData.group_number = updates.groupNumber;

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
