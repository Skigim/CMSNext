export interface IRepository<T, TId> {
  getById(id: TId): Promise<T | null>;
  getAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: TId): Promise<void>;
}
