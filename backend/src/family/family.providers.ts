import { DataSource } from 'typeorm';
import { Family } from './family.entity';

export const hospitalProvider = [
  {
    provide: 'USERS_REPOSITORY',
    useFactory: (connection: DataSource) => connection.getRepository(Family),
    inject: ['DATABASE_CONNECTION'],
  },
];