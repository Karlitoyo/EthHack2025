import { DataSource } from 'typeorm';
import { Relation } from './relation.entity';

export const patientsProvider = [
  {
    provide: 'USERS_REPOSITORY',
    useFactory: (connection: DataSource) => connection.getRepository(Relation),
    inject: ['DATABASE_CONNECTION'],
  },
];