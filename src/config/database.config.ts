import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: process.env.DB_TYPE || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'finco_kpi_bot_db',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'], // Path to entities
  synchronize: process.env.NODE_ENV === 'development', // Auto-create DB schema in dev. Don't use in prod!
  logging: process.env.NODE_ENV === 'development' ? 'all' : ['error'], // Log all queries in dev
  // migrationsTableName: 'migrations',
  // migrations: ['dist/migrations/*{.ts,.js}'],
  // cli: {
  //   migrationsDir: 'src/migrations',
  // },
  extra: {
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },
}));
