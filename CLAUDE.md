# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a school schedule management application for elementary school (grades 1-6) built for Hebrew users with RTL (right-to-left) display. The application allows students to view and select classes from a weekly schedule displayed in table format.

## Tech Stack

- **Frontend**: React + TypeScript with Vite for packaging
- **UI Components**: Ant Design (antd)
- **Database**: Supabase for data storage and authentication
- **Development Tools**: Storybook for component development
- **Testing**: Unit tests for business logic

## Architecture Principles

- Use React hooks for state management and side effects
- Implement API layer for Supabase backend communication
- Use context providers for global state and authentication management
- Separate concerns: components, hooks, utilities, and dedicated service layer
- Keep business logic in service layer (not components) for future backend migration
- RTL layout support for Hebrew interface

## User Roles & Authentication

- **Authentication**: Supabase built-in auth with email/password and OAuth (Google, GitHub)
- **Approval System**: New signups require admin approval before login
- **Multi-role Users**: Same user can act as parent, teacher, or admin with role switching

### Role Permissions
- **Admin**: Edit time slots, manage classes, approve signups, modify user roles
- **Parent**: View/modify child's schedule
- **Child**: View own schedule
- **Staff**: View/modify classes and schedules

## Key Features

- Weekly schedule table (Sunday-Thursday learning days)
- Class selection with conflict detection via drawer interface
- Class management (create, edit, delete)
- Pending approval management for new users
- Time slot customization (admin only)

## Schedule Structure

- **Days**: Sunday to Thursday (Friday-Saturday are weekends)
- **Display**: Table format with days as columns, time slots as rows
- **Classes**: Each has title, description, teacher, time slot, grade, and unique ID
- **Interaction**: Click class to open drawer with same time slot options

## Development Notes

- Schedule interface is in Hebrew with RTL display
- Pre-defined time slots customizable by admin
- Drawer opens from left side for class details
- Extensive documentation required for usage and local development