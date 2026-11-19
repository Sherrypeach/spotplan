import { graphql } from '@graphql/generated';

// Run `npm run codegen` after editing these.

export const Login = graphql(`
  mutation Login($input: LoginInput!) {
    login(loginInput: $input) {
      id
      email
      firstName
      lastName
    }
  }
`);

export const Logout = graphql(`
  mutation Logout {
    logout {
      ok
    }
  }
`);

export const ForgotPassword = graphql(`
  mutation ForgotPassword($email: String!) {
    forgotPassword(email: $email) {
      ok
    }
  }
`);

export const ValidateOtp = graphql(`
  mutation ValidateOtp($email: String!, $otp: String!) {
    validateOtp(email: $email, otp: $otp) {
      resetToken
    }
  }
`);

export const ResetPassword = graphql(`
  mutation ResetPassword($resetToken: String!, $password: String!) {
    resetPassword(resetToken: $resetToken, password: $password) {
      ok
    }
  }
`);

export const Me = graphql(`
  query Me {
    me {
      id
      email
      firstName
      lastName
    }
  }
`);
