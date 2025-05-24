import { DataSource } from 'typeorm';
import { Country } from './country.entity';

export const hospitalProvider = [
  {
    provide: 'USERS_REPOSITORY',
    useFactory: (connection: DataSource) => connection.getRepository(Country),
    inject: ['DATABASE_CONNECTION'],
  },
];