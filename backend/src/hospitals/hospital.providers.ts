import { DataSource } from 'typeorm';
import { Hospital } from './hospital.entity';

export const hospitalProvider = [
  {
    provide: 'USERS_REPOSITORY',
    useFactory: (connection: DataSource) => connection.getRepository(Hospital),
    inject: ['DATABASE_CONNECTION'],
  },
];