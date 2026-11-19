import { join } from 'path';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule, GraphQLISODateTime } from '@nestjs/graphql';
import { Request, Response } from 'express';

import { HealthController } from '@app/health.controller';
import { formatGraphqlError } from '@core/graphql/format-error';
import { queryLimits } from '@core/graphql/query-limits';
import {
  AppConfiguration,
  AppEnvironment,
} from '@infrastructure/config/config.interface';
import configuration from '@infrastructure/config/configuration';
import { validationSchema } from '@infrastructure/config/validation';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { EmailModule } from '@infrastructure/email/email.module';
import { JsonScalar } from '@infrastructure/graphql/json.scalar';
import { AuthModule } from '@modules/auth/auth.module';
import { ClassroomModule } from '@modules/classroom/classroom.module';
import { RoleModule } from '@modules/role/role.module';
import { UserModule } from '@modules/user/user.module';

// Generous for this app's screens; far below what would load the server.
const MAX_QUERY_DEPTH = 10;
const MAX_QUERY_FIELDS = 300;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    DatabaseModule,
    // Schema-first GraphQL: each module owns a .graphql file;
    // typings regenerate via `npm run generate-typings`.
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const env = configService.get<AppConfiguration>('app')?.env;
        // Internal details only on a developer's own machine; the shared dev
        // server is reachable by others.
        const isLocal = env === AppEnvironment.Local;
        return {
          typePaths: [join(__dirname, '**/*.graphql')],
          resolvers: { Date: GraphQLISODateTime, JSON: JsonScalar },
          // Resolvers set the session cookie on the response.
          context: ({ req, res }: { req: Request; res: Response }) => ({
            req,
            res,
          }),
          introspection: env !== AppEnvironment.Production,
          includeStacktraceInErrorResponses: isLocal,
          formatError: formatGraphqlError(isLocal),
          validationRules: [queryLimits(MAX_QUERY_DEPTH, MAX_QUERY_FIELDS)],
        };
      },
    }),
    EmailModule,
    AuthModule,
    UserModule,
    RoleModule,
    ClassroomModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
