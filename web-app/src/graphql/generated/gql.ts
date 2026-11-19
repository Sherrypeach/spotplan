/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  mutation Login($input: LoginInput!) {\n    login(loginInput: $input) {\n      id\n      email\n      firstName\n      lastName\n    }\n  }\n": typeof types.LoginDocument,
    "\n  mutation Logout {\n    logout {\n      ok\n    }\n  }\n": typeof types.LogoutDocument,
    "\n  mutation ForgotPassword($email: String!) {\n    forgotPassword(email: $email) {\n      ok\n    }\n  }\n": typeof types.ForgotPasswordDocument,
    "\n  mutation ValidateOtp($email: String!, $otp: String!) {\n    validateOtp(email: $email, otp: $otp) {\n      resetToken\n    }\n  }\n": typeof types.ValidateOtpDocument,
    "\n  mutation ResetPassword($resetToken: String!, $password: String!) {\n    resetPassword(resetToken: $resetToken, password: $password) {\n      ok\n    }\n  }\n": typeof types.ResetPasswordDocument,
    "\n  query Me {\n    me {\n      id\n      email\n      firstName\n      lastName\n    }\n  }\n": typeof types.MeDocument,
    "\n  query MyClassrooms {\n    myClassrooms {\n      id\n      name\n      studentCount\n    }\n  }\n": typeof types.MyClassroomsDocument,
    "\n  query ClassroomById($id: Int!) {\n    classroom(id: $id) {\n      id\n      name\n      revision\n      document\n    }\n  }\n": typeof types.ClassroomByIdDocument,
    "\n  mutation CreateClassroom($input: CreateClassroomInput!) {\n    createClassroom(createClassroomInput: $input) {\n      id\n      name\n      revision\n      document\n    }\n  }\n": typeof types.CreateClassroomDocument,
    "\n  mutation SaveClassroom($id: Int!, $input: SaveClassroomInput!) {\n    saveClassroom(id: $id, saveClassroomInput: $input) {\n      id\n      revision\n    }\n  }\n": typeof types.SaveClassroomDocument,
};
const documents: Documents = {
    "\n  mutation Login($input: LoginInput!) {\n    login(loginInput: $input) {\n      id\n      email\n      firstName\n      lastName\n    }\n  }\n": types.LoginDocument,
    "\n  mutation Logout {\n    logout {\n      ok\n    }\n  }\n": types.LogoutDocument,
    "\n  mutation ForgotPassword($email: String!) {\n    forgotPassword(email: $email) {\n      ok\n    }\n  }\n": types.ForgotPasswordDocument,
    "\n  mutation ValidateOtp($email: String!, $otp: String!) {\n    validateOtp(email: $email, otp: $otp) {\n      resetToken\n    }\n  }\n": types.ValidateOtpDocument,
    "\n  mutation ResetPassword($resetToken: String!, $password: String!) {\n    resetPassword(resetToken: $resetToken, password: $password) {\n      ok\n    }\n  }\n": types.ResetPasswordDocument,
    "\n  query Me {\n    me {\n      id\n      email\n      firstName\n      lastName\n    }\n  }\n": types.MeDocument,
    "\n  query MyClassrooms {\n    myClassrooms {\n      id\n      name\n      studentCount\n    }\n  }\n": types.MyClassroomsDocument,
    "\n  query ClassroomById($id: Int!) {\n    classroom(id: $id) {\n      id\n      name\n      revision\n      document\n    }\n  }\n": types.ClassroomByIdDocument,
    "\n  mutation CreateClassroom($input: CreateClassroomInput!) {\n    createClassroom(createClassroomInput: $input) {\n      id\n      name\n      revision\n      document\n    }\n  }\n": types.CreateClassroomDocument,
    "\n  mutation SaveClassroom($id: Int!, $input: SaveClassroomInput!) {\n    saveClassroom(id: $id, saveClassroomInput: $input) {\n      id\n      revision\n    }\n  }\n": types.SaveClassroomDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Login($input: LoginInput!) {\n    login(loginInput: $input) {\n      id\n      email\n      firstName\n      lastName\n    }\n  }\n"): (typeof documents)["\n  mutation Login($input: LoginInput!) {\n    login(loginInput: $input) {\n      id\n      email\n      firstName\n      lastName\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Logout {\n    logout {\n      ok\n    }\n  }\n"): (typeof documents)["\n  mutation Logout {\n    logout {\n      ok\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ForgotPassword($email: String!) {\n    forgotPassword(email: $email) {\n      ok\n    }\n  }\n"): (typeof documents)["\n  mutation ForgotPassword($email: String!) {\n    forgotPassword(email: $email) {\n      ok\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ValidateOtp($email: String!, $otp: String!) {\n    validateOtp(email: $email, otp: $otp) {\n      resetToken\n    }\n  }\n"): (typeof documents)["\n  mutation ValidateOtp($email: String!, $otp: String!) {\n    validateOtp(email: $email, otp: $otp) {\n      resetToken\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ResetPassword($resetToken: String!, $password: String!) {\n    resetPassword(resetToken: $resetToken, password: $password) {\n      ok\n    }\n  }\n"): (typeof documents)["\n  mutation ResetPassword($resetToken: String!, $password: String!) {\n    resetPassword(resetToken: $resetToken, password: $password) {\n      ok\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Me {\n    me {\n      id\n      email\n      firstName\n      lastName\n    }\n  }\n"): (typeof documents)["\n  query Me {\n    me {\n      id\n      email\n      firstName\n      lastName\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MyClassrooms {\n    myClassrooms {\n      id\n      name\n      studentCount\n    }\n  }\n"): (typeof documents)["\n  query MyClassrooms {\n    myClassrooms {\n      id\n      name\n      studentCount\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ClassroomById($id: Int!) {\n    classroom(id: $id) {\n      id\n      name\n      revision\n      document\n    }\n  }\n"): (typeof documents)["\n  query ClassroomById($id: Int!) {\n    classroom(id: $id) {\n      id\n      name\n      revision\n      document\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateClassroom($input: CreateClassroomInput!) {\n    createClassroom(createClassroomInput: $input) {\n      id\n      name\n      revision\n      document\n    }\n  }\n"): (typeof documents)["\n  mutation CreateClassroom($input: CreateClassroomInput!) {\n    createClassroom(createClassroomInput: $input) {\n      id\n      name\n      revision\n      document\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SaveClassroom($id: Int!, $input: SaveClassroomInput!) {\n    saveClassroom(id: $id, saveClassroomInput: $input) {\n      id\n      revision\n    }\n  }\n"): (typeof documents)["\n  mutation SaveClassroom($id: Int!, $input: SaveClassroomInput!) {\n    saveClassroom(id: $id, saveClassroomInput: $input) {\n      id\n      revision\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;