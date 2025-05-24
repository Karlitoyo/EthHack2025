import { DataSource } from 'typeorm';
import { Citizen } from './citizen.entity';

export const patientsProvider = [
  {
    provide: 'USERS_REPOSITORY',
    useFactory: (connection: DataSource) => connection.getRepository(Citizen),
    inject: ['DATABASE_CONNECTION'],
  },
];