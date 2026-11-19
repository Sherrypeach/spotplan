import { graphql } from '@graphql/generated';

export const MyClassrooms = graphql(`
  query MyClassrooms {
    myClassrooms {
      id
      name
      studentCount
    }
  }
`);

export const ClassroomById = graphql(`
  query ClassroomById($id: Int!) {
    classroom(id: $id) {
      id
      name
      revision
      document
    }
  }
`);

export const CreateClassroom = graphql(`
  mutation CreateClassroom($input: CreateClassroomInput!) {
    createClassroom(createClassroomInput: $input) {
      id
      name
      revision
      document
    }
  }
`);

export const SaveClassroom = graphql(`
  mutation SaveClassroom($id: Int!, $input: SaveClassroomInput!) {
    saveClassroom(id: $id, saveClassroomInput: $input) {
      id
      revision
    }
  }
`);
