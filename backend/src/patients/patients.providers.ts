import { DataSource } from 'typeorm';
import { Patient } from './patient.entity';

export const patientsProvider = [
  {
    provide: 'USERS_REPOSITORY',
    useFactory: (connection: DataSource) => connection.getRepository(Patient),
    inject: ['DATABASE_CONNECTION'],
  },
];