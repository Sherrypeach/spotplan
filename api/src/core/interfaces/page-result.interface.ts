/** Standard paginated result shape. */
export interface PageResult<T> {
  items: T[];
  total: number;
  limit: number;
  skip: number;
}
