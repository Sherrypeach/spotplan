
/*
 * -------------------------------------------------------
 * THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
 * -------------------------------------------------------
 */

/* tslint:disable */
/* eslint-disable */

export enum OrderDir {
    ASC = "ASC",
    DESC = "DESC"
}

export class PaginationInput {
    limit?: Nullable<number>;
    skip?: Nullable<number>;
    orderBy?: Nullable<string>;
    orderDir?: Nullable<OrderDir>;
}

export class LoginInput {
    email: string;
    password: string;
}

export class CreateClassroomInput {
    name: string;
    document?: Nullable<JSON>;
}

export class SaveClassroomInput {
    name?: Nullable<string>;
    document: JSON;
    revision: number;
}

export class FilterUsersInput {
    search?: Nullable<string>;
    isActive?: Nullable<boolean>;
    roleId?: Nullable<number>;
}

export class CreateUserInput {
    email: string;
    password: string;
    firstName?: Nullable<string>;
    lastName?: Nullable<string>;
    roleId?: Nullable<number>;
}

export class UpdateUserInput {
    firstName?: Nullable<string>;
    lastName?: Nullable<string>;
    isActive?: Nullable<boolean>;
    roleId?: Nullable<number>;
}

export interface Entity {
    id: number;
    createdAt: Date;
    updatedAt: Date;
}

export class OkResult {
    ok: boolean;
}

export class ResetToken {
    resetToken: string;
}

export abstract class IQuery {
    abstract me(): User | Promise<User>;

    abstract myClassrooms(): ClassroomSummary[] | Promise<ClassroomSummary[]>;

    abstract classroom(id: number): Classroom | Promise<Classroom>;

    abstract roles(): Role[] | Promise<Role[]>;

    abstract users(pagination?: Nullable<PaginationInput>, filters?: Nullable<FilterUsersInput>): UserPage | Promise<UserPage>;

    abstract user(id: number): Nullable<User> | Promise<Nullable<User>>;
}

export abstract class IMutation {
    abstract login(loginInput: LoginInput): User | Promise<User>;

    abstract logout(): OkResult | Promise<OkResult>;

    abstract forgotPassword(email: string): OkResult | Promise<OkResult>;

    abstract validateOtp(email: string, otp: string): ResetToken | Promise<ResetToken>;

    abstract resetPassword(resetToken: string, password: string): OkResult | Promise<OkResult>;

    abstract createClassroom(createClassroomInput: CreateClassroomInput): Classroom | Promise<Classroom>;

    abstract saveClassroom(id: number, saveClassroomInput: SaveClassroomInput): Classroom | Promise<Classroom>;

    abstract removeClassroom(id: number): OkResult | Promise<OkResult>;

    abstract createUser(createUserInput: CreateUserInput): User | Promise<User>;

    abstract updateUser(id: number, updateUserInput: UpdateUserInput): User | Promise<User>;

    abstract removeUser(id: number): OkResult | Promise<OkResult>;
}

export class ClassroomSummary implements Entity {
    id: number;
    name: string;
    studentCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export class Classroom implements Entity {
    id: number;
    name: string;
    revision: number;
    document: JSON;
    createdAt: Date;
    updatedAt: Date;
}

export class Role implements Entity {
    id: number;
    name: string;
    permissions: Permission[];
    createdAt: Date;
    updatedAt: Date;
}

export class Permission implements Entity {
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}

export class User implements Entity {
    id: number;
    email: string;
    firstName?: Nullable<string>;
    lastName?: Nullable<string>;
    isActive: boolean;
    role: Role;
    createdAt: Date;
    updatedAt: Date;
}

export class UserPage {
    items: User[];
    total: number;
    limit: number;
    skip: number;
}

export type JSON = unknown;
type Nullable<T> = T | null;
