import type {
  Class,
  ClassWithTimeSlot,
  PendingApproval,
  ScheduleSelectionWithClass,
  TimeSlot,
  User,
  UserRole,
  UserRoleData,
} from "../types";
import { supabase } from "./supabase";
import { NotificationService } from "./notificationService";

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
      try {
        const { error: profileError } = await supabase.from("users").insert([
          {
            id: data.user.id,
            email: data.user.email,
          },
        ]);

        if (profileError) {
          console.warn("⚠️ Profile creation error (non-fatal):", profileError);
        }

        // Automatically create parent role for new users
        try {
          const { error: roleError } = await supabase
            .from("user_roles")
            .insert([
              {
                user_id: data.user.id,
                role: "parent",
                approved: false, // Requires admin approval
              },
            ]);

          if (roleError) {
            console.warn("⚠️ Role creation error (non-fatal):", roleError);
          }
        } catch (roleErr) {
          console.warn("⚠️ Role creation exception (non-fatal):", roleErr);
        }
      } catch (profileErr) {
        console.warn("⚠️ Profile creation exception (non-fatal):", profileErr);
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
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
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
    const { data, error } = await supabase
      .from("user_roles")
      .select(
        `
        *,
        users:user_id (
          id,
          email,
          created_at,
          updated_at
        )
      `
      )
      .eq("approved", false)
      .order("created_at", { ascending: false });

    if (error) throw new ApiError(error.message);
    return data.map(role => ({
      id: role.id,
      userId: role.user_id,
      role: role.role as UserRole,
      approved: role.approved,
      createdAt: role.created_at,
      updatedAt: role.updated_at,
      user: {
        id: role.users.id,
        email: role.users.email,
        createdAt: role.users.created_at,
        updatedAt: role.users.updated_at,
      },
    }));
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
      grades: (cls.grades || []).map((grade: any) =>
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
        grades: (selection.class.grades || []).map((grade: any) =>
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
};
